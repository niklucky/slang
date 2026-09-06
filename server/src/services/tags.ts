import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { tags, words, wordsToTags } from '../db/schema.js';
import type { Tx } from './words.js';

export const MAX_TAG_LENGTH = 64;

/**
 * Tags are filter keys, so `Email`, `email ` and `email` must be one tag:
 * trimmed, single-spaced, lowercased. Empty after cleaning means "no tag".
 */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Cleans and dedupes a list of names; rejects anything too long to be a label. */
export function normalizeTagNames(names: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const raw of names) {
    const name = normalizeTagName(raw);
    if (!name) continue;
    if (name.length > MAX_TAG_LENGTH) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'tag_too_long' });
    }
    seen.add(name);
  }
  return [...seen];
}

export interface TagSummary {
  id: number;
  name: string;
  /** Live (not soft-deleted) words carrying the tag. */
  wordCount: number;
}

/** Every tag of the project, with how many live words carry it, by name. */
export async function listTags(db: Database, projectId: number): Promise<TagSummary[]> {
  const rows = await db
    .select({
      id: tags.id,
      name: tags.name,
      wordCount: count(sql`case when ${words.deletedAt} is null then ${words.id} end`),
    })
    .from(tags)
    .leftJoin(wordsToTags, eq(wordsToTags.tagId, tags.id))
    .leftJoin(words, eq(words.id, wordsToTags.wordId))
    .where(eq(tags.projectId, projectId))
    .groupBy(tags.id)
    .orderBy(tags.name);
  return rows.map((row) => ({ id: row.id, name: row.name, wordCount: Number(row.wordCount) }));
}

/** Resolves names to ids, creating the missing ones. Names must be normalized. */
export async function findOrCreateTags(
  tx: Tx,
  projectId: number,
  names: readonly string[],
): Promise<Map<string, number>> {
  const byName = new Map<string, number>();
  if (names.length === 0) return byName;

  const existing = await tx
    .select({ id: tags.id, name: tags.name })
    .from(tags)
    .where(and(eq(tags.projectId, projectId), inArray(tags.name, [...names])));
  for (const row of existing) byName.set(row.name, row.id);

  const missing = names.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    // A concurrent writer may have created the same tag; fall through to a
    // re-read for whichever rows the insert skipped.
    const inserted = await tx
      .insert(tags)
      .values(missing.map((name) => ({ projectId, name })))
      .onConflictDoNothing()
      .returning({ id: tags.id, name: tags.name });
    for (const row of inserted) byName.set(row.name, row.id);
    const stillMissing = missing.filter((name) => !byName.has(name));
    if (stillMissing.length > 0) {
      const rows = await tx
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(and(eq(tags.projectId, projectId), inArray(tags.name, stillMissing)));
      for (const row of rows) byName.set(row.name, row.id);
    }
  }
  return byName;
}

/** Links the word to every named tag, keeping links it already has. Additive. */
export async function addWordTags(
  tx: Tx,
  projectId: number,
  wordId: number,
  names: readonly string[],
): Promise<void> {
  const ids = await findOrCreateTags(tx, projectId, names);
  if (ids.size === 0) return;
  await tx
    .insert(wordsToTags)
    .values([...ids.values()].map((tagId) => ({ wordId, tagId })))
    .onConflictDoNothing();
}

/**
 * Makes `names` the word's exact tag set: missing ones are created and
 * linked, links to anything else are dropped, and tags left with no word
 * are deleted so the project's tag list never lists a label nothing uses.
 */
export async function setWordTags(
  tx: Tx,
  projectId: number,
  wordId: number,
  names: readonly string[],
): Promise<void> {
  const ids = await findOrCreateTags(tx, projectId, names);
  const keep = [...ids.values()];
  const removed = await tx
    .delete(wordsToTags)
    .where(
      keep.length > 0
        ? and(eq(wordsToTags.wordId, wordId), notInArray(wordsToTags.tagId, keep))
        : eq(wordsToTags.wordId, wordId),
    )
    .returning({ tagId: wordsToTags.tagId });
  if (keep.length > 0) {
    await tx
      .insert(wordsToTags)
      .values(keep.map((tagId) => ({ wordId, tagId })))
      .onConflictDoNothing();
  }
  await pruneOrphanTags(tx, removed.map((row) => row.tagId));
}

/** Deletes the given tags if no word links to them any more. */
export async function pruneOrphanTags(tx: Tx, tagIds: readonly number[]): Promise<void> {
  const candidates = [...new Set(tagIds)];
  if (candidates.length === 0) return;
  const linked = await tx
    .selectDistinct({ tagId: wordsToTags.tagId })
    .from(wordsToTags)
    .where(inArray(wordsToTags.tagId, candidates));
  const inUse = new Set(linked.map((row) => row.tagId));
  const orphans = candidates.filter((id) => !inUse.has(id));
  if (orphans.length > 0) {
    await tx.delete(tags).where(inArray(tags.id, orphans));
  }
}

/**
 * Removes every tag link of the given words (a hard delete is the caller),
 * then prunes tags that pointed only at them.
 */
export async function unlinkWordTags(tx: Tx, wordIds: readonly number[]): Promise<void> {
  if (wordIds.length === 0) return;
  const removed = await tx
    .delete(wordsToTags)
    .where(inArray(wordsToTags.wordId, [...wordIds]))
    .returning({ tagId: wordsToTags.tagId });
  await pruneOrphanTags(tx, removed.map((row) => row.tagId));
}

/** Tag names per word, for both the management listing and the external API. */
export async function fetchTagsForWords(
  db: Database | Tx,
  wordIds: readonly number[],
): Promise<Map<number, Array<{ id: number; name: string }>>> {
  const result = new Map<number, Array<{ id: number; name: string }>>();
  if (wordIds.length === 0) return result;
  const rows = await db
    .select({ wordId: wordsToTags.wordId, id: tags.id, name: tags.name })
    .from(wordsToTags)
    .innerJoin(tags, eq(wordsToTags.tagId, tags.id))
    .where(inArray(wordsToTags.wordId, [...wordIds]))
    .orderBy(tags.name);
  for (const row of rows) {
    const bucket = result.get(row.wordId) ?? [];
    bucket.push({ id: row.id, name: row.name });
    result.set(row.wordId, bucket);
  }
  return result;
}

/** SQL condition: the word carries at least one of the tags. */
export function wordHasAnyTag(tagIds: readonly number[]) {
  return sql`exists (
    select 1 from ${wordsToTags}
    where ${wordsToTags.wordId} = ${words.id}
      and ${wordsToTags.tagId} in (${sql.join(tagIds.map((id) => sql`${id}`), sql`, `)})
  )`;
}

/** SQL condition: the word carries the named tag of this project. */
export function wordHasTagNamed(projectId: number, name: string) {
  return sql`exists (
    select 1 from ${wordsToTags}
    inner join ${tags} on ${tags.id} = ${wordsToTags.tagId}
    where ${wordsToTags.wordId} = ${words.id}
      and ${tags.projectId} = ${projectId}
      and ${tags.name} = ${name}
  )`;
}
