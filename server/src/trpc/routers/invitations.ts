import { z } from 'zod';

import {
  acceptInvitation,
  declineInvitation,
  listPendingInvitationsForUser,
  resolveInvitationByKey,
} from '../../services/invitations.js';
import { protectedProcedure, publicProcedure, router } from '../init.js';

const invitationIdInput = z.object({ invitationId: z.number().int() });

export const invitationsRouter = router({
  /** Pending invitations addressed to the current user (for the banner). */
  myPending: protectedProcedure.query(({ ctx }) =>
    listPendingInvitationsForUser(ctx.db, ctx.user),
  ),

  accept: protectedProcedure
    .input(invitationIdInput)
    .mutation(async ({ ctx, input }) => {
      const invitation = await acceptInvitation(ctx.db, input.invitationId, ctx.user);
      return { projectId: invitation.projectId };
    }),

  decline: protectedProcedure
    .input(invitationIdInput)
    .mutation(async ({ ctx, input }) => {
      const invitation = await declineInvitation(ctx.db, input.invitationId, ctx.user);
      return { projectId: invitation.projectId };
    }),

  /** Public: resolves an emailed key for the registration page. */
  resolve: publicProcedure
    .input(z.object({ key: z.string().min(1) }))
    .query(({ ctx, input }) => resolveInvitationByKey(ctx.db, input.key)),
});
