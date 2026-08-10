import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { translations, words, type Project } from '../src/db/schema.js';
import { openTestDb, resetDb, seedUser, trpc } from './helpers.js';

const handle = openTestDb();
const app = createApp(handle.db);

beforeEach(() => resetDb(handle));
afterAll(() => handle.close());

interface AuthResult {
  user: { id: number; email: string };
  accessToken: string;
}

interface ProjectDetails {
  project: Project;
  locales: Array<{ id: number; code: string }>;
  channels: Array<{ id: number; name: string }>;
  namespaces: Array<{ id: number; name: string }>;
  wordCount: number;
}

interface WordRow {
  id: number;
  key: string;
  deletedAt: string | null;
  translations: Array<{ value: string; localeCode: string; channelId: number }>;
}

async function login(email: string): Promise<AuthResult> {
  const user = await seedUser(handle, email);
  const result = await trpc<AuthResult>(app, 'auth.login', {
    input: { email, password: 'password123' },
  });
  return { user: { id: user.id, email }, accessToken: result.accessToken };
}

describe('projects', () => {
  it('create returns a project with a 64-char api key; get shows a default channel', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: accessToken,
    });
    expect(project.apiKey).toMatch(/^[0-9a-f]{64}$/);

    const details = await trpc<ProjectDetails>(app, 'projects.get', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    expect(details.channels.map((channel) => channel.name)).toEqual(['default']);
    expect(details.locales).toEqual([]);
    expect(details.wordCount).toBe(0);
  });

  it('create accepts a null url; update can set and clear it', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'No URL', url: null },
      token: accessToken,
    });
    expect(project.url).toBeNull();

    const withUrl = await trpc<Project>(app, 'projects.update', {
      input: { projectId: project.id, url: 'https://now-has-url.dev' },
      token: accessToken,
    });
    expect(withUrl.url).toBe('https://now-has-url.dev');

    const cleared = await trpc<Project>(app, 'projects.update', {
      input: { projectId: project.id, url: null },
      token: accessToken,
    });
    expect(cleared.url).toBeNull();
  });

  it('regenerateApiKey rotates the key; non-members cannot regenerate', async () => {
    const alice = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: alice.accessToken,
    });

    const regenerated = await trpc<Project>(app, 'projects.regenerateApiKey', {
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    expect(regenerated.apiKey).toMatch(/^[0-9a-f]{64}$/);
    expect(regenerated.apiKey).not.toBe(project.apiKey);

    const bob = await login('bob@example.com');
    await expect(
      trpc(app, 'projects.regenerateApiKey', {
        input: { projectId: project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('list only shows projects the caller belongs to', async () => {
    const alice = await login('alice@example.com');
    const bob = await login('bob@example.com');
    await trpc(app, 'projects.create', {
      input: { name: 'Alice project', url: 'https://a.dev' },
      token: alice.accessToken,
    });

    const aliceProjects = await trpc<Project[]>(app, 'projects.list', {
      kind: 'query',
      token: alice.accessToken,
    });
    expect(aliceProjects).toHaveLength(1);

    const bobProjects = await trpc<Project[]>(app, 'projects.list', {
      kind: 'query',
      token: bob.accessToken,
    });
    expect(bobProjects).toHaveLength(0);

    await expect(
      trpc(app, 'projects.get', {
        kind: 'query',
        input: { projectId: aliceProjects[0]!.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('update and delete are owner-only; delete removes it from list', async () => {
    const alice = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: alice.accessToken,
    });

    const updated = await trpc<Project>(app, 'projects.update', {
      input: { projectId: project.id, name: 'Renamed' },
      token: alice.accessToken,
    });
    expect(updated.name).toBe('Renamed');

    await trpc(app, 'projects.delete', {
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    const projects = await trpc<Project[]>(app, 'projects.list', {
      kind: 'query',
      token: alice.accessToken,
    });
    expect(projects).toHaveLength(0);
  });

  it('removing a locale soft-deletes only that locale and only in this project', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: accessToken,
    });

    const catalog = await trpc<Array<{ id: number; code: string }>>(app, 'locales.catalog', {
      kind: 'query',
      token: accessToken,
    });
    const en = catalog.find((locale) => locale.code === 'en')!;
    const de = catalog.find((locale) => locale.code === 'de')!;

    for (const locale of [en, de]) {
      await trpc(app, 'locales.add', {
        input: { projectId: project.id, localeId: locale.id },
        token: accessToken,
      });
    }

    // Push translations for both locales through the external API.
    for (const code of ['en', 'de']) {
      const response = await app.request('/api/translations/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': project.apiKey },
        body: JSON.stringify({ locale: code, translations: { hello: code } }),
      });
      expect(response.status).toBe(200);
    }

    await trpc(app, 'locales.remove', {
      input: { projectId: project.id, localeId: de.id },
      token: accessToken,
    });

    const dict = await app.request('/api/translations?format=i18next', {
      headers: { 'x-api-key': project.apiKey },
    });
    expect(await dict.json()).toEqual({ en: { hello: 'en' } });
  });

  it('list reports untranslatedCount for keys missing a locale translation', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: accessToken,
    });
    const details = await trpc<ProjectDetails>(app, 'projects.get', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    const channelId = details.channels[0]!.id;

    const catalog = await trpc<Array<{ id: number; code: string }>>(app, 'locales.catalog', {
      kind: 'query',
      token: accessToken,
    });
    const en = catalog.find((locale) => locale.code === 'en')!;
    const de = catalog.find((locale) => locale.code === 'de')!;
    for (const locale of [en, de]) {
      await trpc(app, 'locales.add', {
        input: { projectId: project.id, localeId: locale.id },
        token: accessToken,
      });
    }

    // Fully translated key.
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'full',
        translations: [
          { localeId: en.id, channelId, value: 'Full' },
          { localeId: de.id, channelId, value: 'Voll' },
        ],
      },
      token: accessToken,
    });
    // Key missing the German translation.
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'partial',
        translations: [{ localeId: en.id, channelId, value: 'Partial' }],
      },
      token: accessToken,
    });

    const projects = await trpc<Array<Project & { untranslatedCount: number }>>(
      app,
      'projects.list',
      { kind: 'query', token: accessToken },
    );
    expect(projects[0]!.untranslatedCount).toBe(1);
  });
});

describe('words', () => {
  async function createProjectWithLocale(email: string) {
    const session = await login(email);
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: session.accessToken,
    });
    const details = await trpc<ProjectDetails>(app, 'projects.get', {
      kind: 'query',
      input: { projectId: project.id },
      token: session.accessToken,
    });
    const catalog = await trpc<Array<{ id: number; code: string }>>(app, 'locales.catalog', {
      kind: 'query',
      token: session.accessToken,
    });
    const en = catalog.find((locale) => locale.code === 'en')!;
    await trpc(app, 'locales.add', {
      input: { projectId: project.id, localeId: en.id },
      token: session.accessToken,
    });
    const channelId = details.channels[0]!.id;
    return { ...session, project, en, channelId };
  }

  it('upsert creates the key and translations; list returns them', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');

    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });

    const list = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.key).toBe('greeting');
    expect(list[0]!.translations).toEqual([
      expect.objectContaining({ value: 'Hello', localeCode: 'en' }),
    ]);

    // Search index covers values, not just keys.
    const searched = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, search: 'hello' },
      token: accessToken,
    });
    expect(searched).toHaveLength(1);
  });

  it('remove soft-deletes the word', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });
    const list = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });

    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId: list[0]!.id },
      token: accessToken,
    });
    const after = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    expect(after).toHaveLength(0);
  });

  it('list with deleted: true returns only soft-deleted words', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');
    for (const key of ['greeting', 'farewell']) {
      await trpc(app, 'words.upsert', {
        input: {
          projectId: project.id,
          key,
          translations: [{ localeId: en.id, channelId, value: key }],
        },
        token: accessToken,
      });
    }
    const list = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    const target = list.find((word) => word.key === 'greeting')!;
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId: target.id },
      token: accessToken,
    });

    const live = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    expect(live.map((word) => word.key)).toEqual(['farewell']);
    expect(live[0]!.deletedAt).toBeNull();

    const deleted = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, deleted: true },
      token: accessToken,
    });
    expect(deleted).toHaveLength(1);
    expect(deleted[0]!.key).toBe('greeting');
    expect(deleted[0]!.deletedAt).not.toBeNull();
  });

  it('removePermanently deletes the word and its translations from the db', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });
    const list = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    const wordId = list[0]!.id;
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    await trpc(app, 'words.removePermanently', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    const deletedList = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, deleted: true },
      token: accessToken,
    });
    expect(deletedList).toHaveLength(0);
    expect(await handle.db.select().from(words)).toHaveLength(0);
    expect(await handle.db.select().from(translations)).toHaveLength(0);
  });

  it('restore brings back a soft-deleted word with its translations', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });
    const list = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    const wordId = list[0]!.id;
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    await trpc(app, 'words.restore', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    const restored = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    });
    expect(restored).toHaveLength(1);
    expect(restored[0]!.key).toBe('greeting');
    expect(restored[0]!.deletedAt).toBeNull();
    expect(restored[0]!.translations).toEqual([
      expect.objectContaining({ value: 'Hello', localeCode: 'en' }),
    ]);

    const deletedList = await trpc<WordRow[]>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, deleted: true },
      token: accessToken,
    });
    expect(deletedList).toHaveLength(0);
  });

  it('cannot touch words of a project the caller is not a member of', async () => {
    const alice = await createProjectWithLocale('alice@example.com');
    const bob = await login('bob@example.com');
    await expect(
      trpc(app, 'words.list', {
        kind: 'query',
        input: { projectId: alice.project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
