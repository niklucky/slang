import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { users, type User } from '../../db/schema.js';
import { signToken } from '../../lib/jwt.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { registerWithInvitation } from '../../services/invitations.js';
import { protectedProcedure, publicProcedure, router } from '../init.js';

function toPublicUser(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}

const credentialsInput = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(6),
});

export const authRouter = router({
  /** Public: tells the SPA whether to show the first-run setup form. */
  status: publicProcedure.query(async ({ ctx }) => {
    const [existing] = await ctx.db.select({ id: users.id }).from(users).limit(1);
    return { setupRequired: !existing };
  }),

  /** Creates the very first user; locked once any user exists. */
  setup: publicProcedure
    .input(credentialsInput.required({ name: true }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db.select({ id: users.id }).from(users).limit(1);
      if (existing) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'account_set_up' });
      }
      const [user] = await ctx.db
        .insert(users)
        .values({
          email: input.email,
          name: input.name ?? input.email,
          password: await hashPassword(input.password),
        })
        .returning();
      if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      const accessToken = await signToken(user.id);
      return { user: toPublicUser(user), accessToken };
    }),

  /** Redeems an invitation: creates the account under the invited email and joins the project. */
  register: publicProcedure
    .input(
      credentialsInput
        .pick({ name: true, password: true })
        .required({ name: true })
        .extend({ key: z.string().min(1) }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await registerWithInvitation(ctx.db, input);
      const accessToken = await signToken(user.id);
      return { user: toPublicUser(user), accessToken };
    }),

  login: publicProcedure
    .input(credentialsInput.pick({ email: true, password: true }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (!user || !(await verifyPassword(input.password, user.password))) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'bad_credentials' });
      }
      const accessToken = await signToken(user.id);
      return { user: toPublicUser(user), accessToken };
    }),

  me: protectedProcedure.query(({ ctx }) => ctx.user),
});
