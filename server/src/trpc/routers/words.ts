import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { z } from 'zod';

import { words } from '../../db/schema.js';
import { exportWordsCsv, importWordsCsv } from '../../services/transfer.js';
import { deleteWordPermanently, deleteWordsPermanently, listTranslationVersions, listWords, renameWord, restoreWord, restoreWords, softDeleteWord, softDeleteWords, upsertWord } from '../../services/words.js';
import { requirePermission, requireProject, requireProjectMembership } from '../guards.js';
import { protectedProcedure, router } from '../init.js';

/** Upper bound for batch operations; larger selections must be chunked by the client. */
export const MAX_BATCH_SIZE = 100;

const batchInput = z.object({
  projectId: z.number().int(),
  wordIds: z.array(z.number().int()).min(1).max(MAX_BATCH_SIZE),
});

/** Checks delete permission and that every word belongs to the project. */
async function requireOwnedWords(db: Database, projectId: number, userId: number, wordIds: number[]) {
  const { permissions } = await requireProjectMembership(db, projectId, userId);
  requirePermission(permissions, 'canDeleteKeys', 'delete_keys_forbidden');
  const rows = await db
    .select({ id: words.id })
    .from(words)
    .where(and(eq(words.projectId, projectId), inArray(words.id, wordIds)));
  if (rows.length !== new Set(wordIds).size) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
  }
}

export const wordsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        search: z.string().trim().optional(),
        localeId: z.number().int().optional(),
        deleted: z.boolean().optional(),
        /** Offset of the page to fetch. */
        cursor: z.number().int().min(0).nullish(),
        limit: z.number().int().min(1).max(1000).default(100),
        missingLocaleIds: z.array(z.number().int()).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.db, input.projectId, ctx.user.id);
      return listWords(ctx.db, input);
    }),

  /** Creates the key when missing, upserts its translations otherwise. */
  upsert: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        key: z.string().trim().min(1),
        translations: z.array(
          z.object({
            localeId: z.number().int(),
            channelId: z.number().int().nullable().optional(),
            value: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { permissions } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
      );
      // Creating a new key and editing an existing one are separate permissions.
      const [existing] = await ctx.db
        .select({ id: words.id })
        .from(words)
        .where(
          and(
            eq(words.projectId, input.projectId),
            eq(words.key, input.key),
            isNull(words.deletedAt),
          ),
        )
        .limit(1);
      if (existing) {
        requirePermission(permissions, 'canTranslate', 'translate_forbidden');
      } else {
        requirePermission(permissions, 'canCreateKeys', 'create_keys_forbidden');
      }
      return upsertWord(ctx.db, { ...input, changedById: ctx.user.id });
    }),

  /** Renames a key. Recorded as a 'renamed' word version. */
  updateKey: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        wordId: z.number().int(),
        key: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { permissions } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
      );
      // Renaming reshapes the key itself, like creating one.
      requirePermission(permissions, 'canCreateKeys', 'rename_keys_forbidden');
      return renameWord(ctx.db, { ...input, changedById: ctx.user.id });
    }),

  history: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        wordId: z.number().int(),
        localeId: z.number().int().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProjectMembership(ctx.db, input.projectId, ctx.user.id);
      const [word] = await ctx.db
        .select({ id: words.id, projectId: words.projectId })
        .from(words)
        .where(eq(words.id, input.wordId))
        .limit(1);
      if (!word || word.projectId !== input.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      }
      return listTranslationVersions(ctx.db, input);
    }),

  remove: protectedProcedure
    .input(z.object({ projectId: z.number().int(), wordId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { permissions } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
      );
      requirePermission(permissions, 'canDeleteKeys', 'delete_keys_forbidden');
      const [word] = await ctx.db
        .select({ id: words.id, projectId: words.projectId })
        .from(words)
        .where(eq(words.id, input.wordId))
        .limit(1);
      if (!word || word.projectId !== input.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      }
      const deleted = await softDeleteWord(ctx.db, input.wordId, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      return { ok: true };
    }),

  /** Irreversibly removes the word, its translations and history from the db. */
  removePermanently: protectedProcedure
    .input(z.object({ projectId: z.number().int(), wordId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { permissions } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
      );
      requirePermission(permissions, 'canDeleteKeys', 'delete_keys_forbidden');
      const [word] = await ctx.db
        .select({ id: words.id, projectId: words.projectId })
        .from(words)
        .where(and(eq(words.id, input.wordId), isNotNull(words.deletedAt)))
        .limit(1);
      if (!word || word.projectId !== input.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      }
      const deleted = await deleteWordPermanently(ctx.db, input.wordId);
      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      return { ok: true };
    }),

  /** Brings back a soft-deleted word and its translations. */
  restore: protectedProcedure
    .input(z.object({ projectId: z.number().int(), wordId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { permissions } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
      );
      requirePermission(permissions, 'canDeleteKeys', 'delete_keys_forbidden');
      const [word] = await ctx.db
        .select({ id: words.id, projectId: words.projectId })
        .from(words)
        .where(eq(words.id, input.wordId))
        .limit(1);
      if (!word || word.projectId !== input.projectId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      }
      const restored = await restoreWord(ctx.db, input.wordId, ctx.user.id);
      if (!restored) throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      return { ok: true };
    }),

  /** Batch counterpart of remove: soft-deletes several keys atomically. */
  removeMany: protectedProcedure.input(batchInput).mutation(async ({ ctx, input }) => {
    const wordIds = [...new Set(input.wordIds)];
    await requireOwnedWords(ctx.db, input.projectId, ctx.user.id, wordIds);
    const deleted = await softDeleteWords(ctx.db, wordIds, ctx.user.id);
    if (!deleted) throw new TRPCError({ code: 'CONFLICT', message: 'word_state_conflict' });
    return { ok: true };
  }),

  /** Batch counterpart of restore. */
  restoreMany: protectedProcedure.input(batchInput).mutation(async ({ ctx, input }) => {
    const wordIds = [...new Set(input.wordIds)];
    await requireOwnedWords(ctx.db, input.projectId, ctx.user.id, wordIds);
    const restored = await restoreWords(ctx.db, wordIds, ctx.user.id);
    if (!restored) throw new TRPCError({ code: 'CONFLICT', message: 'word_state_conflict' });
    return { ok: true };
  }),

  /** Batch counterpart of removePermanently. Irreversible. */
  removePermanentlyMany: protectedProcedure.input(batchInput).mutation(async ({ ctx, input }) => {
    const wordIds = [...new Set(input.wordIds)];
    await requireOwnedWords(ctx.db, input.projectId, ctx.user.id, wordIds);
    const deleted = await deleteWordsPermanently(ctx.db, wordIds);
    if (!deleted) throw new TRPCError({ code: 'CONFLICT', message: 'word_state_conflict' });
    return { ok: true };
  }),

  /** CSV export of all live keys with one column per selected locale. */
  exportCsv: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        localeIds: z.array(z.number().int()).min(1),
        missingOnly: z.boolean().default(false),
        separator: z.enum([',', ';']).default(','),
      }),
    )
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.db, input.projectId, ctx.user.id);
      return { csv: await exportWordsCsv(ctx.db, input) };
    }),

  /**
   * CSV import: header `key,<locale codes...>`, then one row per key.
   * Creates/updates only; nothing is ever deleted.
   */
  importCsv: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        csv: z.string().min(1).max(5 * 1024 * 1024),
        separator: z.enum([',', ';']).default(','),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { permissions } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
      );
      requirePermission(permissions, 'canCreateKeys', 'create_keys_forbidden');
      // Import rows can also update existing keys' translations.
      requirePermission(permissions, 'canTranslate', 'translate_forbidden');
      return importWordsCsv(ctx.db, input.projectId, input.csv, ctx.user.id, input.separator);
    }),
});
