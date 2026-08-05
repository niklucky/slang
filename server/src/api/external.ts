import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import type { Database } from '../db/client.js';
import { projects } from '../db/schema.js';
import {
  ExternalApiError,
  fetchNamespacesForWords,
  fetchTranslations,
  fetchTranslationsState,
  prepareI18Next,
  prepareRaw,
  pushTranslations,
} from '../services/translations.js';

const pushSchema = z.object({
  locale: z.string().min(1),
  channel: z.string().min(1).optional(),
  namespace: z.string().min(1).optional(),
  translations: z.record(z.string(), z.string()),
});

/**
 * The client-facing API. Everything here is contract surface used by
 * already-shipped clients — response shapes must not change.
 */
export function externalApi(db: Database): Hono {
  const app = new Hono();

  async function projectByApiKey(apiKey: string | undefined) {
    if (!apiKey) throw new ExternalApiError(401, 'api_key_invalid');
    const [project] = await db
      .select()
      .from(projects)
      .where(and(eq(projects.apiKey, apiKey), isNull(projects.deletedAt)))
      .limit(1);
    if (!project) throw new ExternalApiError(401, 'api_key_invalid');
    return project;
  }

  app.onError((error, c) => {
    if (error instanceof ExternalApiError) {
      // GET /api/translations historically answers bare `{ message }` errors.
      if (c.req.path === '/api/translations' && c.req.method === 'GET') {
        return c.json({ message: error.message }, error.status);
      }
      return c.json({ data: null, error: { message: error.message } }, error.status);
    }
    console.error(error);
    return c.json({ message: 'internal_error' }, 500);
  });

  app.get('/api/translations', async (c) => {
    const project = await projectByApiKey(c.req.header('x-api-key'));
    const locale = c.req.query('locale');
    const channel = c.req.query('channel');
    const namespace = c.req.query('namespace');
    const format = c.req.query('format');

    const rows = await fetchTranslations(db, {
      projectId: project.id,
      ...(locale ? { locale } : {}),
      ...(channel ? { channel } : {}),
      ...(namespace ? { namespace } : {}),
    });
    const namespacesByWord = await fetchNamespacesForWords(
      db,
      [...new Set(rows.map((row) => row.wordId))],
    );

    if (format === 'i18next') {
      return c.json(prepareI18Next(rows, namespacesByWord, namespace));
    }
    return c.json(prepareRaw(rows, namespacesByWord));
  });

  /**
   * Freshness probe. Old behavior: ANY failure — bad key included — answers
   * `404 { data: null, error: { message } }`; success answers the envelope
   * with the newest matching `updatedAt`.
   */
  app.get('/api/translations/state', async (c) => {
    try {
      const project = await projectByApiKey(c.req.header('x-api-key'));
      const locale = c.req.query('locale');
      const channel = c.req.query('channel');
      const namespace = c.req.query('namespace');
      const updatedAt = await fetchTranslationsState(db, {
        projectId: project.id,
        ...(locale ? { locale } : {}),
        ...(channel ? { channel } : {}),
        ...(namespace ? { namespace } : {}),
      });
      if (!updatedAt) throw new ExternalApiError(404, 'state_not_found');
      return c.json({ data: updatedAt.toISOString(), error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      return c.json({ data: null, error: { message } }, 404);
    }
  });

  /** Batch upsert for the CLI. Additive — old clients never call it. */
  app.post('/api/translations/push', async (c) => {
    const project = await projectByApiKey(c.req.header('x-api-key'));
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ExternalApiError(400, 'invalid_json');
    }
    const parsed = pushSchema.safeParse(body);
    if (!parsed.success) {
      throw new ExternalApiError(400, 'invalid_body');
    }
    const result = await pushTranslations(db, project.id, parsed.data);
    return c.json({ data: result, error: null });
  });

  return app;
}
