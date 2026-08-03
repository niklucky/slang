import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { main } from '../src/cli.js';

let out: string;
let stdout: string;
let stderr: string;

beforeEach(async () => {
  out = await mkdtemp(join(tmpdir(), 'slang-cli-'));
  stdout = '';
  stderr = '';
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env['SLANG_API_KEY'];
  delete process.env['SLANG_API_URL'];
  await rm(out, { recursive: true, force: true });
});

function stubServer(body: unknown, status = 200) {
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal('fetch', fetchImpl);
  return fetchImpl;
}

const readJson = async (locale: string) =>
  JSON.parse(await readFile(join(out, `${locale}.json`), 'utf8')) as Record<string, string>;

describe('slang pull', () => {
  it('writes a flat, unwrapped, key-sorted file', async () => {
    stubServer({ en: { zebra: 'Zebra', apple: 'Apple' } });

    expect(await main(['pull', 'en', '--out', out])).toBe(0);
    expect(await readJson('en')).toEqual({ apple: 'Apple', zebra: 'Zebra' });
    expect(Object.keys(await readJson('en'))).toEqual(['apple', 'zebra']);
    expect(stdout).toContain('en: 2 keys');
  });

  it('writes one file per locale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => ({
        ok: true,
        status: 200,
        json: async () =>
          String(input).includes('locale=ru') ? { ru: { a: 'Р' } } : { en: { a: 'E' } },
      })),
    );

    expect(await main(['pull', 'en', 'ru', '--out', out])).toBe(0);
    expect(await readJson('en')).toEqual({ a: 'E' });
    expect(await readJson('ru')).toEqual({ a: 'Р' });
  });

  it('--all writes every locale the server returns', async () => {
    const fetchImpl = stubServer({ en: { a: '1' }, ru: { a: '2' } });

    expect(await main(['pull', '--all', '--out', out])).toBe(0);
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain('locale=');
    expect(await readJson('en')).toEqual({ a: '1' });
    expect(await readJson('ru')).toEqual({ a: '2' });
  });

  it('reads the key and url from the environment', async () => {
    process.env['SLANG_API_KEY'] = 'from-env';
    process.env['SLANG_API_URL'] = 'https://proxy.test';
    const fetchImpl = stubServer({ en: {} });

    await main(['pull', 'en', '--out', out]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url).startsWith('https://proxy.test/api/translations')).toBe(true);
    expect(init.headers).toMatchObject({ 'x-api-key': 'from-env' });
  });

  it('lets flags win over the environment', async () => {
    process.env['SLANG_API_KEY'] = 'from-env';
    const fetchImpl = stubServer({ en: {} });

    await main(['pull', 'en', '--out', out, '--key', 'from-flag', '--url', 'https://flag.test']);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url).startsWith('https://flag.test/')).toBe(true);
    expect(init.headers).toMatchObject({ 'x-api-key': 'from-flag' });
  });

  it('reports an upstream failure and hints at the missing key', async () => {
    stubServer({ message: 'api_key_invalid' }, 401);

    expect(await main(['pull', 'en', '--out', out])).toBe(1);
    expect(stderr).toContain('401');
    expect(stderr).toContain('SLANG_API_KEY');
  });

  it('does not hint about the key when one was supplied', async () => {
    stubServer({}, 500);

    expect(await main(['pull', 'en', '--out', out, '--key', 'k'])).toBe(1);
    expect(stderr).not.toContain('SLANG_API_KEY');
  });

  it('rejects a pull with neither locales nor --all', async () => {
    expect(await main(['pull', '--out', out])).toBe(1);
    expect(stderr).toContain('No locales given');
  });

  it('rejects an unknown command and prints usage for none', async () => {
    expect(await main(['push', 'en'])).toBe(1);
    expect(stderr).toContain('Unknown command: push');

    expect(await main([])).toBe(1);
    expect(stdout).toContain('Usage:');
  });

  it('exits 0 for --help', async () => {
    expect(await main(['--help'])).toBe(0);
    expect(stdout).toContain('Usage:');
  });

  it('rejects a non-numeric timeout', async () => {
    expect(await main(['pull', 'en', '--out', out, '--timeout', 'soon'])).toBe(1);
    expect(stderr).toContain('--timeout');
  });

  it('fails when the server returns no locales', async () => {
    stubServer({});
    expect(await main(['pull', '--all', '--out', out])).toBe(1);
    expect(stderr).toContain('no locales');
  });
});
