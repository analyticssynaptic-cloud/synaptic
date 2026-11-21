import { defineConfig } from 'vite';
// __BUILD__ cambia en cada publicación: evita que el navegador use audios/modelos viejos en caché
export default defineConfig({
  base: './',
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  build: { chunkSizeWarningLimit: 1200 },
});
