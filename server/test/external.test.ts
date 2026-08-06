import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { locales, projectsToLocales, type Project } from '../src/db/schema.js';
import { openTestDb, resetDb, seedProject, seedUser } from './helpers.js';

const handle = openTestDb();
const app = createApp(handle.db);

beforeEach(() => resetDb(handle));
afterAll(() => handle.close());

async function makeProject(): Promise<Project> {
  const user = await seedUser(handle);
  return seedProject(handle, user);
}

async function push(project: Project, body: unknown): Promise<Response> {
  return await app.request('/api/translations/push', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': project.apiKey },
    body: JSON.stringify(body),
  });
}

async function get(path: string, apiKey?: string): Promise<Response> {
  return await app.request(path, { headers: apiKey ? { 'x-api-key': apiKey } : {} });
}

describe('GET /api/translations (client contract)', () => {
  it('rejects missing and unknown api keys with 401 { message }', async () => {
    const missing = await get('/api/translations');
    expect(missing.status).toBe(401);
    expect(await missing.json()).toEqual({ message: 'api_key_invalid' });

    const unknown = await get('/api/translations', 'not-a-real-key');
    expect(unknown.status).toBe(401);
  });

  it('answers the i18next shape for pushed keys', async () => {
    const project = await makeProject();
    await push(project, { locale: 'en', translations: { hello: 'Hello!', bye: 'Goodbye' } });

    const response = await get('/api/translations?locale=en&format=i18next', project.apiKey);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ en: { hello: 'Hello!', bye: 'Goodbye' } });
  });

  it('returns every locale when no locale param is given', async () => {
    const project = await makeProject();
    await push(project, { locale: 'en', translations: { hello: 'Hello!' } });
    await push(project, { locale: 'de', translations: { hello: 'Hallo!' } });

    const response = await get('/api/translations?format=i18next', project.apiKey);
    expect(await response.json()).toEqual({ en: { hello: 'Hello!' }, de: { hello: 'Hallo!' } });
  });

  it('answers the raw array shape without the format param', async () => {
    const project = await makeProject();
    await push(project, { locale: 'en', translations: { hello: 'Hello!' } });

    const response = await get('/api/translations?locale=en', project.apiKey);
    const rows = (await response.json()) as Array<{
      id: number;
      value: string;
      word: { key: string; namespaces: Array<{ name: string }> };
      locale: { id: number; code: string };
      channel: { id: number; name: string } | null;
    }>;
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.value).toBe('Hello!');
    expect(row.word).toEqual({ key: 'hello', namespaces: [] });
    expect(row.locale.code).toBe('en');
    expect(row.channel).toMatchObject({ name: 'default' });
  });

  it('groups namespaced words under their namespace, flattens under a namespace filter', async () => {
    const project = await makeProject();
    await push(project, {
      locale: 'en',
      namespace: 'common',
      translations: { hello: 'Hello!' },
    });
    await push(project, { locale: 'en', translations: { bare: 'Bare' } });

    const nested = await get('/api/translations?locale=en&format=i18next', project.apiKey);
    expect(await nested.json()).toEqual({
      en: { common: { hello: 'Hello!' }, bare: 'Bare' },
    });

    const flat = await get(
      '/api/translations?locale=en&namespace=common&format=i18next',
      project.apiKey,
    );
    expect(await flat.json()).toEqual({ en: { hello: 'Hello!' } });
  });
});

describe('GET /api/translations/state', () => {
  it('answers the { data, error } envelope with the newest updatedAt', async () => {
    const project = await makeProject();
    await push(project, { locale: 'en', translations: { hello: 'Hello!' } });

    const response = await get('/api/translations/state?locale=en', project.apiKey);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: string; error: null };
    expect(body.error).toBeNull();
    expect(new Date(body.data).toString()).not.toBe('Invalid Date');
  });

  it('answers 404 with the envelope for unknown keys (old-server parity)', async () => {
    const response = await get('/api/translations/state', 'not-a-real-key');
    expect(response.status).toBe(404);
    const body = (await response.json()) as { data: null; error: { message: string } };
    expect(body.data).toBeNull();
    expect(body.error.message).toBe('api_key_invalid');
  });

  it('answers 404 when nothing matches', async () => {
    const project = await makeProject();
    const response = await get('/api/translations/state?locale=de', project.apiKey);
    expect(response.status).toBe(404);
  });

  it('grows after another push', async () => {
    const project = await makeProject();
    await push(project, { locale: 'en', translations: { hello: 'Hello!' } });
    const first = (await (
      await get('/api/translations/state?locale=en', project.apiKey)
    ).json()) as { data: string };

    await new Promise((resolve) => setTimeout(resolve, 5));
    await push(project, { locale: 'en', translations: { hello: 'Hello again!' } });
    const second = (await (
      await get('/api/translations/state?locale=en', project.apiKey)
    ).json()) as { data: string };

    expect(new Date(second.data).getTime()).toBeGreaterThan(new Date(first.data).getTime());
  });
});

describe('POST /api/translations/push', () => {
  it('rejects unknown channels', async () => {
    const project = await makeProject();

    const badChannel = await push(project, {
      locale: 'en',
      channel: 'staging',
      translations: { a: 'b' },
    });
    expect(badChannel.status).toBe(400);
    expect(await badChannel.json()).toEqual({ data: null, error: { message: 'channel_not_found' } });
  });

  it('attaches a catalog locale to the project on first push', async () => {
    const project = await makeProject();
    const response = await push(project, { locale: 'de', translations: { hello: 'Hallo!' } });
    expect(response.status).toBe(200);

    const [locale] = await handle.db
      .select()
      .from(locales)
      .where(eq(locales.code, 'de'))
      .limit(1);
    const links = await handle.db
      .select()
      .from(projectsToLocales)
      .where(eq(projectsToLocales.projectId, project.id));
    expect(links).toEqual([{ projectId: project.id, localeId: locale!.id }]);

    // A second push must not duplicate the link.
    await push(project, { locale: 'de', translations: { hello: 'Hallo nochmal!' } });
    const linksAgain = await handle.db
      .select()
      .from(projectsToLocales)
      .where(eq(projectsToLocales.projectId, project.id));
    expect(linksAgain).toHaveLength(1);
  });

  it('creates a locale missing from the catalog and attaches it', async () => {
    const project = await makeProject();
    const response = await push(project, { locale: 'xx', translations: { a: 'b' } });
    expect(response.status).toBe(200);

    const [locale] = await handle.db
      .select()
      .from(locales)
      .where(eq(locales.code, 'xx'))
      .limit(1);
    expect(locale).toMatchObject({ code: 'xx', countryCode: 'xx', name: 'xx', title: 'xx' });

    const links = await handle.db
      .select()
      .from(projectsToLocales)
      .where(eq(projectsToLocales.projectId, project.id));
    expect(links).toEqual([{ projectId: project.id, localeId: locale!.id }]);

    const fetched = await get('/api/translations?locale=xx&format=i18next', project.apiKey);
    expect(await fetched.json()).toEqual({ xx: { a: 'b' } });
  });

  it('rejects malformed bodies', async () => {
    const project = await makeProject();
    const response = await push(project, { locale: 'en' });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { message: string } }).error.message).toBe(
      'invalid_body',
    );
  });

  it('upserts: a second push updates values without duplicating keys', async () => {
    const project = await makeProject();
    await push(project, { locale: 'en', translations: { hello: 'Hello!' } });
    await push(project, { locale: 'en', translations: { hello: 'Hi!', bye: 'Bye!' } });

    const response = await get('/api/translations?locale=en&format=i18next', project.apiKey);
    expect(await response.json()).toEqual({ en: { hello: 'Hi!', bye: 'Bye!' } });

    const raw = (await (await get('/api/translations?locale=en', project.apiKey)).json()) as unknown[];
    expect(raw).toHaveLength(2);
  });

  it('skips empty values', async () => {
    const project = await makeProject();
    const response = await push(project, { locale: 'en', translations: { a: 'b', empty: '' } });
    const body = (await response.json()) as { data: { keys: number } };
    expect(body.data.keys).toBe(1);
  });

  it('requires an api key', async () => {
    const response = await app.request('/api/translations/push', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'en', translations: {} }),
    });
    expect(response.status).toBe(401);
  });
});
