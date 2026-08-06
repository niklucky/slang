import { TRPCError } from '@trpc/server';
import { z } from 'zod';

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
});
