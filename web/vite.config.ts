import { copyFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Expose the agent integration guide (repo-root docs/integration.md) as
// /llms.txt so it is served from the site in dev and from the built dist.
function llmsTxt(): Plugin {
  const source = resolve(repoRoot, 'docs/integration.md');
  let outDir = resolve(repoRoot, 'web/dist');
  return {
    name: 'llms-txt',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/llms.txt') return next();
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.end(readFileSync(source, 'utf8'));
      });
    },
    writeBundle() {
      copyFileSync(source, resolve(outDir, 'llms.txt'));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), llmsTxt()],
  server: {
    port: 5800,
    proxy: {
      '/api': 'http://localhost:5801',
      '/trpc': 'http://localhost:5801',
    },
  },
});
