import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { openTestDb, resetDb, trpc } from './helpers.js';

const handle = openTestDb();
const app = createApp(handle.db);

beforeEach(() => resetDb(handle));
afterAll(() => handle.close());

interface AuthResult {
  user: { id: number; username: string; name: string };
  accessToken: string;
}

async function setup(): Promise<AuthResult> {
  return trpc<AuthResult>(app, 'auth.setup', {
    input: { name: 'Alice', username: 'alice', password: 'password123' },
  });
}

describe('auth.setup', () => {
  it('creates the first user and returns a token', async () => {
    const result = await setup();
    expect(result.user.username).toBe('alice');
    expect(typeof result.accessToken).toBe('string');
    expect(result.user).not.toHaveProperty('password');
  });

  it('locks once a user exists', async () => {
    await setup();
    await expect(
      trpc(app, 'auth.setup', {
        input: { name: 'Bob', username: 'bob', password: 'password123' },
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('account_set_up') });
  });
});

describe('auth.login', () => {
  it('rejects a wrong password', async () => {
    await setup();
    await expect(
      trpc(app, 'auth.login', { input: { username: 'alice', password: 'wrong-password' } }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects an unknown user', async () => {
    await setup();
    await expect(
      trpc(app, 'auth.login', { input: { username: 'nobody', password: 'password123' } }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns a token usable on auth.me', async () => {
    await setup();
    const login = await trpc<AuthResult>(app, 'auth.login', {
      input: { username: 'alice', password: 'password123' },
    });
    const me = await trpc<{ username: string }>(app, 'auth.me', { token: login.accessToken });
    expect(me.username).toBe('alice');
  });

  it('accepts a bare token in Authorization (old-server parity)', async () => {
    const { accessToken } = await setup();
    const response = await app.request('/trpc/auth.me', {
      headers: { authorization: accessToken },
    });
    expect(response.status).toBe(200);
  });

  it('rejects auth.me without a token', async () => {
    await setup();
    await expect(trpc(app, 'auth.me', { kind: 'query' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
