import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import type { Project } from '../src/db/schema.js';
import { openTestDb, resetDb, seedUser, trpc } from './helpers.js';

const handle = openTestDb();
const app = createApp(handle.db);

beforeEach(() => resetDb(handle));
afterAll(() => handle.close());

interface AuthResult {
  user: { id: number; email: string };
  accessToken: string;
}

async function login(email: string): Promise<AuthResult> {
  const user = await seedUser(handle, email);
  const result = await trpc<AuthResult>(app, 'auth.login', {
    input: { email, password: 'password123' },
  });
  return { user: { id: user.id, email }, accessToken: result.accessToken };
}

async function makeProjectWithLocales(token: string, codes: string[]) {
  const project = await trpc<Project>(app, 'projects.create', {
    input: { name: 'Demo', url: 'https://demo.dev' },
    token,
  });
  const catalog = await trpc<Array<{ id: number; code: string }>>(app, 'locales.catalog', {
    token,
    kind: 'query',
  });
  const localeIds: Record<string, number> = {};
  for (const code of codes) {
    const locale = catalog.find((entry) => entry.code === code)!;
    await trpc(app, 'locales.add', { input: { projectId: project.id, localeId: locale.id }, token });
    localeIds[code] = locale.id;
  }
  return { project, localeIds };
}

describe('words.exportCsv / importCsv', () => {
  it('round-trips keys and translations through CSV', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project, localeIds } = await makeProjectWithLocales(accessToken, ['en', 'de']);

    await trpc(app, 'words.importCsv', {
      input: {
        projectId: project.id,
        csv: ['key,en,de', 'hello,"Hello, world!",Hallo', 'bye,Bye,', 'multi,"line one\nline two",x'].join(
          '\n',
        ),
      },
      token: accessToken,
    });

    const exported = await trpc<{ csv: string }>(app, 'words.exportCsv', {
      input: { projectId: project.id, localeIds: [localeIds.en!, localeIds.de!], missingOnly: false },
      token: accessToken,
      kind: 'query',
    });
    const lines = exported.csv.split('\n');
    expect(lines[0]).toBe('key,en,de');
    expect(lines).toContain('hello,"Hello, world!",Hallo');
    expect(lines).toContain('bye,Bye,');
    expect(exported.csv).toContain('multi,"line one\nline two",x');

    const list = (
      await trpc<{
        items: Array<{ key: string; translations: Array<{ localeCode: string; value: string }> }>;
        total: number;
        nextCursor: number | null;
      }>(app, 'words.list', { input: { projectId: project.id }, token: accessToken, kind: 'query' })
    ).items;
    expect(list).toHaveLength(3);
    const bye = list.find((word) => word.key === 'bye')!;
    expect(bye.translations.find((t) => t.localeCode === 'de')).toBeUndefined();
  });

  it('updates existing values on re-import and never deletes keys', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project } = await makeProjectWithLocales(accessToken, ['en']);

    await trpc(app, 'words.importCsv', {
      input: { projectId: project.id, csv: 'key,en\nhello,Hello\nbye,Bye' },
      token: accessToken,
    });
    const result = await trpc<{ keys: number }>(app, 'words.importCsv', {
      input: { projectId: project.id, csv: 'key,en\nhello,Hi' },
      token: accessToken,
    });
    expect(result.keys).toBe(1);

    const list = (
      await trpc<{
        items: Array<{ key: string; translations: Array<{ value: string }> }>;
        total: number;
        nextCursor: number | null;
      }>(app, 'words.list', { input: { projectId: project.id }, token: accessToken, kind: 'query' })
    ).items;
    expect(list.map((word) => word.key).sort()).toEqual(['bye', 'hello']);
    expect(list.find((word) => word.key === 'hello')!.translations[0]!.value).toBe('Hi');
  });

  it('exports only keys missing a translation when missingOnly is set', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project, localeIds } = await makeProjectWithLocales(accessToken, ['en', 'de']);

    await trpc(app, 'words.importCsv', {
      input: { projectId: project.id, csv: 'key,en,de\nfull,Hello,Hallo\npartial,Hello,' },
      token: accessToken,
    });

    const exported = await trpc<{ csv: string }>(app, 'words.exportCsv', {
      input: { projectId: project.id, localeIds: [localeIds.en!, localeIds.de!], missingOnly: true },
      token: accessToken,
      kind: 'query',
    });
    expect(exported.csv).toBe('key,en,de\npartial,Hello,');
  });

  it('attaches catalog locales missing from the project and rejects unknown codes', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project } = await makeProjectWithLocales(accessToken, ['en']);

    const result = await trpc<{ keys: number }>(app, 'words.importCsv', {
      input: { projectId: project.id, csv: 'key,en,fr\nhello,Hello,Salut' },
      token: accessToken,
    });
    expect(result.keys).toBe(1);

    const details = await trpc<{ locales: Array<{ code: string }> }>(app, 'projects.get', {
      input: { projectId: project.id },
      token: accessToken,
      kind: 'query',
    });
    expect(details.locales.map((locale) => locale.code).sort()).toEqual(['en', 'fr']);

    await expect(
      trpc(app, 'words.importCsv', {
        input: { projectId: project.id, csv: 'key,not-a-locale\nhello,Hi' },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ message: 'unknown_locale:not-a-locale' });
  });

  it('round-trips with a semicolon separator', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project, localeIds } = await makeProjectWithLocales(accessToken, ['en', 'de']);

    await trpc(app, 'words.importCsv', {
      input: {
        projectId: project.id,
        csv: 'key;en;de\nhello;"Hello; world!";Hallo',
        separator: ';',
      },
      token: accessToken,
    });

    const exported = await trpc<{ csv: string }>(app, 'words.exportCsv', {
      input: {
        projectId: project.id,
        localeIds: [localeIds.en!, localeIds.de!],
        missingOnly: false,
        separator: ';',
      },
      token: accessToken,
      kind: 'query',
    });
    expect(exported.csv).toBe('key;en;de\nhello;"Hello; world!";Hallo');
  });

  it('ignores a trailing separator column from spreadsheet exports', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project } = await makeProjectWithLocales(accessToken, ['en']);

    const result = await trpc<{ keys: number }>(app, 'words.importCsv', {
      input: { projectId: project.id, csv: 'key;en;\r\nhello;Hi;\r\n', separator: ';' },
      token: accessToken,
    });
    expect(result.keys).toBe(1);

    const list = (
      await trpc<{
        items: Array<{ key: string; translations: Array<{ value: string }> }>;
        total: number;
        nextCursor: number | null;
      }>(app, 'words.list', { input: { projectId: project.id }, token: accessToken, kind: 'query' })
    ).items;
    expect(list.find((word) => word.key === 'hello')!.translations[0]!.value).toBe('Hi');
  });

  it('rejects malformed CSV and duplicate export locales', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project, localeIds } = await makeProjectWithLocales(accessToken, ['en']);

    await expect(
      trpc(app, 'words.importCsv', {
        input: { projectId: project.id, csv: 'key,en\nhello,"unterminated' },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ message: 'csv_malformed:unterminated_quoted_cell' });

    await expect(
      trpc(app, 'words.importCsv', {
        input: { projectId: project.id, csv: 'key,en\nhello,"Hi"stray' },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ message: 'csv_malformed:unexpected_character_after_quote' });

    await expect(
      trpc(app, 'words.exportCsv', {
        input: {
          projectId: project.id,
          localeIds: [localeIds.en!, localeIds.en!],
          missingOnly: false,
        },
        token: accessToken,
        kind: 'query',
      }),
    ).rejects.toMatchObject({ message: 'locale_not_in_project' });
  });

  it('escapes spreadsheet formulas on export', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project, localeIds } = await makeProjectWithLocales(accessToken, ['en']);

    await trpc(app, 'words.importCsv', {
      input: { projectId: project.id, csv: 'key,en\nhello,"=SUM(1,2)"' },
      token: accessToken,
    });

    const exported = await trpc<{ csv: string }>(app, 'words.exportCsv', {
      input: { projectId: project.id, localeIds: [localeIds.en!], missingOnly: false },
      token: accessToken,
      kind: 'query',
    });
    expect(exported.csv).toBe('key,en\nhello,"\'=SUM(1,2)"');
  });

  it('rejects a malformed header and an out-of-project export locale', async () => {
    const { accessToken } = await login('alice@example.com');
    const { project } = await makeProjectWithLocales(accessToken, ['en']);

    await expect(
      trpc(app, 'words.importCsv', {
        input: { projectId: project.id, csv: 'wrong,en\nhello,Hi' },
        token: accessToken,
      }),
    ).rejects.toMatchObject({ message: 'csv_header_invalid' });

    await expect(
      trpc(app, 'words.exportCsv', {
        input: { projectId: project.id, localeIds: [999999], missingOnly: false },
        token: accessToken,
        kind: 'query',
      }),
    ).rejects.toMatchObject({ message: 'locale_not_in_project' });
  });
});
