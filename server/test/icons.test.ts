import { eq } from 'drizzle-orm';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { projects } from '../src/db/schema.js';
import { fetchAndStoreIcon } from '../src/services/icons.js';
import { openTestDb, resetDb, seedProject, seedUser, type TestApp } from './helpers.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const ICO = Buffer.from([0, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 24, 0, 48, 0]);

const handle = openTestDb();

let iconsDir: string;
let fixture: Server;
let baseUrl: string;
let app: TestApp;

beforeAll(async () => {
  iconsDir = await mkdtemp(join(tmpdir(), 'slang-icons-'));
  // env.ts parses once at import time; point its icons dir at our tmp dir.
  const { env } = await import('../src/env.js');
  env.ICONS_DIR = iconsDir;
  const { createApp } = await import('../src/app.js');
  app = createApp(handle.db);

  fixture = createServer((req, res) => {
    switch (req.url) {
      case '/':
        res.end(
          '<html><head><link rel="icon" type="image/png" href="/icon.png"></head><body></body></html>',
        );
        break;
      case '/icon.png':
        res.setHeader('content-type', 'image/png');
        res.end(PNG);
        break;
      case '/plain':
        res.end('<html><head></head><body></body></html>');
        break;
      case '/favicon.ico':
        res.setHeader('content-type', 'image/x-icon');
        res.end(ICO);
        break;
      default:
        res.statusCode = 404;
        res.end();
    }
  });
  await new Promise<void>((resolve) => fixture.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(fixture.address() as AddressInfo).port}`;
});

beforeEach(() => resetDb(handle));

afterAll(async () => {
  fixture.close();
  await rm(iconsDir, { recursive: true, force: true });
  await handle.close();
});

async function iconMimeOf(projectId: number): Promise<string | null> {
  const [row] = await handle.db
    .select({ iconMimeType: projects.iconMimeType })
    .from(projects)
    .where(eq(projects.id, projectId));
  return row?.iconMimeType ?? null;
}

describe('project icons', () => {
  it('fetches the linked icon, stores it and serves it', async () => {
    const user = await seedUser(handle);
    const project = await seedProject(handle, user);
    await handle.db.update(projects).set({ url: baseUrl }).where(eq(projects.id, project.id));

    const mime = await fetchAndStoreIcon(handle.db, project.id, baseUrl, iconsDir);
    expect(mime).toBe('image/png');
    expect(await iconMimeOf(project.id)).toBe('image/png');

    const res = await app.request(`/api/projects/${project.id}/icon`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
  });

  it('falls back to /favicon.ico when the page declares no icon', async () => {
    const user = await seedUser(handle, 'bob@example.com');
    const project = await seedProject(handle, user, 'Plain');
    await handle.db
      .update(projects)
      .set({ url: `${baseUrl}/plain` })
      .where(eq(projects.id, project.id));

    const mime = await fetchAndStoreIcon(handle.db, project.id, `${baseUrl}/plain`, iconsDir);
    expect(mime).toBe('image/x-icon');
    expect(await iconMimeOf(project.id)).toBe('image/x-icon');
  });

  it('clears the icon and 404s when nothing can be fetched', async () => {
    const user = await seedUser(handle, 'carol@example.com');
    const project = await seedProject(handle, user, 'Empty');

    const mime = await fetchAndStoreIcon(handle.db, project.id, 'http://127.0.0.1:1/', iconsDir);
    expect(mime).toBeNull();
    expect(await iconMimeOf(project.id)).toBeNull();

    const res = await app.request(`/api/projects/${project.id}/icon`);
    expect(res.status).toBe(404);
  });
});
