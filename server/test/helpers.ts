import { sql } from 'drizzle-orm';

import { createDb, type DbHandle } from '../src/db/client.js';
import type { Project, User } from '../src/db/schema.js';
import { hashPassword } from '../src/lib/password.js';
import { createProject } from '../src/services/projects.js';
import { testDbUrl } from './db-url.js';

export function openTestDb(): DbHandle {
  return createDb(testDbUrl());
}

/** Everything except the seeded locale catalog. */
const TABLES = [
  'translations',
  'words_to_namespaces',
  'words',
  'namespaces',
  'invitations',
  'projects_to_locales',
  'users_to_projects',
  'projects',
  'users',
];

export async function resetDb(handle: DbHandle): Promise<void> {
  await handle.db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`));
}

export async function seedUser(handle: DbHandle, email = 'alice@example.com'): Promise<User> {
  const { users } = await import('../src/db/schema.js');
  const name = email.split('@')[0] ?? email;
  const [user] = await handle.db
    .insert(users)
    .values({ email, name, password: await hashPassword('password123') })
    .returning();
  if (!user) throw new Error('seed_user_failed');
  return user;
}

export async function seedProject(handle: DbHandle, owner: User, name = 'Demo'): Promise<Project> {
  return createProject(handle.db, owner.id, { name, url: 'https://example.com' });
}

interface TrpcCallOptions {
  input?: unknown;
  token?: string;
  /** Queries go out as GET with `?input=`; mutations as POST with a JSON body. */
  kind?: 'query' | 'mutation';
}

export interface TestApp {
  request(path: string, init?: RequestInit): Response | Promise<Response>;
}

/** tRPC call through the Hono test client; unwraps `{ result: { data } }`. */
export async function trpc<T = unknown>(
  app: TestApp,
  path: string,
  options: TrpcCallOptions = {},
): Promise<T> {
  const kind = options.kind ?? 'mutation';
  const url =
    kind === 'query' && options.input !== undefined
      ? `/trpc/${path}?input=${encodeURIComponent(JSON.stringify(options.input))}`
      : `/trpc/${path}`;
  const response = await app.request(url, {
    ...(kind === 'mutation' && options.input !== undefined
      ? { method: 'POST', body: JSON.stringify(options.input) }
      : {}),
    headers: {
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
  });
  const body = (await response.json()) as {
    result?: { data?: T };
    error?: { message?: string; data?: { code?: string; httpStatus?: number } };
  };
  if (!response.ok || body.error) {
    const error = new Error(body.error?.message ?? `trpc ${path} failed`) as Error & {
      code?: string;
      httpStatus?: number;
    };
    error.code = body.error?.data?.code;
    error.httpStatus = body.error?.data?.httpStatus ?? response.status;
    throw error;
  }
  return body.result?.data as T;
}
