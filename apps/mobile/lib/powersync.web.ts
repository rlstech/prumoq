// Web stub — re-exporta db do shim Supabase em vez do PowerSyncDatabase nativo.
// Metro resolve este arquivo no lugar de powersync.ts quando platform === 'web'.
export { db } from './powersync-web-shim';
