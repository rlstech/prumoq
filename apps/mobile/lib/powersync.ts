import { PowerSyncDatabase, WASQLiteVFS } from '@powersync/web';
import { AppSchema } from './schema';

/**
 * Banco local do PWA: SQLite (wa-sqlite) dentro do navegador, sincronizado pelo PowerSync.
 *
 * O build "react-native-web" do SDK não sabe achar os workers sozinho: eles são copiados para
 * `public/powersync/` por `pnpm powersync:assets` e servidos na raiz do site. O mesmo
 * `worker.js` atende o banco e a sincronização.
 *
 * OPFSCoopSyncVFS é o recomendado pelo PowerSync, inclusive para o Safari (iPhone).
 */
const WORKER_URL = '/powersync/worker.js';

export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'prumoq.db',
    vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    worker: WORKER_URL,
  },
  sync: {
    worker: WORKER_URL,
  },
});
