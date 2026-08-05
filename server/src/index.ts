import 'dotenv/config';

import { serve } from '@hono/node-server';
import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';
import { createDb } from './db/client.js';
import { runMigrations, seedLocales } from './db/migrate.js';
import { env } from './env.js';

const handle = createDb(env.DATABASE_URL);
await runMigrations(handle.db);
await seedLocales(handle.db);

const webDist = env.WEB_DIST ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
const app = createApp(handle.db, webDist);

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`Slang server listening on http://localhost:${info.port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => {
      void handle.close().then(() => process.exit(0));
    });
  });
}
