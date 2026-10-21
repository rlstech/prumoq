/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do projeto Supabase (ex.: https://xxxx.supabase.co). */
  readonly VITE_SUPABASE_URL: string;
  /** Chave publicável do Supabase (header apikey; quem autoriza é o token do Clerk + RLS). */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_CLERK_PUBLISHABLE_KEY: string;
  /** URL pública do PWA (links de "abrir no app" e redirecionamento de senha). */
  readonly VITE_PWA_URL?: string;
  /** Base da rota de mídia (/api/media/presign do Worker do PWA). Vazia = mesma origem. */
  readonly VITE_MEDIA_API_URL?: string;
  readonly VITE_NEON_RETRY_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
