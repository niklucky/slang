import { ilike } from 'drizzle-orm';
import { z } from 'zod';

import { users } from '../../db/schema.js';
import { protectedProcedure, router } from '../init.js';

export const usersRouter = router({
  /** Email search for the invite flow: does this address already have an account? */
  search: protectedProcedure
    .input(z.object({ email: z.email() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(ilike(users.email, input.email.toLowerCase()))
        .limit(1);
    }),
});
