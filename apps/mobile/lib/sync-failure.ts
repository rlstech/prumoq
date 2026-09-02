/**
 * Classificação de falhas de upload da fila do PowerSync.
 *
 * A fila é FIFO e sem fim: quando `uploadData` lança, a mesma operação é
 * reenviada indefinidamente e tudo o que veio depois fica preso atrás dela.
 * Num app de campo isso é inaceitável — uma verificação recusada pela RLS
 * chegou a bloquear um dia inteiro de gravações em silêncio, enquanto o
 * indicador exibia "sincronizado".
 *
 * A saída é distinguir os dois tipos de falha:
 *
 * - **transitória** (rede, 5xx, token expirado): relança, o PowerSync repete;
 * - **definitiva** (RLS, FK, dado inválido): vai para a quarentena e a fila
 *   segue, com o registro preservado para reenvio ou descarte manual.
 *
 * Mora separado de `sync-quarantine.ts` porque lá entram o schema e o SDK
 * nativo, que não carregam sob `tsx --test`; aqui é lógica pura, com teste.
 */
/**
 * Classes de erro do Postgres que não mudam de resultado por repetição:
 * 22 = data exception, 23 = integrity constraint violation.
 * 42501 = insufficient_privilege, que é como a RLS recusa uma linha.
 */
const PERMANENT_PG_CLASSES = ['22', '23'];
const PERMANENT_PG_CODES = new Set(['42501', '42703', '42P01']);

/** Códigos do PostgREST sobre formato de requisição — repetir não ajuda. */
const PERMANENT_PGRST_CODES = new Set(['PGRST102', 'PGRST103', 'PGRST105', 'PGRST200', 'PGRST201', 'PGRST204']);

/** HTTP que representa recusa do pedido em si, não indisponibilidade. */
const PERMANENT_HTTP = new Set([400, 403, 404, 405, 409, 413, 415, 422]);

export interface FailureClassification {
  permanent: boolean;
  code: string;
  message: string;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : '';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : String(error);
}

/**
 * Erros do connector carregam o status HTTP no texto
 * (`Presign failed: 403`, `R2 upload failed: 400`).
 */
function httpStatusFromMessage(message: string): number | null {
  const match = message.match(/(?:failed|error)[^0-9]*(\d{3})\b/i);
  if (!match) return null;
  const status = Number(match[1]);
  return status >= 100 && status <= 599 ? status : null;
}

export function classifyUploadFailure(error: unknown): FailureClassification {
  const code = errorCode(error);
  const message = errorMessage(error);

  if (code) {
    if (PERMANENT_PG_CODES.has(code)) return { permanent: true, code, message };
    if (PERMANENT_PGRST_CODES.has(code)) return { permanent: true, code, message };
    // PGRST301 é JWT expirado: o cliente renova e a próxima tentativa passa.
    if (code === 'PGRST301') return { permanent: false, code, message };
    // SQLSTATE tem 5 caracteres alfanuméricos (22P02, 23503), não só dígitos.
    if (/^[0-9A-Z]{5}$/.test(code) && PERMANENT_PG_CLASSES.includes(code.slice(0, 2))) {
      return { permanent: true, code, message };
    }
  }

  // O arquivo local sumiu (limpeza do sistema, reinstalação): não volta.
  if (/arquivo da foto não está mais no aparelho/i.test(message)) {
    return { permanent: true, code: code || 'MEDIA_MISSING', message };
  }

  // Alteração sem linha alvo: a criação correspondente foi recusada, então
  // repetir nunca vai encontrá-la. Vai para a quarentena junto com ela.
  if (/registro não existe no servidor/i.test(message)) {
    return { permanent: true, code: code || 'ROW_MISSING', message };
  }

  const status = httpStatusFromMessage(message);
  if (status !== null) {
    return { permanent: PERMANENT_HTTP.has(status), code: code || `HTTP_${status}`, message };
  }

  // Na dúvida, repetir: perder gravação de campo é pior que insistir.
  return { permanent: false, code: code || 'UNKNOWN', message };
}
