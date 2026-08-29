/**
 * `slang` — pulls locale files out of the Slang service, pushes them back.
 *
 * Depends on nothing but Node itself: `parseArgs`, global `fetch`, `node:fs`.
 */
import type { Dirent } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';

import { DEFAULT_API_URL, createClient, unwrapDictionary } from './client.js';
import type { Resources } from './types.js';

const USAGE = `slang — pull and push translations for the Slang service

Usage:
  slang pull <locale...> [options]
  slang pull --all [options]
  slang push <file...> [options]
  slang push --in <dir> [options]

Options:
  --out <dir>      Directory to write <locale>.json into       (pull; default ./src/locales)
  --in <dir>       Directory to read every <locale>.json from  (push; default ./src/locales)
  --locale <code>  Locale code for every pushed file           (push; default: <code>.json filename)
  --namespace <ns> Namespace to attach the pushed keys to      (push)
  --url <url>      API origin        (default $SLANG_API_URL || ${DEFAULT_API_URL})
  --key <key>      API key, sent as x-api-key    (default $SLANG_API_KEY)
  --all            Every locale the project has, one file each (pull)
  --timeout <ms>   Per-request timeout                            (default 30000)
  -h, --help       Show this message

Pull writes files flat and unwrapped: { "key": "value" }.
Push accepts the same shape — or { "<locale>": { ... } } — and upserts it;
empty values are skipped, existing keys keep their other locales.
`;

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: 'string', default: './src/locales' },
        in: { type: 'string' },
        locale: { type: 'string' },
        namespace: { type: 'string' },
        url: { type: 'string' },
        key: { type: 'string' },
        all: { type: 'boolean', default: false },
        timeout: { type: 'string', default: '30000' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${USAGE}`);
    return 1;
  }

  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;

  if (values.help || !command) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }
  if (command !== 'pull' && command !== 'push') {
    process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
    return 1;
  }

  const apiUrl = values.url ?? process.env['SLANG_API_URL'] ?? DEFAULT_API_URL;
  const apiKey = values.key ?? process.env['SLANG_API_KEY'];
  const timeout = Number.parseInt(values.timeout ?? '30000', 10);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    process.stderr.write(`--timeout must be a positive number of milliseconds\n`);
    return 1;
  }

  const client = createClient({
    apiUrl,
    ...(apiKey ? { apiKey } : {}),
    fetchTimeoutMs: timeout,
  });

  try {
    if (command === 'pull') return await pull(client, rest, values);
    return await push(client, rest, values);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (!apiKey) {
      process.stderr.write('No API key given. Pass --key or set SLANG_API_KEY.\n');
    }
    return 1;
  }
}

interface PullValues {
  out?: string;
  all: boolean;
}

async function pull(
  client: ReturnType<typeof createClient>,
  locales: string[],
  values: PullValues,
): Promise<number> {
  if (!values.all && locales.length === 0) {
    process.stderr.write(`No locales given. Pass locale codes or --all.\n\n${USAGE}`);
    return 1;
  }

  const outDir = resolvePath(process.cwd(), values.out ?? './src/locales');

  const fetched: Resources = values.all
    ? await client.fetchAll()
    : Object.fromEntries(
        await Promise.all(
          locales.map(async (locale) => [locale, await client.fetchDictionary(locale)] as const),
        ),
      );

  const entries = Object.entries(fetched);
  if (entries.length === 0) {
    process.stderr.write('Server returned no locales.\n');
    return 1;
  }

  await mkdir(outDir, { recursive: true });
  for (const [locale, dictionary] of entries) {
    const file = resolvePath(outDir, `${locale}.json`);
    // Sorted keys keep the diff readable when only one string changed.
    const sorted = Object.fromEntries(
      Object.entries(dictionary).sort(([a], [b]) => a.localeCompare(b)),
    );
    await writeFile(file, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
    process.stdout.write(`${locale}: ${Object.keys(sorted).length} keys -> ${file}\n`);
  }
  return 0;
}

interface PushValues {
  in?: string;
  locale?: string;
  namespace?: string;
}

async function push(
  client: ReturnType<typeof createClient>,
  positionalFiles: string[],
  values: PushValues,
): Promise<number> {
  // Explicit files are pushed as-is. `--in <dir>` adds every <locale>.json it
  // holds; with no explicit files it defaults to the directory `pull` writes to.
  const inDir = values.in ?? (positionalFiles.length === 0 ? './src/locales' : undefined);

  const files = [...positionalFiles];
  if (inDir !== undefined) {
    const dirPath = resolvePath(process.cwd(), inDir);
    let entries: Dirent[];
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      process.stderr.write(`Cannot read ${dirPath}: ${(error as Error).message}\n`);
      return 1;
    }
    for (const name of entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort()) {
      files.push(resolvePath(dirPath, name));
    }
  }

  if (files.length === 0) {
    process.stderr.write(
      `No files given. Pass one or more <locale>.json files, or a directory via --in.\n\n${USAGE}`,
    );
    return 1;
  }

  for (const file of files) {
    const filePath = resolvePath(process.cwd(), file);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch (error) {
      process.stderr.write(`Cannot read ${filePath}: ${(error as Error).message}\n`);
      return 1;
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      process.stderr.write(`${filePath} is not valid JSON\n`);
      return 1;
    }

    const locale = values.locale ?? basename(filePath, '.json');
    const dictionary = unwrapDictionary(body, locale);
    if (Object.keys(dictionary).length === 0) {
      process.stderr.write(`${filePath} holds no string entries; nothing to push\n`);
      return 1;
    }

    await client.pushLocale(locale, dictionary, {
      ...(values.namespace ? { namespace: values.namespace } : {}),
    });
    process.stdout.write(`Locale ${locale} pushed to server\n`);
  }
  return 0;
}

// Only self-executes as a program; importing this module for tests does not run it.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  });
}
