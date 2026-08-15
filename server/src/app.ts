import { serveStatic } from '@hono/node-server/serve-static';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { eq } from 'drizzle-orm';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Hono } from 'hono';

import { externalApi } from './api/external.js';
import type { Database } from './db/client.js';
import { projects } from './db/schema.js';
import { env } from './env.js';
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

  // Stored project favicons. Public: favicons are non-sensitive and the
  // management UI embeds them by project id.
  app.get('/api/projects/:id/icon', async (c) => {
    const projectId = Number(c.req.param('id'));
    if (!Number.isInteger(projectId)) return c.notFound();
    const [project] = await db
      .select({ iconMimeType: projects.iconMimeType })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);
    if (!project?.iconMimeType) return c.notFound();
    try {
      const bytes = await readFile(join(env.ICONS_DIR, String(projectId)));
      return c.body(bytes, 200, {
        'content-type': project.iconMimeType,
        'cache-control': 'public, max-age=300',
      });
    } catch {
      return c.notFound();
    }
  });

  if (webDist && existsSync(join(webDist, 'index.html'))) {
    app.get('*', serveStatic({ root: webDist }));
    // SPA fallback: hand the router every path the static layer did not take.
    app.get('*', (c) => c.html(readFileSync(join(webDist, 'index.html'), 'utf8')));
  } else {
    app.get('/', (c) => c.text('Slang server is running. Web UI build not found.'));
  }

  return app;
}
