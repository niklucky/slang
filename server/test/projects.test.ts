import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import {
  channels,
  projects,
  projectsToLocales,
  Role,
  translationVersions,
  translations,
  usersToProjects,
  wordVersions,
  words,
  type Project,
} from '../src/db/schema.js';
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
  members: Array<{ name: string }>;
}

interface ProjectListItem extends Project {
  wordCount: number;
  localeCount: number;
  untranslatedCount: number;
  members: Array<{ name: string }>;
  /** Dates travel as ISO strings over the plain-JSON tRPC link. */
  lastActivityAt: string | Date;
}

interface WordRow {
  id: number;
  key: string;
  deletedAt: string | null;
  translations: Array<{ value: string; localeCode: string; channelId: number }>;
}

interface WordsPage {
  items: WordRow[];
  total: number;
  nextCursor: number | null;
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
    expect(details.members).toEqual([{ name: 'alice' }]);
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

  it('delete hides the project and its API key; restore brings both back', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Demo', url: 'https://demo.dev' },
      token: accessToken,
    });

    await trpc(app, 'projects.delete', {
      input: { projectId: project.id },
      token: accessToken,
    });

    const live = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      token: accessToken,
    });
    expect(live).toHaveLength(0);

    // A deleted project's API key stops working.
    const blocked = await app.request('/api/translations', {
      headers: { 'x-api-key': project.apiKey },
    });
    expect(blocked.status).toBe(401);

    const withDeleted = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      input: { includeDeleted: true },
      token: accessToken,
    });
    expect(withDeleted).toHaveLength(1);
    expect(withDeleted[0]!.deletedAt).not.toBeNull();

    await trpc(app, 'projects.restore', {
      input: { projectId: project.id },
      token: accessToken,
    });

    const restored = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      token: accessToken,
    });
    expect(restored).toHaveLength(1);
    expect(restored[0]!.deletedAt).toBeNull();
    const ok = await app.request('/api/translations', {
      headers: { 'x-api-key': project.apiKey },
    });
    expect(ok.status).toBe(200);

    // Restoring a live project is a NOT_FOUND, not a silent no-op.
    await expect(
      trpc(app, 'projects.restore', {
        input: { projectId: project.id },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('delete, restore and deletePermanently are owner-only', async () => {
    const alice = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Team', url: null },
      token: alice.accessToken,
    });
    const bob = await login('bob@example.com');
    await handle.db.insert(usersToProjects).values({
      projectId: project.id,
      userId: bob.user.id,
      assignedById: alice.user.id,
      roleId: Role.EDITOR,
    });

    await expect(
      trpc(app, 'projects.delete', {
        input: { projectId: project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await trpc(app, 'projects.delete', {
      input: { projectId: project.id },
      token: alice.accessToken,
    });

    // Members keep their membership row but cannot restore or purge.
    await expect(
      trpc(app, 'projects.restore', {
        input: { projectId: project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      trpc(app, 'projects.deletePermanently', {
        input: { projectId: project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    // Strangers cannot even tell the project exists.
    const carol = await login('carol@example.com');
    await expect(
      trpc(app, 'projects.restore', {
        input: { projectId: project.id },
        token: carol.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deletePermanently removes the project and all of its data', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Doomed', url: null },
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
    await trpc(app, 'locales.add', {
      input: { projectId: project.id, localeId: en.id },
      token: accessToken,
    });
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });

    // Live projects cannot be purged directly.
    await expect(
      trpc(app, 'projects.deletePermanently', {
        input: { projectId: project.id },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    await trpc(app, 'projects.delete', {
      input: { projectId: project.id },
      token: accessToken,
    });
    await trpc(app, 'projects.deletePermanently', {
      input: { projectId: project.id },
      token: accessToken,
    });

    expect(await handle.db.select().from(projects)).toHaveLength(0);
    expect(await handle.db.select().from(usersToProjects)).toHaveLength(0);
    expect(await handle.db.select().from(projectsToLocales)).toHaveLength(0);
    expect(await handle.db.select().from(channels)).toHaveLength(0);
    expect(await handle.db.select().from(words)).toHaveLength(0);
    expect(await handle.db.select().from(translations)).toHaveLength(0);
    expect(await handle.db.select().from(translationVersions)).toHaveLength(0);
    expect(await handle.db.select().from(wordVersions)).toHaveLength(0);

    await expect(
      trpc(app, 'projects.deletePermanently', {
        input: { projectId: project.id },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('list with includeDeleted returns deleted projects only to their owner', async () => {
    const alice = await login('alice@example.com');
    const bob = await login('bob@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Mine', url: null },
      token: alice.accessToken,
    });
    await handle.db.insert(usersToProjects).values({
      projectId: project.id,
      userId: bob.user.id,
      assignedById: alice.user.id,
      roleId: Role.EDITOR,
    });
    await trpc(app, 'projects.delete', {
      input: { projectId: project.id },
      token: alice.accessToken,
    });

    const aliceList = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      input: { includeDeleted: true },
      token: alice.accessToken,
    });
    expect(aliceList).toHaveLength(1);
    expect(aliceList[0]!.deletedAt).not.toBeNull();

    const bobList = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      input: { includeDeleted: true },
      token: bob.accessToken,
    });
    expect(bobList).toHaveLength(0);
  });

  it('get on a deleted project works for the owner; members get NOT_FOUND', async () => {
    const alice = await login('alice@example.com');
    const bob = await login('bob@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Hidden', url: null },
      token: alice.accessToken,
    });
    await handle.db.insert(usersToProjects).values({
      projectId: project.id,
      userId: bob.user.id,
      assignedById: alice.user.id,
      roleId: Role.EDITOR,
    });
    await trpc(app, 'projects.delete', {
      input: { projectId: project.id },
      token: alice.accessToken,
    });

    const details = await trpc<ProjectDetails>(app, 'projects.get', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    expect(details.project.deletedAt).not.toBeNull();

    await expect(
      trpc(app, 'projects.get', {
        kind: 'query',
        input: { projectId: project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
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

  it('list is sorted by id desc and includes the owner as the only member', async () => {
    const { accessToken } = await login('alice@example.com');
    const first = await trpc<Project>(app, 'projects.create', {
      input: { name: 'First', url: null },
      token: accessToken,
    });
    const second = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Second', url: null },
      token: accessToken,
    });

    const projects = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      token: accessToken,
    });
    expect(projects.map((project) => project.id)).toEqual([second.id, first.id]);
    expect(projects[0]!.members).toEqual([{ name: 'alice' }]);
    expect(new Date(projects[0]!.lastActivityAt).getTime()).not.toBeNaN();
  });

  it('list members are the owner first, then the rest by join order', async () => {
    const alice = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Team', url: null },
      token: alice.accessToken,
    });
    const bob = await seedUser(handle, 'bob@example.com');
    const carol = await seedUser(handle, 'carol@example.com');
    // Carol joined later than Bob; the memberships carry explicit join times.
    await handle.db.insert(usersToProjects).values([
      {
        projectId: project.id,
        userId: bob.id,
        assignedById: alice.user.id,
        roleId: Role.EDITOR,
        assignedAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        projectId: project.id,
        userId: carol.id,
        assignedById: alice.user.id,
        roleId: Role.TRANSLATOR,
        assignedAt: new Date('2026-01-02T00:00:00Z'),
      },
    ]);

    const projects = await trpc<ProjectListItem[]>(app, 'projects.list', {
      kind: 'query',
      token: alice.accessToken,
    });
    expect(projects[0]!.members.map((member) => member.name)).toEqual([
      'alice',
      'bob',
      'carol',
    ]);
  });

  it('list lastActivityAt moves forward when a key is added', async () => {
    const { accessToken } = await login('alice@example.com');
    const project = await trpc<Project>(app, 'projects.create', {
      input: { name: 'Active', url: null },
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
    await trpc(app, 'locales.add', {
      input: { projectId: project.id, localeId: en.id },
      token: accessToken,
    });

    const listProject = async () => {
      const projects = await trpc<ProjectListItem[]>(app, 'projects.list', {
        kind: 'query',
        token: accessToken,
      });
      return projects.find(({ id }) => id === project.id)!;
    };

    const before = new Date((await listProject()).lastActivityAt).getTime();
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });
    const after = new Date((await listProject()).lastActivityAt).getTime();
    expect(after).toBeGreaterThan(before);
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

    const list = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    expect(list).toHaveLength(1);
    expect(list[0]!.key).toBe('greeting');
    expect(list[0]!.translations).toEqual([
      expect.objectContaining({ value: 'Hello', localeCode: 'en' }),
    ]);

    // Search index covers values, not just keys.
    const searched = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, search: 'hello' },
      token: accessToken,
    })).items;
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
    const list = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;

    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId: list[0]!.id },
      token: accessToken,
    });
    const after = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
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
    const list = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    const target = list.find((word) => word.key === 'greeting')!;
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId: target.id },
      token: accessToken,
    });

    const live = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    expect(live.map((word) => word.key)).toEqual(['farewell']);
    expect(live[0]!.deletedAt).toBeNull();

    const deleted = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, deleted: true },
      token: accessToken,
    })).items;
    expect(deleted).toHaveLength(1);
    expect(deleted[0]!.key).toBe('greeting');
    expect(deleted[0]!.deletedAt).not.toBeNull();
    // Soft-deleted words carry soft-deleted translations; they must still load.
    expect(deleted[0]!.translations).toEqual([
      expect.objectContaining({ value: 'greeting', localeCode: 'en' }),
    ]);
  });

  it('removePermanently rejects a live word and leaves it unchanged', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, channelId, value: 'Hello' }],
      },
      token: accessToken,
    });
    const list = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    const wordId = list[0]!.id;

    await expect(
      trpc(app, 'words.removePermanently', {
        input: { projectId: project.id, wordId },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    const after = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    expect(after).toHaveLength(1);
    expect(after[0]!.translations).toEqual([
      expect.objectContaining({ value: 'Hello', localeCode: 'en' }),
    ]);
    expect(await handle.db.select().from(words)).toHaveLength(1);
    expect(await handle.db.select().from(translations)).toHaveLength(1);
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
    const list = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    const wordId = list[0]!.id;
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    await trpc(app, 'words.removePermanently', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    const deletedList = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, deleted: true },
      token: accessToken,
    })).items;
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
    const list = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    const wordId = list[0]!.id;
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    await trpc(app, 'words.restore', {
      input: { projectId: project.id, wordId },
      token: accessToken,
    });

    const restored = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id },
      token: accessToken,
    })).items;
    expect(restored).toHaveLength(1);
    expect(restored[0]!.key).toBe('greeting');
    expect(restored[0]!.deletedAt).toBeNull();
    expect(restored[0]!.translations).toEqual([
      expect.objectContaining({ value: 'Hello', localeCode: 'en' }),
    ]);

    const deletedList = (await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, deleted: true },
      token: accessToken,
    })).items;
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

  it('list paginates with limit/cursor and total reflects the search filter', async () => {
    const { accessToken, project, en, channelId } = await createProjectWithLocale('alice@example.com');
    for (const key of ['alpha', 'beta', 'gamma']) {
      await trpc(app, 'words.upsert', {
        input: {
          projectId: project.id,
          key,
          translations: [{ localeId: en.id, channelId, value: key }],
        },
        token: accessToken,
      });
    }

    const first = await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, limit: 2 },
      token: accessToken,
    });
    expect(first.items).toHaveLength(2);
    expect(first.total).toBe(3);
    expect(first.nextCursor).toBe(2);

    const second = await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, limit: 2, cursor: first.nextCursor },
      token: accessToken,
    });
    expect(second.items).toHaveLength(1);
    expect(second.total).toBe(3);
    expect(second.nextCursor).toBeNull();

    const keys = [...first.items, ...second.items].map((word) => word.key).sort();
    expect(keys).toEqual(['alpha', 'beta', 'gamma']);

    const searched = await trpc<WordsPage>(app, 'words.list', {
      kind: 'query',
      input: { projectId: project.id, search: 'beta' },
      token: accessToken,
    });
    expect(searched.items).toHaveLength(1);
    expect(searched.total).toBe(1);
  });
});
