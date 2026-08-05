import { TRPCError } from '@trpc/server';

import type { Database } from '../db/client.js';
import type { Project } from '../db/schema.js';
import { findProjectForUser } from '../services/projects.js';

export async function requireProject(
  db: Database,
  projectId: number,
  userId: number,
): Promise<Project> {
  const project = await findProjectForUser(db, projectId, userId);
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
  }
  return project;
}

export function requireOwner(project: Project, userId: number): void {
  if (project.ownerId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'owner_only' });
  }
}
