/**
 * `slang` — pulls locale files out of the Slang service into a project.
 *
 * Depends on nothing but Node itself: `parseArgs`, global `fetch`, `node:fs`.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';

import { DEFAULT_API_URL, createClient } from './client.js';
import type { Resources } from './types.js';

const USAGE = `slang — pull translations from the Slang service

Usage:
  slang pull <locale...> [options]
  slang pull --all [options]

Options:
  --out <dir>    Directory to write <locale>.json into   (default ./src/locales)
  --url <url>    API origin        (default $SLANG_API_URL || ${DEFAULT_API_URL})
  --key <key>    API key, sent as x-api-key    (default $SLANG_API_KEY)
  --all          Every locale the project has, one file each
  --timeout <ms> Per-request timeout                            (default 30000)
  -h, --help     Show this message

Files are written flat and unwrapped: { "key": "value" }.
`;

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        out: { type: 'string', default: './src/locales' },
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
  const [command, ...locales] = positionals;

  if (values.help || !command) {
    process.stdout.write(USAGE);
    return values.help ? 0 : 1;
  }
  if (command !== 'pull') {
    process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
    return 1;
  }
  if (!values.all && locales.length === 0) {
    process.stderr.write(`No locales given. Pass locale codes or --all.\n\n${USAGE}`);
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

  const outDir = resolvePath(process.cwd(), values.out ?? './src/locales');

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    if (!apiKey) {
      process.stderr.write('No API key given. Pass --key or set SLANG_API_KEY.\n');
    }
    return 1;
  }
}

// Only self-executes as a program; importing this module for tests does not run it.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().then((code) => {
    process.exitCode = code;
  });
}
