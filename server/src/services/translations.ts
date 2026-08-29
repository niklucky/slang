import { and, desc, eq, inArray, isNull, type SQL } from "drizzle-orm";

import type { Database } from "../db/client.js";
import {
  locales,
  namespaces,
  projectsToLocales,
  translations,
  words,
  wordsToNamespaces,
} from "../db/schema.js";
import { upsertWordCore, type Tx } from "./words.js";

export type ExternalApiStatus = 400 | 401 | 404 | 500;

export class ExternalApiError extends Error {
  constructor(
    readonly status: ExternalApiStatus,
    message: string,
  ) {
    super(message);
  }
}

interface FetchedTranslation {
  id: number;
  value: string;
  wordId: number;
  key: string;
  localeId: number;
  localeCode: string;
}

export interface FetchTranslationsOptions {
  projectId: number;
  locale?: string;
  namespace?: string;
}

export async function fetchTranslations(
  db: Database,
  options: FetchTranslationsOptions,
): Promise<FetchedTranslation[]> {
  const baseWhere = [
    eq(words.projectId, options.projectId),
    isNull(words.deletedAt),
    isNull(translations.deletedAt),
    options.locale ? eq(locales.code, options.locale) : undefined,
  ];

  const fields = {
    id: translations.id,
    value: translations.value,
    wordId: words.id,
    key: words.key,
    localeId: locales.id,
    localeCode: locales.code,
  };

  if (options.namespace) {
    return db
      .select(fields)
      .from(translations)
      .innerJoin(words, eq(translations.wordId, words.id))
      .innerJoin(locales, eq(translations.localeId, locales.id))
      .innerJoin(wordsToNamespaces, eq(words.id, wordsToNamespaces.wordId))
      .innerJoin(namespaces, eq(wordsToNamespaces.namespaceId, namespaces.id))
      .where(
        and(
          and(...baseWhere),
          eq(namespaces.name, options.namespace),
          isNull(namespaces.deletedAt),
        ),
      );
  }
  return db
    .select(fields)
    .from(translations)
    .innerJoin(words, eq(translations.wordId, words.id))
    .innerJoin(locales, eq(translations.localeId, locales.id))
    .where(and(...baseWhere));
}

/** Namespace names per word, needed by both response formats. */
export async function fetchNamespacesForWords(
  db: Database,
  wordIds: number[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (wordIds.length === 0) return result;
  const rows = await db
    .select({ wordId: wordsToNamespaces.wordId, name: namespaces.name })
    .from(wordsToNamespaces)
    .innerJoin(namespaces, eq(wordsToNamespaces.namespaceId, namespaces.id))
    .where(
      and(
        inArray(wordsToNamespaces.wordId, wordIds),
        isNull(namespaces.deletedAt),
      ),
    );
  for (const row of rows) {
    const bucket = result.get(row.wordId) ?? [];
    bucket.push(row.name);
    result.set(row.wordId, bucket);
  }
  return result;
}

/** Raw-list format: the shape the old server returned without `format=i18next`. */
export function prepareRaw(
  rows: FetchedTranslation[],
  namespacesByWord: Map<number, string[]>,
): unknown[] {
  return rows.map((row) => ({
    id: row.id,
    value: row.value,
    word: {
      key: row.key,
      namespaces: (namespacesByWord.get(row.wordId) ?? []).map((name) => ({
        name,
      })),
    },
    locale: { id: row.localeId, code: row.localeCode },
  }));
}

/**
 * `format=i18next` shape: `{ locale: { key: value } }`. Words that carry
 * namespaces nest one level deeper unless a `namespace` filter flattened them.
 */
export function prepareI18Next(
  rows: FetchedTranslation[],
  namespacesByWord: Map<number, string[]>,
  namespaceFilter: string | undefined,
): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    const localeBucket = (result[row.localeCode] ??= {});
    const wordNamespaces = namespacesByWord.get(row.wordId) ?? [];
    if (wordNamespaces.length > 0 && !namespaceFilter) {
      for (const name of wordNamespaces) {
        const nsBucket =
          (localeBucket[name] as Record<string, string> | undefined) ?? {};
        nsBucket[row.key] = row.value;
        localeBucket[name] = nsBucket;
      }
    } else {
      localeBucket[row.key] = row.value;
    }
  }
  return result;
}

/** Most recent `updatedAt` among matching translations, or null. */
export async function fetchTranslationsState(
  db: Database,
  options: FetchTranslationsOptions,
): Promise<Date | null> {
  const conditions: (SQL | undefined)[] = [
    eq(words.projectId, options.projectId),
    isNull(translations.deletedAt),
    options.locale ? eq(locales.code, options.locale) : undefined,
  ];

  let query = db
    .select({ updatedAt: translations.updatedAt })
    .from(translations)
    .innerJoin(words, eq(translations.wordId, words.id))
    .leftJoin(locales, eq(translations.localeId, locales.id));

  if (options.namespace) {
    query = query
      .innerJoin(wordsToNamespaces, eq(words.id, wordsToNamespaces.wordId))
      .innerJoin(namespaces, eq(wordsToNamespaces.namespaceId, namespaces.id));
    conditions.push(
      eq(namespaces.name, options.namespace),
      isNull(namespaces.deletedAt),
    );
  }

  const rows = await query
    .where(and(...conditions))
    .orderBy(desc(translations.updatedAt))
    .limit(1);
  return rows[0]?.updatedAt ?? null;
}

export interface PushInput {
  locale: string;
  namespace?: string;
  translations: Record<string, string>;
}

export interface PushResult {
  keys: number;
}

/**
 * Batch upsert used by the CLI push. Runs as one transaction; empty values
 * are skipped, mirroring the old write path. Missing locales are created and
 * attached to the project so a push never fails on a locale the project has
 * not enabled yet.
 */
export async function pushTranslations(
  db: Database,
  projectId: number,
  input: PushInput,
): Promise<PushResult> {
  return db.transaction(async (tx) => {
    const locale = await findOrCreateLocale(tx, input.locale);
    await tx
      .insert(projectsToLocales)
      .values({ projectId, localeId: locale.id })
      .onConflictDoNothing();

    let namespaceId: number | undefined;
    if (input.namespace) {
      namespaceId = await findOrCreateNamespace(tx, projectId, input.namespace);
    }

    let keys = 0;
    for (const [key, value] of Object.entries(input.translations)) {
      if (!key || !value) continue;
      const word = await upsertWordCore(tx, {
        projectId,
        key,
        translations: [{ localeId: locale.id, value }],
      });
      if (namespaceId !== undefined) {
        await tx
          .insert(wordsToNamespaces)
          .values({ wordId: word.id, namespaceId })
          .onConflictDoNothing();
      }
      keys += 1;
    }
    return { keys };
  });
}

/**
 * Resolves a locale by code, adding it to the global catalog when missing.
 * Codes outside the seeded catalog (e.g. `en-PT`) carry no display name, so
 * the code itself stands in until someone renames it in the UI. countryCode
 * keeps the whole code (normalized to the catalog's `en_pt` style) so the
 * region survives: a bare `ca` would be indistinguishable from Catalan.
 */
async function findOrCreateLocale(
  tx: Tx,
  code: string,
): Promise<{ id: number }> {
  const [existing] = await tx
    .select({ id: locales.id })
    .from(locales)
    .where(eq(locales.code, code))
    .limit(1);
  if (existing) return existing;
  const inserted = await tx
    .insert(locales)
    .values({
      code,
      countryCode: code.toLowerCase().replace(/-/g, "_"),
      name: code,
      title: code,
    })
    .onConflictDoNothing()
    .returning({ id: locales.id });
  // A concurrent push may have inserted the same code first.
  const created =
    inserted[0] ??
    (
      await tx
        .select({ id: locales.id })
        .from(locales)
        .where(eq(locales.code, code))
        .limit(1)
    )[0];
  if (!created) throw new ExternalApiError(500, "locale_insert_failed");
  return created;
}

async function findOrCreateNamespace(
  tx: Tx,
  projectId: number,
  name: string,
): Promise<number> {
  const [existing] = await tx
    .select({ id: namespaces.id })
    .from(namespaces)
    .where(
      and(
        eq(namespaces.projectId, projectId),
        eq(namespaces.name, name),
        isNull(namespaces.deletedAt),
      ),
    )
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(namespaces)
    .values({ projectId, name })
    .returning({ id: namespaces.id });
  if (!created) throw new ExternalApiError(500, "namespace_insert_failed");
  return created.id;
}
