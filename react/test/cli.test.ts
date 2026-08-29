import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
    expect(await main(['sync', 'en'])).toBe(1);
    expect(stderr).toContain('Unknown command: sync');

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

describe('slang push', () => {
  async function writeLocaleFile(locale: string, body: unknown): Promise<string> {
    const file = join(out, `${locale}.json`);
    await writeFile(file, JSON.stringify(body), 'utf8');
    return file;
  }

  function pushCall(fetchImpl: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    return { url: String(call[0]), init: call[1] };
  }

  it('pushes a flat file, inferring the locale from the filename', async () => {
    const fetchImpl = stubServer({ data: { keys: 2 }, error: null });
    const file = await writeLocaleFile('en', { hello: 'Hello', bye: 'Bye' });

    expect(await main(['push', file, '--key', 'k'])).toBe(0);

    const { url, init } = pushCall(fetchImpl);
    expect(url.endsWith('/api/translations/push')).toBe(true);
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ 'x-api-key': 'k', 'content-type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({
      locale: 'en',
      translations: { hello: 'Hello', bye: 'Bye' },
    });
    expect(stdout).toContain('Locale en pushed to server');
  });

  it('accepts the wrapped { locale: {...} } shape', async () => {
    const fetchImpl = stubServer({ data: { keys: 1 }, error: null });
    const file = await writeLocaleFile('de', { de: { hello: 'Hallo' } });

    expect(await main(['push', file, '--key', 'k'])).toBe(0);
    expect(JSON.parse(String(pushCall(fetchImpl).init.body))).toEqual({
      locale: 'de',
      translations: { hello: 'Hallo' },
    });
  });

  it('--locale wins over the filename', async () => {
    const fetchImpl = stubServer({ data: { keys: 1 }, error: null });
    const file = await writeLocaleFile('whatever', { a: 'b' });

    expect(await main(['push', file, '--locale', 'fr', '--key', 'k'])).toBe(0);
    expect(JSON.parse(String(pushCall(fetchImpl).init.body)).locale).toBe('fr');
  });

  it('forwards --namespace', async () => {
    const fetchImpl = stubServer({ data: { keys: 1 }, error: null });
    const file = await writeLocaleFile('en', { a: 'b' });

    expect(await main(['push', file, '--key', 'k', '--namespace', 'common'])).toBe(0);
    expect(JSON.parse(String(pushCall(fetchImpl).init.body))).toEqual({
      locale: 'en',
      namespace: 'common',
      translations: { a: 'b' },
    });
  });

  it('pushes several files in order', async () => {
    const fetchImpl = stubServer({ data: { keys: 1 }, error: null });
    const en = await writeLocaleFile('en', { a: '1' });
    const ru = await writeLocaleFile('ru', { a: '2' });

    expect(await main(['push', en, ru, '--key', 'k'])).toBe(0);
    const bodies = fetchImpl.mock.calls.map(
      (call) => JSON.parse(String((call as unknown as [string, RequestInit])[1].body)).locale,
    );
    expect(bodies).toEqual(['en', 'ru']);
  });

  it('rejects missing files, broken JSON and empty dictionaries', async () => {
    stubServer({ data: { keys: 0 }, error: null });

    expect(await main(['push', join(out, 'missing.json'), '--key', 'k'])).toBe(1);
    expect(stderr).toContain('Cannot read');

    const broken = join(out, 'broken.json');
    await writeFile(broken, '{ nope', 'utf8');
    expect(await main(['push', broken, '--key', 'k'])).toBe(1);
    expect(stderr).toContain('not valid JSON');

    const empty = await writeLocaleFile('en', {});
    expect(await main(['push', empty, '--key', 'k'])).toBe(1);
    expect(stderr).toContain('nothing to push');
  });

  it('rejects a push with nothing to send', async () => {
    const emptyDir = join(out, 'empty');
    await mkdir(emptyDir);
    expect(await main(['push', '--in', emptyDir, '--key', 'k'])).toBe(1);
    expect(stderr).toContain('No files given');
  });

  it('reports an upstream failure', async () => {
    stubServer({ data: null, error: { message: 'locale_not_found' } }, 400);
    const file = await writeLocaleFile('xx', { a: 'b' });

    expect(await main(['push', file, '--key', 'k'])).toBe(1);
    expect(stderr).toContain('400');
  });
});

describe('slang push --in', () => {
  function pushBodies(fetchImpl: ReturnType<typeof vi.fn>): Record<string, unknown>[] {
    return fetchImpl.mock.calls.map((call) =>
      JSON.parse(String((call as unknown as [string, RequestInit])[1].body)) as Record<
        string,
        unknown
      >,
    );
  }

  it('pushes every .json file in the directory, sorted, logging each locale', async () => {
    const dir = join(out, 'locales');
    await mkdir(dir);
    // Written out of order to prove the push is sorted by filename.
    await writeFile(join(dir, 'ru.json'), JSON.stringify({ a: '2' }), 'utf8');
    await writeFile(join(dir, 'en.json'), JSON.stringify({ a: '1' }), 'utf8');
    await writeFile(join(dir, 'notes.txt'), 'not a locale file', 'utf8');

    const fetchImpl = stubServer({ data: { keys: 1 }, error: null });
    expect(await main(['push', '--in', dir, '--key', 'k'])).toBe(0);

    expect(pushBodies(fetchImpl).map((body) => body['locale'])).toEqual(['en', 'ru']);
    expect(stdout).toContain('Locale en pushed to server');
    expect(stdout).toContain('Locale ru pushed to server');
    expect(stdout).not.toContain('notes');
  });

  it('forwards --namespace for every file', async () => {
    const dir = join(out, 'locales');
    await mkdir(dir);
    await writeFile(join(dir, 'en.json'), JSON.stringify({ a: '1' }), 'utf8');
    await writeFile(join(dir, 'ru.json'), JSON.stringify({ a: '2' }), 'utf8');

    const fetchImpl = stubServer({ data: { keys: 1 }, error: null });
    expect(await main(['push', '--in', dir, '--key', 'k', '--namespace', 'app'])).toBe(0);
    for (const body of pushBodies(fetchImpl)) {
      expect(body).toMatchObject({ namespace: 'app' });
    }
  });

  it('fails when the directory does not exist', async () => {
    expect(await main(['push', '--in', join(out, 'missing'), '--key', 'k'])).toBe(1);
    expect(stderr).toContain('Cannot read');
  });

  it('fails when the directory holds no .json files', async () => {
    const dir = join(out, 'empty');
    await mkdir(dir);
    await writeFile(join(dir, 'readme.md'), '# no locales here', 'utf8');

    expect(await main(['push', '--in', dir, '--key', 'k'])).toBe(1);
    expect(stderr).toContain('No files given');
  });
});
