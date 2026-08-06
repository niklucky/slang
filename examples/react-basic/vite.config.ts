import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5803,
    proxy: {
      // The server sends no CORS headers, so the browser must not call it
      // cross-origin. Vite forwards same-origin /api to the local slang server.
      '/api': 'http://localhost:5801',
    },
  },
});
