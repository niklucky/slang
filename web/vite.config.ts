import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5800,
    proxy: {
      '/api': 'http://localhost:5801',
      '/trpc': 'http://localhost:5801',
    },
  },
});
