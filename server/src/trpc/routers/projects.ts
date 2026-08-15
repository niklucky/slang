import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { sendInvitationEmail } from '../../lib/email.js';
import { fetchAndStoreIcon, clearIcon } from '../../services/icons.js';
import {
  createInvitation,
  listInvitationsForProject,
  refreshInvitation,
} from '../../services/invitations.js';
import { listMembers, setMemberPermissions } from '../../services/members.js';
import {
  createProject,
  deleteProjectPermanently,
  findProjectDetails,
  findProjectsForUser,
  regenerateApiKey,
  restoreProject,
  softDeleteProject,
  updateProject,
} from '../../services/projects.js';
import { requireOwner, requireProject, requireProjectMembership } from '../guards.js';
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
  /** With `includeDeleted`, the caller's soft-deleted projects are included. */
  list: protectedProcedure
    .input(z.object({ includeDeleted: z.boolean().optional() }).optional())
    .query(({ ctx, input }) =>
      findProjectsForUser(ctx.db, ctx.user.id, {
        includeDeleted: input?.includeDeleted ?? false,
      }),
    ),

  get: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const { project, isOwner } = await requireProjectMembership(
        ctx.db,
        input.projectId,
        ctx.user.id,
        { includeDeleted: true },
      );
      // Deleted projects stay visible only to their owner.
      if (project.deletedAt !== null && !isOwner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
      }
      const details = await findProjectDetails(ctx.db, project);
      return { ...details, isOwner };
    }),

  create: protectedProcedure
    .input(z.object(projectFields))
    .mutation(async ({ ctx, input }) => {
      const project = await createProject(ctx.db, ctx.user.id, input);
      if (!input.url) return project;
      const iconMimeType = await fetchAndStoreIcon(ctx.db, project.id, input.url);
      return { ...project, iconMimeType };
    }),

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
      const urlChanged = fields.url !== undefined && fields.url !== project.url;
      if (fields.url === null && urlChanged && project.iconMimeType !== null) {
        await clearIcon(ctx.db, projectId);
        return { ...updated, iconMimeType: null };
      }
      // Also (re)fetch when the URL is unchanged but no icon was ever fetched.
      if (fields.url && (urlChanged || project.iconMimeType === null)) {
        const iconMimeType = await fetchAndStoreIcon(ctx.db, projectId, fields.url);
        return { ...updated, iconMimeType };
      }
      return updated;
    }),

  /** Re-fetches the project's favicon from its URL. Owner only. */
  refreshIcon: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      const iconMimeType = await fetchAndStoreIcon(ctx.db, input.projectId, project.url);
      return { iconMimeType };
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

  /** Soft-delete: hides the project and its API key; the owner can restore it. */
  delete: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.db, input.projectId, ctx.user.id);
      requireOwner(project, ctx.user.id);
      const deleted = await softDeleteProject(ctx.db, input.projectId);
      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
      return { ok: true };
    }),

  /** Brings back a soft-deleted project. Owner only. */
  restore: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireProjectMembership(ctx.db, input.projectId, ctx.user.id, {
        includeDeleted: true,
      });
      requireOwner(project, ctx.user.id);
      const restored = await restoreProject(ctx.db, input.projectId);
      if (!restored) throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
      return { ok: true };
    }),

  /** Irreversibly removes the project and all of its data. Owner only. */
  deletePermanently: protectedProcedure
    .input(z.object({ projectId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const { project } = await requireProjectMembership(ctx.db, input.projectId, ctx.user.id, {
        includeDeleted: true,
      });
      requireOwner(project, ctx.user.id);
      const deleted = await deleteProjectPermanently(ctx.db, input.projectId);
      if (!deleted) throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
      await clearIcon(ctx.db, input.projectId);
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
