import { and, desc, eq, ilike, inArray, isNull, type ExtractTablesWithRelations, type SQL } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

import type { Database } from '../db/client.js';
import * as schema from '../db/schema.js';
import {
  locales,
  namespaces,
  translations,
  words,
  wordsToNamespaces,
  type Word,
} from '../db/schema.js';

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export interface WordWithTranslations {
  id: number;
  key: string;
  createdAt: Date;
  updatedAt: Date;
  namespaces: Array<{ id: number; name: string }>;
  translations: Array<{
    id: number;
    value: string;
    localeId: number;
    localeCode: string;
    channelId: number;
  }>;
}

export async function listWords(
  db: Database,
  options: { projectId: number; search?: string; localeId?: number },
): Promise<WordWithTranslations[]> {
  const conditions: (SQL | undefined)[] = [
    eq(words.projectId, options.projectId),
    isNull(words.deletedAt),
  ];
  if (options.search) {
    conditions.push(ilike(words.searchIndex, `%${options.search}%`));
  }

  const joinConditions: (SQL | undefined)[] = [
    eq(translations.wordId, words.id),
    isNull(translations.deletedAt),
  ];
  if (options.localeId !== undefined) {
    joinConditions.push(eq(translations.localeId, options.localeId));
  }

  const rows = await db
    .select({
      wordId: words.id,
      key: words.key,
      createdAt: words.createdAt,
      updatedAt: words.updatedAt,
      translationId: translations.id,
      value: translations.value,
      localeId: translations.localeId,
      channelId: translations.channelId,
    })
    .from(words)
    .leftJoin(translations, and(...joinConditions))
    .where(and(...conditions))
    .orderBy(desc(words.createdAt), words.id);

  const byId = new Map<number, WordWithTranslations>();
  for (const row of rows) {
    let entry = byId.get(row.wordId);
    if (!entry) {
      entry = { id: row.wordId, key: row.key, createdAt: row.createdAt, updatedAt: row.updatedAt, namespaces: [], translations: [] };
      byId.set(row.wordId, entry);
    }
    if (row.translationId !== null && row.localeId !== null) {
      entry.translations.push({
        id: row.translationId,
        value: row.value ?? '',
        localeId: row.localeId,
        localeCode: '', // filled below
        channelId: row.channelId ?? 0,
      });
    }
  }

  await attachNamespaces(db, [...byId.values()]);
  await attachLocaleCodes(db, [...byId.values()]);
  return [...byId.values()];
}

async function attachNamespaces(db: Database, list: WordWithTranslations[]): Promise<void> {
  const wordIds = list.map((word) => word.id);
  if (wordIds.length === 0) return;
  const rows = await db
    .select({ wordId: wordsToNamespaces.wordId, id: namespaces.id, name: namespaces.name })
    .from(wordsToNamespaces)
    .innerJoin(namespaces, eq(wordsToNamespaces.namespaceId, namespaces.id))
    .where(and(inArray(wordsToNamespaces.wordId, wordIds), isNull(namespaces.deletedAt)));
  const byWord = new Map<number, Array<{ id: number; name: string }>>();
  for (const row of rows) {
    const bucket = byWord.get(row.wordId) ?? [];
    bucket.push({ id: row.id, name: row.name });
    byWord.set(row.wordId, bucket);
  }
  for (const word of list) {
    word.namespaces = byWord.get(word.id) ?? [];
  }
}

async function attachLocaleCodes(db: Database, list: WordWithTranslations[]): Promise<void> {
  const localeIds = [...new Set(list.flatMap((word) => word.translations.map((t) => t.localeId)))];
  if (localeIds.length === 0) return;
  const rows = await db
    .select({ id: locales.id, code: locales.code })
    .from(locales)
    .where(inArray(locales.id, localeIds));
  const codes = new Map(rows.map((row) => [row.id, row.code]));
  for (const word of list) {
    for (const translation of word.translations) {
      translation.localeCode = codes.get(translation.localeId) ?? '';
    }
  }
}

export interface UpsertWordInput {
  projectId: number;
  key: string;
  translations: Array<{ localeId: number; channelId: number; value: string }>;
}

/**
 * Find-or-create the word (reviving a soft-deleted one), then upsert every
 * translation. Transaction-agnostic so callers can batch many words.
 */
export async function upsertWordCore(tx: Tx, input: UpsertWordInput): Promise<Word> {
  const existing = await tx
    .select()
    .from(words)
    .where(and(eq(words.projectId, input.projectId), eq(words.key, input.key)));
  let word = existing.find((row) => row.deletedAt === null) ?? existing[0];

  if (!word) {
    const inserted = await tx
      .insert(words)
      .values({ projectId: input.projectId, key: input.key })
      .returning();
    word = inserted[0];
  } else if (word.deletedAt !== null) {
    const revived = await tx
      .update(words)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(words.id, word.id))
      .returning();
    word = revived[0];
  }
  if (!word) throw new Error('word_insert_failed');

  for (const entry of input.translations) {
    // The old server skipped empty values; keep that so pushes never blank a key.
    if (!entry.value) continue;
    const matches = await tx
      .select()
      .from(translations)
      .where(
        and(
          eq(translations.wordId, word.id),
          eq(translations.localeId, entry.localeId),
          eq(translations.channelId, entry.channelId),
        ),
      )
      .limit(1);
    const existingTranslation = matches[0];
    if (existingTranslation) {
      await tx
        .update(translations)
        .set({ value: entry.value, deletedAt: null, updatedAt: new Date() })
        .where(eq(translations.id, existingTranslation.id));
    } else {
      await tx.insert(translations).values({
        wordId: word.id,
        localeId: entry.localeId,
        channelId: entry.channelId,
        value: entry.value,
      });
    }
  }

  await rebuildSearchIndex(tx, word.id);
  return word;
}

export async function upsertWord(db: Database, input: UpsertWordInput): Promise<Word> {
  return db.transaction((tx) => upsertWordCore(tx, input));
}

export async function rebuildSearchIndex(tx: Tx, wordId: number): Promise<void> {
  const [word] = await tx.select({ key: words.key }).from(words).where(eq(words.id, wordId));
  if (!word) return;
  const values = await tx
    .select({ value: translations.value })
    .from(translations)
    .where(and(eq(translations.wordId, wordId), isNull(translations.deletedAt)));
  const parts = [word.key, ...values.map((row) => row.value)]
    .map((part) => part.toLowerCase())
    .filter((part) => part.length > 0);
  await tx
    .update(words)
    .set({ searchIndex: parts.join(' '), updatedAt: new Date() })
    .where(eq(words.id, wordId));
}

export async function softDeleteWord(db: Database, wordId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const deleted = await tx
      .update(words)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(words.id, wordId), isNull(words.deletedAt)))
      .returning({ id: words.id });
    if (deleted.length === 0) return false;
    await tx
      .update(translations)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(translations.wordId, wordId), isNull(translations.deletedAt)));
    return true;
  });
}
