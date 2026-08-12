import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { channels, locales, projectsToLocales } from '../db/schema.js';
import { parseCsv, serializeCsv } from '../lib/csv.js';
import { listWords, upsertWordCore } from './words.js';

const DEFAULT_CHANNEL_NAME = 'default';

async function findDefaultChannel(db: Database, projectId: number) {
  const [channel] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.projectId, projectId),
        eq(channels.name, DEFAULT_CHANNEL_NAME),
        isNull(channels.deletedAt),
      ),
    )
    .limit(1);
  return channel ?? null;
}

export interface ExportWordsOptions {
  projectId: number;
  localeIds: number[];
  /** When true, only keys missing a translation in at least one selected locale. */
  missingOnly: boolean;
  /** Cell separator: `,` or `;` (spreadsheet exports). */
  separator: string;
}

/**
 * Builds a CSV with a `key` column followed by one column per selected
 * locale code. Translations resolve to the project's default channel (falling
 * back to a channel-less one), matching what the UI edits.
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
  if (rows.length !== new Set(options.localeIds).size) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'locale_not_in_project' });
  }
  const codesById = new Map(rows.map((row) => [row.id, row.code]));
  // Keep the caller's locale order.
  const selected = options.localeIds.map((id) => ({ id, code: codesById.get(id)! }));

  const defaultChannel = await findDefaultChannel(db, options.projectId);
  const list = await listWords(db, { projectId: options.projectId });

  const csvRows: string[][] = [['key', ...selected.map((locale) => locale.code)]];
  for (const word of list) {
    const values = selected.map((locale) => {
      const candidates = word.translations.filter((t) => t.localeId === locale.id);
      const match =
        candidates.find((t) => t.channelId === defaultChannel?.id) ??
        candidates.find((t) => t.channelId === null) ??
        candidates[0];
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
  const rows = parseCsv(csv, separator);
  const header = rows[0]?.map((cell) => cell.trim());
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

    const [defaultChannel] = await tx
      .select({ id: channels.id })
      .from(channels)
      .where(
        and(
          eq(channels.projectId, projectId),
          eq(channels.name, DEFAULT_CHANNEL_NAME),
          isNull(channels.deletedAt),
        ),
      )
      .limit(1);
    const channelId = defaultChannel?.id ?? null;

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
          channelId,
          value: row[index + 1] ?? '',
        })),
      });
      keys += 1;
    }
    return { keys };
  });
}
