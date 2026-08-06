import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { sendInvitationEmail } from '../../lib/email.js';
import {
  createInvitation,
  listInvitationsForProject,
  refreshInvitation,
} from '../../services/invitations.js';
import { listMembers, setMemberPermissions } from '../../services/members.js';
import {
  createProject,
  findProjectDetails,
  findProjectsForUser,
  regenerateApiKey,
  softDeleteProject,
  updateProject,
} from '../../services/projects.js';
import { requireOwner, requireProject } from '../guards.js';
import { protectedProcedure, router } from '../init.js';

/**
 * Sends the invitation email when there is an address to send to. The
 * invitation row is kept on failure so it can be resent from the UI.
 */
async function deliverInvitationEmail(options: {
  to: string | null;
  key: string;
  projectName: string;
  inviterName: string;
}): Promise<void> {
  const { to } = options;
  if (!to) return;
  try {
    await sendInvitationEmail({ ...options, to });
  } catch (error) {
    console.error(error);
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'email_send_failed' });
  }
}

const projectFields = {
  name: z.string().trim().min(1),
  url: z.string().trim().min(1).nullable(),
  description: z.string().trim().max(2000).nullish(),
};

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => findProjectsForUser(ctx.db, ctx.user.id)),

  get: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      return findProjectDetails(ctx.db, project);
    }),

  create: protectedProcedure
    .input(z.object(projectFields))
    .mutation(({ ctx, input }) => createProject(ctx.db, ctx.user.id, input)),

  update: protectedProcedure
    .input(z.object({ projectId: z.number().int(), ...projectFields }).partial({ name: true, url: true }))
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...fields } = input;
      if (Object.keys(fields).length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'nothing_to_update' });
      }
      const project = await requireProject(ctx.db, projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      const updated = await updateProject(ctx.db, projectId, fields);
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
      return updated;
    }),

  regenerateApiKey: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      const updated = await regenerateApiKey(ctx.db, input.projectId);
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      await softDeleteProject(ctx.db, input.projectId);
      return { ok: true };
    }),

  /** Members for any member; the invitations list is owner-only. */
  members: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      const isOwner = project.ownerId === ctx.user.id;
      const [members, invitations] = await Promise.all([
        listMembers(ctx.db, project.id, project.ownerId),
        isOwner
          ? listInvitationsForProject(ctx.db, project.id)
          : Promise.resolve([] as Awaited<ReturnType<typeof listInvitationsForProject>>),
      ]);
      return { isOwner, members, invitations };
    }),

  /** Invite by email. Owner only. */
  invite: protectedProcedure
    .input(z.object({ projectId: z.number().int(), email: z.email() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      const { invitation } = await createInvitation(
        ctx.db,
        project.id,
        ctx.user.id,
        input.email,
      );
      await deliverInvitationEmail({
        to: invitation.email,
        key: invitation.key,
        projectName: project.name,
        inviterName: ctx.user.name,
      });
      return invitation;
    }),

  /** Rotate the key, extend the expiry and email the invitation again. Owner only. */
  resendInvitation: protectedProcedure
    .input(z.object({ projectId: z.number().int(), invitationId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      const invitation = await refreshInvitation(ctx.db, input.invitationId, project.id);
      await deliverInvitationEmail({
        to: invitation.email,
        key: invitation.key,
        projectName: project.name,
        inviterName: ctx.user.name,
      });
      return invitation;
    }),

  setMemberPermissions: protectedProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        userId: z.number().int(),
        canCreateKeys: z.boolean(),
        canTranslate: z.boolean(),
        canDeleteKeys: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      if (input.userId === project.ownerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'cannot_change_owner_permissions' });
      }
      const member = await setMemberPermissions(ctx.db, project.id, input.userId, {
        canCreateKeys: input.canCreateKeys,
        canTranslate: input.canTranslate,
        canDeleteKeys: input.canDeleteKeys,
      });
      if (!member) throw new TRPCError({ code: 'NOT_FOUND', message: 'member_not_found' });
      return member;
    }),
});
