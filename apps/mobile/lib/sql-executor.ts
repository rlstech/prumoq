/**
 * O mínimo que um serviço precisa para gravar: `db` e a transação do PowerSync
 * satisfazem os dois a mesma forma.
 *
 * Existe para que uma tela possa agrupar escritas relacionadas em uma única
 * transação sem que cada serviço importe `db` por conta própria. Importa
 * porque o PowerSync agrupa a fila de upload por transação SQLite: escritas
 * soltas viram transações CRUD separadas, e o connector limpa os caches de
 * mídia (e apaga o arquivo local) ao fim de cada uma.
 */
export interface SqlExecutor {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}
