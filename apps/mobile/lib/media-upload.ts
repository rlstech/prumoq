/**
 * Envio de mídia (fotos e assinaturas) da fila do PowerSync para o R2.
 *
 * As linhas gravadas no aparelho referenciam a mídia como `pending:<referência local>`. Antes de mandar a
 * linha ao banco, o connector troca essa referência pela chave definitiva do R2 usando o envio registrado
 * aqui. A implementação (arquivo guardado no navegador + URL assinada) chega na Fase 4.
 */
export const PENDING_PREFIX = 'pending:';

/**
 * A mídia ainda não pode subir (envio não disponível ou sem conexão). A fila espera, na ordem, sem contar
 * tentativa e sem quarentena: nada se perde, apenas não sobe ainda.
 */
export class MidiaAguardandoEnvio extends Error {
  constructor(message = 'Fotos e assinaturas aguardando envio ao servidor.') {
    super(message);
    this.name = 'MidiaAguardandoEnvio';
  }
}

export interface EnvioMidia {
  /** Sobe o arquivo local e devolve a chave do R2. */
  enviar(referenciaLocal: string, info: { campo: string; mimeType: string }): Promise<string>;
  /** Gera a miniatura de uma foto e devolve a referência local dela. */
  miniatura(referenciaLocal: string): Promise<string>;
  /** Apaga a cópia local depois que a linha que a referencia foi aceita pelo servidor. */
  descartar(referenciaLocal: string): Promise<void>;
}

const indisponivel: EnvioMidia = {
  enviar: async () => { throw new MidiaAguardandoEnvio(); },
  miniatura: async () => { throw new MidiaAguardandoEnvio(); },
  descartar: async () => undefined,
};

let envioAtual: EnvioMidia = indisponivel;

export function registrarEnvioMidia(envio: EnvioMidia): void {
  envioAtual = envio;
}

export function envioMidia(): EnvioMidia {
  return envioAtual;
}
