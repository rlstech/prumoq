import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// O painel é servido em /admin (mesmo domínio do PWA na virada). Em dev, `vite` serve em http://localhost:5173/admin/.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
  // esvazia só dist/admin; dist/index.html e dist/_headers são refeitos pelo postbuild
  build: { outDir: 'dist/admin', emptyOutDir: true, sourcemap: false },
});
