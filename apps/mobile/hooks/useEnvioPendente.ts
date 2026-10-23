import { useQuery } from '@powersync/react';

interface Linha { n: number }

/**
 * Se um registro (ou os filhos dele, como itens e fotos de uma verificação) ainda está na fila de envio do
 * aparelho. `created_offline` não serve para isso: marca só a origem e continua 1 depois do envio.
 * A fila é a tabela `ps_crud` do PowerSync ({op, type, id, data}); a consulta é observada como qualquer
 * outra, então a tela atualiza sozinha quando o envio termina.
 */
export function useEnvioPendente(registroId: string | null | undefined, colunaPai = 'verificacao_id'): boolean {
  const id = registroId ?? '';
  const { data } = useQuery<Linha>(
    `SELECT COUNT(*) AS n FROM ps_crud
      WHERE json_extract(data, '$.id') = ? OR json_extract(data, '$.data.${colunaPai}') = ?`,
    [id, id],
  );
  return Boolean(id) && (data[0]?.n ?? 0) > 0;
}
