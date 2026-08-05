import { and, eq, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';

import { locales, projectsToLocales, translations, words } from '../../db/schema.js';
import { requireProject } from '../guards.js';
import { protectedProcedure, router } from '../init.js';

export const localesRouter = router({
  catalog: protectedProcedure.query(({ ctx }) =>
    ctx.db.select().from(locales).orderBy(locales.code),
  ),

  add: protectedProcedure
    .input(z.object({ projectId: z.number().int(), localeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.db, input.projectId, ctx.user.id);
      await ctx.db
        .insert(projectsToLocales)
        .values({ projectId: input.projectId, localeId: input.localeId })
        .onConflictDoNothing();
      return { ok: true };
    }),

  /**
   * Disconnects the locale and soft-deletes its translations inside THIS
   * project only (the old server deleted them globally).
   */
  remove: protectedProcedure
    .input(z.object({ projectId: z.number().int(), localeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      await requireProject(ctx.db, input.projectId, ctx.user.id);
      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(projectsToLocales)
          .where(
            and(
              eq(projectsToLocales.projectId, input.projectId),
              eq(projectsToLocales.localeId, input.localeId),
            ),
          );
        const projectWords = await tx
          .select({ id: words.id })
          .from(words)
          .where(eq(words.projectId, input.projectId));
        if (projectWords.length > 0) {
          await tx
            .update(translations)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(translations.localeId, input.localeId),
                isNull(translations.deletedAt),
                inArray(
                  translations.wordId,
                  projectWords.map((row) => row.id),
                ),
              ),
            );
        }
      });
      return { ok: true };
    }),
});
