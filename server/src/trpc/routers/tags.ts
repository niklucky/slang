import { z } from 'zod';

import { listTags } from '../../services/tags.js';
import { requireProject } from '../guards.js';
import { protectedProcedure, router } from '../init.js';

/**
 * Tags have no lifecycle of their own: they appear with the first key that
 * carries them and vanish with the last (see services/tags.ts), so the only
 * thing to expose is the list.
 */
export const tagsRouter = router({
  list: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      await requireProject(ctx.db, input.projectId, ctx.user.id);
      return listTags(ctx.db, input.projectId);
    }),
});
