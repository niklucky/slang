import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { words } from '../../db/schema.js';
import { listWords, softDeleteWord, upsertWord } from '../../services/words.js';
import { requirePermission, requireProject, requireProjectMembership } from '../guards.js';
import { protectedProcedure, router } from '../init.js';

export const wordsRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        search: z.string().trim().optional(),
        localeId: z.number().int().optional(),
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
            channelId: z.number().int(),
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
      return upsertWord(ctx.db, input);
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
      const deleted = await softDeleteWord(ctx.db, input.wordId);
      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'word_not_found' });
      return { ok: true };
    }),
});
