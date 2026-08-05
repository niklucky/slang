import { serveStatic } from '@hono/node-server/serve-static';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';

import { externalApi } from './api/external.js';
import type { Database } from './db/client.js';
import { appRouter, createContext } from './trpc/index.js';

export function createApp(db: Database, webDist?: string): Hono {
  const app = new Hono();

  app.all('/trpc/*', (c) =>
    fetchRequestHandler({
      endpoint: '/trpc',
      req: c.req.raw,
      router: appRouter,
      createContext: () => createContext(db, c.req.header('authorization')),
    }),
  );

  app.route('/', externalApi(db));

  if (webDist && existsSync(join(webDist, 'index.html'))) {
    app.get('*', serveStatic({ root: webDist }));
    // SPA fallback: hand the router every path the static layer did not take.
    app.get('*', (c) => c.html(readFileSync(join(webDist, 'index.html'), 'utf8')));
  } else {
    app.get('/', (c) => c.text('Slang server is running. Web UI build not found.'));
  }

  return app;
}
