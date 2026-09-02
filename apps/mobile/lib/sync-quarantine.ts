import { AbstractPowerSyncDatabase, CrudEntry, UpdateType } from '@powersync/react-native';
import { AppSchema, SyncFalhasRow } from './schema';
import { FailureClassification } from './sync-failure';

export { classifyUploadFailure } from './sync-failure';
export type { FailureClassification } from './sync-failure';

/**
 * Quarentena de operações recusadas em definitivo pelo servidor: guarda a
 * operação com payload e mensagem para reenvio ou descarte manual, para que
 * uma linha ruim não segure a fila FIFO do PowerSync. A regra de o que é
 * definitivo mora em `sync-failure.ts`.
 */

/** Nomes de tabela aceitos ao remontar uma operação — o SQL é interpolado. */
const SYNCABLE_TABLES: ReadonlySet<string> = new Set(
  (AppSchema.tables ?? []).map(table => table.name).filter(name => name !== 'sync_falhas'),
);

export async function quarantineOperation(
  database: AbstractPowerSyncDatabase,
  op: CrudEntry,
  failure: FailureClassification,
): Promise<void> {
  await database.execute(
    `INSERT INTO sync_falhas (id, op, tabela, registro_id, payload, erro, codigo, criado_em)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `${op.table}:${op.id}:${Date.now()}`,
      op.op,
      op.table,
      op.id,
      JSON.stringify(op.opData ?? {}),
      failure.message,
      failure.code,
      new Date().toISOString(),
    ],
  );
}

export async function listQuarantined(database: AbstractPowerSyncDatabase): Promise<SyncFalhasRow[]> {
  return database.getAll<SyncFalhasRow>('SELECT * FROM sync_falhas ORDER BY criado_em DESC');
}

export async function discardQuarantined(
  database: AbstractPowerSyncDatabase,
  id: string,
): Promise<void> {
  await database.execute('DELETE FROM sync_falhas WHERE id = ?', [id]);
}

/**
 * Recoloca a operação na fila reescrevendo a linha local, o que gera uma nova
 * entrada de CRUD. Use depois de corrigir a causa no servidor (liberar acesso,
 * recriar a FVS apagada).
 */
export async function retryQuarantined(
  database: AbstractPowerSyncDatabase,
  row: SyncFalhasRow,
): Promise<void> {
  if (!SYNCABLE_TABLES.has(row.tabela)) {
    throw new Error(`Tabela desconhecida na quarentena: ${row.tabela}`);
  }

  const data = JSON.parse(row.payload) as Record<string, unknown>;
  const columns = Object.keys(data);

  if (row.op === UpdateType.DELETE) {
    await database.execute(`DELETE FROM ${row.tabela} WHERE id = ?`, [row.registro_id]);
  } else if (row.op === UpdateType.PATCH) {
    if (!columns.length) throw new Error('Operação sem campos para atualizar');
    await database.execute(
      `UPDATE ${row.tabela} SET ${columns.map(c => `${c} = ?`).join(', ')} WHERE id = ?`,
      [...columns.map(c => data[c] as never), row.registro_id],
    );
  } else {
    await database.execute(
      `INSERT OR REPLACE INTO ${row.tabela} (id${columns.length ? ', ' : ''}${columns.join(', ')})
       VALUES (?${columns.map(() => ', ?').join('')})`,
      [row.registro_id, ...columns.map(c => data[c] as never)],
    );
  }

  await discardQuarantined(database, row.id);
}
