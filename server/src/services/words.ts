import { TRPCError } from '@trpc/server';
import { and, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql, type ExtractTablesWithRelations, type SQL } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';

import type { Database } from '../db/client.js';
import * as schema from '../db/schema.js';
import {
  locales,
  namespaces,
  translationVersions,
  translations,
  users,
  words,
  wordsToNamespaces,
  wordVersions,
  type Word,
  type WordVersionAction,
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
  deletedAt: Date | null;
  namespaces: Array<{ id: number; name: string }>;
  translations: Array<{
    id: number;
    value: string;
    localeId: number;
    localeCode: string;
    channelId: number | null;
  }>;
}

export interface WordsPage {
  items: WordWithTranslations[];
  /** Total keys matching the filters, across all pages. */
  total: number;
  /** Offset for the next page, or null when everything is loaded. */
  nextCursor: number | null;
}

export async function listWords(
  db: Database,
  options: {
    projectId: number;
    search?: string;
    localeId?: number;
    deleted?: boolean;
    cursor?: number | null;
    limit?: number;
    /** When set, only keys missing a translation in at least one of these locales. */
    missingLocaleIds?: number[];
  },
): Promise<WordsPage> {
  const limit = options.limit ?? 100;
  const offset = options.cursor ?? 0;

  const conditions: (SQL | undefined)[] = [
    eq(words.projectId, options.projectId),
    options.deleted ? isNotNull(words.deletedAt) : isNull(words.deletedAt),
  ];
  if (options.search) {
    conditions.push(ilike(words.searchIndex, `%${options.search}%`));
  }
  if (options.missingLocaleIds && options.missingLocaleIds.length > 0) {
    conditions.push(
      or(
        ...options.missingLocaleIds.map(
          (localeId) => sql`not exists (
            select 1 from ${translations}
            where ${translations.wordId} = ${words.id}
              and ${translations.localeId} = ${localeId}
              and ${translations.deletedAt} is null
              and ${translations.value} <> ''
          )`,
        ),
      ),
    );
  }
  const where = and(...conditions);

  const [countRow] = await db.select({ total: count() }).from(words).where(where);
  const total = countRow?.total ?? 0;

  const pageWords = await db
    .select({
      id: words.id,
      key: words.key,
      createdAt: words.createdAt,
      updatedAt: words.updatedAt,
      deletedAt: words.deletedAt,
    })
    .from(words)
    .where(where)
    .orderBy(desc(words.createdAt), words.id)
    .limit(limit)
    .offset(offset);

  if (pageWords.length === 0) {
    return { items: [], total, nextCursor: null };
  }

  const translationConditions: (SQL | undefined)[] = [
    inArray(translations.wordId, pageWords.map((word) => word.id)),
    options.deleted ? isNotNull(translations.deletedAt) : isNull(translations.deletedAt),
  ];
  if (options.localeId !== undefined) {
    translationConditions.push(eq(translations.localeId, options.localeId));
  }

  const translationRows = await db
    .select({
      wordId: translations.wordId,
      translationId: translations.id,
      value: translations.value,
      localeId: translations.localeId,
      channelId: translations.channelId,
    })
    .from(translations)
    .where(and(...translationConditions));

  const translationsByWord = new Map<number, WordWithTranslations['translations']>();
  for (const row of translationRows) {
    const bucket = translationsByWord.get(row.wordId) ?? [];
    bucket.push({
      id: row.translationId,
      value: row.value ?? '',
      localeId: row.localeId,
      localeCode: '', // filled below
      channelId: row.channelId,
    });
    translationsByWord.set(row.wordId, bucket);
  }

  const items: WordWithTranslations[] = pageWords.map((word) => ({
    ...word,
    namespaces: [],
    translations: translationsByWord.get(word.id) ?? [],
  }));

  await attachNamespaces(db, items);
  await attachLocaleCodes(db, items);

  const nextOffset = offset + pageWords.length;
  return { items, total, nextCursor: nextOffset < total ? nextOffset : null };
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
  translations: Array<{ localeId: number; channelId?: number | null; value: string }>;
  /** User behind the change, recorded in translation_versions; null for API pushes. */
  changedById?: number | null;
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
    if (word) {
      await tx
        .insert(wordVersions)
        .values({ wordId: word.id, action: 'created', changedById: input.changedById ?? null });
    }
  } else if (word.deletedAt !== null) {
    const revived = await tx
      .update(words)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(words.id, word.id))
      .returning();
    word = revived[0];
    if (word) {
      await tx
        .insert(wordVersions)
        .values({ wordId: word.id, action: 'restored', changedById: input.changedById ?? null });
    }
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
          entry.channelId == null
            ? isNull(translations.channelId)
            : eq(translations.channelId, entry.channelId),
        ),
      )
      .limit(1);
    const existingTranslation = matches[0];
    if (existingTranslation) {
      await tx
        .update(translations)
        .set({ value: entry.value, deletedAt: null, updatedAt: new Date() })
        .where(eq(translations.id, existingTranslation.id));
      if (existingTranslation.value !== entry.value) {
        await tx.insert(translationVersions).values({
          wordId: word.id,
          localeId: entry.localeId,
          channelId: entry.channelId ?? null,
          oldValue: existingTranslation.value,
          newValue: entry.value,
          changedById: input.changedById ?? null,
        });
      }
    } else {
      await tx.insert(translations).values({
        wordId: word.id,
        localeId: entry.localeId,
        channelId: entry.channelId ?? null,
        value: entry.value,
      });
      await tx.insert(translationVersions).values({
        wordId: word.id,
        localeId: entry.localeId,
        channelId: entry.channelId ?? null,
        oldValue: null,
        newValue: entry.value,
        changedById: input.changedById ?? null,
      });
    }
  }

  await rebuildSearchIndex(tx, word.id);
  return word;
}

export async function upsertWord(db: Database, input: UpsertWordInput): Promise<Word> {
  return db.transaction((tx) => upsertWordCore(tx, input));
}

/**
 * Rename a key. The key is part of the search index, so it is rebuilt after
 * the update. Conflicts with another live key in the project raise CONFLICT.
 */
export async function renameWord(
  db: Database,
  options: { projectId: number; wordId: number; key: string; changedById: number | null },
): Promise<Word> {
  return db.transaction(async (tx) => {
    const [word] = await tx
      .select()
      .from(words)
      .where(and(eq(words.id, options.wordId), isNull(words.deletedAt)))
      .limit(1);
    if (!word || word.projectId !== options.projectId) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
    }
    if (word.key === options.key) return word;

    const [conflict] = await tx
      .select({ id: words.id })
      .from(words)
      .where(
        and(
          eq(words.projectId, options.projectId),
          eq(words.key, options.key),
          isNull(words.deletedAt),
        ),
      )
      .limit(1);
    if (conflict) {
      throw new TRPCError({ code: 'CONFLICT', message: 'key_already_exists' });
    }

    const [updated] = await tx
      .update(words)
      .set({ key: options.key, updatedAt: new Date() })
      .where(eq(words.id, word.id))
      .returning();
    if (!updated) throw new Error('word_update_failed');
    await tx.insert(wordVersions).values({
      wordId: word.id,
      action: 'renamed',
      oldKey: word.key,
      newKey: options.key,
      changedById: options.changedById,
    });
    await rebuildSearchIndex(tx, word.id);
    return updated;
  });
}

export interface TranslationVersionEntry {
  type: 'translation';
  id: number;
  wordId: number;
  localeId: number;
  localeCode: string;
  localeName: string;
  channelId: number | null;
  oldValue: string | null;
  newValue: string | null;
  changedBy: { id: number; name: string; email: string } | null;
  createdAt: Date;
}

export interface WordVersionEntry {
  type: 'word';
  id: number;
  wordId: number;
  action: WordVersionAction;
  oldKey: string | null;
  newKey: string | null;
  changedBy: { id: number; name: string; email: string } | null;
  createdAt: Date;
}

export type HistoryEntry = TranslationVersionEntry | WordVersionEntry;

/**
 * History for a word, newest first. With a localeId filter only translation
 * versions are returned; without it word lifecycle events are merged in.
 */
export async function listTranslationVersions(
  db: Database,
  options: { wordId: number; localeId?: number },
): Promise<HistoryEntry[]> {
  const conditions: (SQL | undefined)[] = [eq(translationVersions.wordId, options.wordId)];
  if (options.localeId !== undefined) {
    conditions.push(eq(translationVersions.localeId, options.localeId));
  }
  const rows = await db
    .select({
      id: translationVersions.id,
      wordId: translationVersions.wordId,
      localeId: translationVersions.localeId,
      localeCode: locales.code,
      localeName: locales.name,
      channelId: translationVersions.channelId,
      oldValue: translationVersions.oldValue,
      newValue: translationVersions.newValue,
      changedById: users.id,
      changedByName: users.name,
      changedByEmail: users.email,
      createdAt: translationVersions.createdAt,
    })
    .from(translationVersions)
    .innerJoin(locales, eq(translationVersions.localeId, locales.id))
    .leftJoin(users, eq(translationVersions.changedById, users.id))
    .where(and(...conditions))
    .orderBy(desc(translationVersions.createdAt), desc(translationVersions.id));
  const entries: HistoryEntry[] = rows.map((row) => ({
    type: 'translation',
    id: row.id,
    wordId: row.wordId,
    localeId: row.localeId,
    localeCode: row.localeCode,
    localeName: row.localeName,
    channelId: row.channelId,
    oldValue: row.oldValue,
    newValue: row.newValue,
    changedBy:
      row.changedById === null
        ? null
        : { id: row.changedById, name: row.changedByName!, email: row.changedByEmail! },
    createdAt: row.createdAt,
  }));

  if (options.localeId === undefined) {
    const wordRows = await db
      .select({
        id: wordVersions.id,
        wordId: wordVersions.wordId,
        action: wordVersions.action,
        oldKey: wordVersions.oldKey,
        newKey: wordVersions.newKey,
        changedById: users.id,
        changedByName: users.name,
        changedByEmail: users.email,
        createdAt: wordVersions.createdAt,
      })
      .from(wordVersions)
      .leftJoin(users, eq(wordVersions.changedById, users.id))
      .where(eq(wordVersions.wordId, options.wordId));
    for (const row of wordRows) {
      entries.push({
        type: 'word',
        id: row.id,
        wordId: row.wordId,
        action: row.action,
        oldKey: row.oldKey,
        newKey: row.newKey,
        changedBy:
          row.changedById === null
            ? null
            : { id: row.changedById, name: row.changedByName!, email: row.changedByEmail! },
        createdAt: row.createdAt,
      });
    }
    entries.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id);
  }
  return entries;
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

export async function softDeleteWord(
  db: Database,
  wordId: number,
  changedById: number | null,
): Promise<boolean> {
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
    await tx.insert(wordVersions).values({ wordId, action: 'deleted', changedById });
    return true;
  });
}

/** Reverse of softDeleteWord: brings back the word and its translations. */
export async function restoreWord(
  db: Database,
  wordId: number,
  changedById: number | null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const restored = await tx
      .update(words)
      .set({ deletedAt: null, updatedAt: now })
      .where(and(eq(words.id, wordId), isNotNull(words.deletedAt)))
      .returning({ id: words.id });
    if (restored.length === 0) return false;
    await tx
      .update(translations)
      .set({ deletedAt: null, updatedAt: now })
      .where(and(eq(translations.wordId, wordId), isNotNull(translations.deletedAt)));
    await tx.insert(wordVersions).values({ wordId, action: 'restored', changedById });
    return true;
  });
}

/**
 * Hard-delete a word and every row that references it (translations,
 * namespace links, and version history). Irreversible.
 */
export async function deleteWordPermanently(db: Database, wordId: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Only soft-deleted words may leave the lifecycle; lock the row to check.
    const [word] = await tx
      .select({ id: words.id, deletedAt: words.deletedAt })
      .from(words)
      .where(eq(words.id, wordId))
      .for('update');
    if (!word || word.deletedAt === null) return false;
    await tx.delete(translationVersions).where(eq(translationVersions.wordId, wordId));
    await tx.delete(wordVersions).where(eq(wordVersions.wordId, wordId));
    await tx.delete(wordsToNamespaces).where(eq(wordsToNamespaces.wordId, wordId));
    await tx.delete(translations).where(eq(translations.wordId, wordId));
    const deleted = await tx.delete(words).where(eq(words.id, wordId)).returning({ id: words.id });
    return deleted.length > 0;
  });
}

/** Batch variant of softDeleteWord: one transaction, all ids transition or none. */
export async function softDeleteWords(
  db: Database,
  wordIds: number[],
  changedById: number | null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const deleted = await tx
      .update(words)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(inArray(words.id, wordIds), isNull(words.deletedAt)))
      .returning({ id: words.id });
    if (deleted.length !== wordIds.length) return false;
    await tx
      .update(translations)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(inArray(translations.wordId, wordIds), isNull(translations.deletedAt)));
    await tx
      .insert(wordVersions)
      .values(wordIds.map((wordId) => ({ wordId, action: 'deleted' as const, changedById })));
    return true;
  });
}

/** Batch variant of restoreWord: one transaction, all ids transition or none. */
export async function restoreWords(
  db: Database,
  wordIds: number[],
  changedById: number | null,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const restored = await tx
      .update(words)
      .set({ deletedAt: null, updatedAt: now })
      .where(and(inArray(words.id, wordIds), isNotNull(words.deletedAt)))
      .returning({ id: words.id });
    if (restored.length !== wordIds.length) return false;
    await tx
      .update(translations)
      .set({ deletedAt: null, updatedAt: now })
      .where(and(inArray(translations.wordId, wordIds), isNotNull(translations.deletedAt)));
    await tx
      .insert(wordVersions)
      .values(wordIds.map((wordId) => ({ wordId, action: 'restored' as const, changedById })));
    return true;
  });
}

/** Batch variant of deleteWordPermanently: one transaction, all ids removed or none. */
export async function deleteWordsPermanently(db: Database, wordIds: number[]): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Only soft-deleted words may leave the lifecycle; lock the rows to check.
    const rows = await tx
      .select({ id: words.id })
      .from(words)
      .where(and(inArray(words.id, wordIds), isNotNull(words.deletedAt)))
      .for('update');
    if (rows.length !== wordIds.length) return false;
    await tx.delete(translationVersions).where(inArray(translationVersions.wordId, wordIds));
    await tx.delete(wordVersions).where(inArray(wordVersions.wordId, wordIds));
    await tx.delete(wordsToNamespaces).where(inArray(wordsToNamespaces.wordId, wordIds));
    await tx.delete(translations).where(inArray(translations.wordId, wordIds));
    const deleted = await tx
      .delete(words)
      .where(inArray(words.id, wordIds))
      .returning({ id: words.id });
    return deleted.length === wordIds.length;
  });
}
