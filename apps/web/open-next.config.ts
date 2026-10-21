import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Todas as páginas do admin são dinâmicas (dados por usuário): sem cache incremental no R2.
export default defineCloudflareConfig({});
