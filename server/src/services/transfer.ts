import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { locales, projectsToLocales } from '../db/schema.js';
import { parseCsv, serializeCsv, CsvParseError } from '../lib/csv.js';
import { listWords, upsertWordCore } from './words.js';

export interface ExportWordsOptions {
  projectId: number;
  localeIds: number[];
  /** When true, only keys missing a translation in at least one selected locale. */
  missingOnly: boolean;
  /** Cell separator: `,` or `;` (spreadsheet exports). */
  separator: string;
  /** When set, only these keys are exported. */
  wordIds?: number[];
}

/**
 * Builds a CSV with a `key` column followed by one column per selected
 * locale code.
 */
export async function exportWordsCsv(db: Database, options: ExportWordsOptions): Promise<string> {
  const rows = await db
    .select({ id: locales.id, code: locales.code })
    .from(projectsToLocales)
    .innerJoin(locales, eq(projectsToLocales.localeId, locales.id))
    .where(
      and(
        eq(projectsToLocales.projectId, options.projectId),
        inArray(projectsToLocales.localeId, options.localeIds),
      ),
    );
  const requestedLocaleIds = new Set(options.localeIds);
  if (
    requestedLocaleIds.size !== options.localeIds.length ||
    rows.length !== requestedLocaleIds.size
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'locale_not_in_project' });
  }  const codesById = new Map(rows.map((row) => [row.id, row.code]));
  // Keep the caller's locale order.
  const selected = options.localeIds.map((id) => ({ id, code: codesById.get(id)! }));

  // Export covers every key; page through the listing.
  const list: Awaited<ReturnType<typeof listWords>>['items'] = [];
  let cursor: number | null = 0;
  while (cursor !== null) {
    const page = await listWords(db, { projectId: options.projectId, cursor, limit: 1000 });
    list.push(...page.items);
    cursor = page.nextCursor;
  }

  const csvRows: string[][] = [['key', ...selected.map((locale) => locale.code)]];
  const wordIds = options.wordIds ? new Set(options.wordIds) : null;
  for (const word of list) {
    if (wordIds && !wordIds.has(word.id)) continue;
    const values = selected.map((locale) => {
      const match = word.translations.find((t) => t.localeId === locale.id);
      return match?.value ?? '';
    });
    if (options.missingOnly && values.every((value) => value !== '')) continue;
    csvRows.push([word.key, ...values]);
  }
  return serializeCsv(csvRows, options.separator);
}

export interface ImportWordsResult {
  keys: number;
}

/**
 * Creates/updates keys and translations from a CSV whose header is `key`
 * followed by locale codes. Never deletes anything; empty cells are skipped.
 * Locale codes must exist in the catalog; known ones are attached to the
 * project automatically. Runs as a single transaction.
 */
export async function importWordsCsv(
  db: Database,
  projectId: number,
  csv: string,
  changedById: number,
  separator = ',',
): Promise<ImportWordsResult> {
  let rows: string[][];
  try {
    rows = parseCsv(csv, separator);
  } catch (error) {
    if (error instanceof CsvParseError) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `csv_malformed:${error.message}` });
    }
    throw error;
  }
  const header = rows[0]?.map((cell) => cell.trim());
  // Spreadsheets often export a trailing separator, leaving an empty last
  // header cell; drop those instead of rejecting the file.
  while (header && header.length > 1 && header[header.length - 1] === '') {
    header.pop();
  }
  if (!header || header[0]?.toLowerCase() !== 'key' || header.length < 2) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'csv_header_invalid' });
  }
  const codes = header.slice(1);
  if (new Set(codes).size !== codes.length || codes.some((code) => code === '')) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'csv_header_invalid' });
  }

  return db.transaction(async (tx) => {
    const localeRows = await tx
      .select({ id: locales.id, code: locales.code })
      .from(locales)
      .where(inArray(locales.code, codes));
    const idsByCode = new Map(localeRows.map((row) => [row.code, row.id]));
    for (const code of codes) {
      if (!idsByCode.has(code)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `unknown_locale:${code}` });
      }
    }
    for (const code of codes) {
      await tx
        .insert(projectsToLocales)
        .values({ projectId, localeId: idsByCode.get(code)! })
        .onConflictDoNothing();
    }

    let keys = 0;
    for (const row of rows.slice(1)) {
      const key = (row[0] ?? '').trim();
      if (!key) continue;
      await upsertWordCore(tx, {
        projectId,
        key,
        changedById,
        translations: codes.map((code, index) => ({
          localeId: idsByCode.get(code)!,
          value: row[index + 1] ?? '',
        })),
      });
      keys += 1;
    }
    return { keys };
  });
}
