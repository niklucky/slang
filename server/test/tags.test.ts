import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { locales, projectsToLocales, Role, tags, usersToProjects, type Project } from '../src/db/schema.js';
import { openTestDb, resetDb, seedProject, seedUser, trpc } from './helpers.js';

const handle = openTestDb();
const app = createApp(handle.db);

beforeEach(() => resetDb(handle));
afterAll(() => handle.close());

interface WordRow {
  id: number;
  key: string;
  tags: Array<{ id: number; name: string }>;
}

interface WordsPage {
  items: WordRow[];
  total: number;
}

interface TagRow {
  id: number;
  name: string;
  wordCount: number;
}

async function setup(): Promise<{ project: Project; token: string; enId: number }> {
  const user = await seedUser(handle);
  const project = await seedProject(handle, user);
  const { accessToken } = await trpc<{ accessToken: string }>(app, 'auth.login', {
    input: { email: user.email, password: 'password123' },
  });
  const [en] = await handle.db.select({ id: locales.id }).from(locales).where(eq(locales.code, 'en'));
  await handle.db.insert(projectsToLocales).values({ projectId: project.id, localeId: en!.id });
  return { project, token: accessToken, enId: en!.id };
}

async function upsert(
  token: string,
  projectId: number,
  enId: number,
  key: string,
  value: string,
  tagNames?: string[],
): Promise<void> {
  await trpc(app, 'words.upsert', {
    input: {
      projectId,
      key,
      translations: [{ localeId: enId, value }],
      ...(tagNames ? { tags: tagNames } : {}),
    },
    token,
  });
}

async function list(token: string, projectId: number, tagIds?: number[]): Promise<WordsPage> {
  return trpc<WordsPage>(app, 'words.list', {
    kind: 'query',
    input: { projectId, ...(tagIds ? { tagIds } : {}) },
    token,
  });
}

async function tagList(token: string, projectId: number): Promise<TagRow[]> {
  return trpc<TagRow[]>(app, 'tags.list', { kind: 'query', input: { projectId }, token });
}

describe('tags', () => {
  it('upsert with tags creates them, normalized and deduped; list shows them', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'email_subject', 'Hi', [' Email', 'email', 'iOS App ']);

    const page = await list(token, project.id);
    expect(page.items[0]!.tags.map((tag) => tag.name)).toEqual(['email', 'ios app']);

    expect(await tagList(token, project.id)).toMatchObject([
      { name: 'email', wordCount: 1 },
      { name: 'ios app', wordCount: 1 },
    ]);
  });

  it('upsert without tags leaves existing tags alone (cell edits and CSV import)', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'k', 'v1', ['email']);
    await upsert(token, project.id, enId, 'k', 'v2');

    const page = await list(token, project.id);
    expect(page.items[0]!.tags.map((tag) => tag.name)).toEqual(['email']);
  });

  it('upsert with an empty tag list clears them and prunes the orphaned tag', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'k', 'v', ['email']);
    await upsert(token, project.id, enId, 'k', 'v', []);

    expect((await list(token, project.id)).items[0]!.tags).toEqual([]);
    expect(await tagList(token, project.id)).toEqual([]);
  });

  it('setTags replaces the set and keeps tags other words still use', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'a', 'A', ['email', 'shared']);
    await upsert(token, project.id, enId, 'b', 'B', ['shared']);
    const a = (await list(token, project.id)).items.find((word) => word.key === 'a')!;

    const result = await trpc<{ tags: string[] }>(app, 'words.setTags', {
      input: { projectId: project.id, wordId: a.id, tags: ['Push'] },
      token,
    });
    expect(result.tags).toEqual(['push']);

    const names = (await tagList(token, project.id)).map((tag) => tag.name);
    // `email` had only `a`; `shared` is still on `b`.
    expect(names).toEqual(['push', 'shared']);
  });

  it('list filters by any of the given tag ids', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'a', 'A', ['email']);
    await upsert(token, project.id, enId, 'b', 'B', ['push']);
    await upsert(token, project.id, enId, 'c', 'C');
    const byName = new Map((await tagList(token, project.id)).map((tag) => [tag.name, tag.id]));

    const email = await list(token, project.id, [byName.get('email')!]);
    expect(email.total).toBe(1);
    expect(email.items.map((word) => word.key)).toEqual(['a']);

    const both = await list(token, project.id, [byName.get('email')!, byName.get('push')!]);
    expect(both.items.map((word) => word.key).sort()).toEqual(['a', 'b']);
  });

  it('a permanently deleted word drops its links and prunes tags nothing else uses', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'a', 'A', ['email']);
    const a = (await list(token, project.id)).items[0]!;
    await trpc(app, 'words.remove', { input: { projectId: project.id, wordId: a.id }, token });
    // Soft-deleted words keep their tags, but do not count as carrying them.
    expect(await tagList(token, project.id)).toMatchObject([{ name: 'email', wordCount: 0 }]);

    await trpc(app, 'words.removePermanently', {
      input: { projectId: project.id, wordId: a.id },
      token,
    });
    expect(await handle.db.select().from(tags)).toEqual([]);
  });

  it('a translator can save values but not touch tags', async () => {
    const { project, token, enId } = await setup();
    await upsert(token, project.id, enId, 'k', 'v', ['email']);

    const translator = await seedUser(handle, 'bob@example.com');
    await handle.db.insert(usersToProjects).values({
      projectId: project.id,
      userId: translator.id,
      assignedById: project.ownerId,
      roleId: Role.TRANSLATOR,
      canCreateKeys: false,
      canTranslate: true,
      canDeleteKeys: false,
    });
    const { accessToken } = await trpc<{ accessToken: string }>(app, 'auth.login', {
      input: { email: translator.email, password: 'password123' },
    });

    // Values without tags: fine, and the tags stay.
    await upsert(accessToken, project.id, enId, 'k', 'v2');
    expect((await list(token, project.id)).items[0]!.tags.map((tag) => tag.name)).toEqual(['email']);

    // Any tag set, even the same one, needs the create-keys permission.
    await expect(upsert(accessToken, project.id, enId, 'k', 'v3', ['email'])).rejects.toThrow(
      'tag_keys_forbidden',
    );
    await expect(upsert(accessToken, project.id, enId, 'k', 'v3', [])).rejects.toThrow('tag_keys_forbidden');
    await expect(
      trpc(app, 'words.setTags', {
        input: { projectId: project.id, wordId: (await list(token, project.id)).items[0]!.id, tags: [] },
        token: accessToken,
      }),
    ).rejects.toThrow('tag_keys_forbidden');
  });

  it('rejects a tag longer than 64 characters', async () => {
    const { project, token, enId } = await setup();
    await expect(upsert(token, project.id, enId, 'k', 'v', ['x'.repeat(65)])).rejects.toThrow();
  });
});
