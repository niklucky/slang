import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { projects, usersToProjects, type Project } from '../db/schema.js';
import type { MemberPermissions } from '../services/members.js';

export interface ProjectMembership {
  project: Project;
  isOwner: boolean;
  permissions: MemberPermissions;
}

const OWNER_PERMISSIONS: MemberPermissions = {
  canCreateKeys: true,
  canTranslate: true,
  canDeleteKeys: true,
};

export interface RequireProjectOptions {
  /** Also resolve soft-deleted projects (owner-only restore/purge flows). */
  includeDeleted?: boolean;
}

/**
 * Resolves the project together with the caller's membership. Users who are
 * neither owner nor member get NOT_FOUND so project ids stay unenumerable.
 * Soft-deleted projects are NOT_FOUND unless `includeDeleted` is set.
 */
export async function requireProjectMembership(
  db: Database,
  projectId: number,
  userId: number,
  options: RequireProjectOptions = {},
): Promise<ProjectMembership> {
  const [row] = await db
    .select({ project: projects, membership: usersToProjects })
    .from(projects)
    .leftJoin(
      usersToProjects,
      and(eq(usersToProjects.projectId, projects.id), eq(usersToProjects.userId, userId)),
    )
    .where(
      and(
        eq(projects.id, projectId),
        options.includeDeleted ? undefined : isNull(projects.deletedAt),
      ),
    )
    .limit(1);

  if (!row) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
  }

  const isOwner = row.project.ownerId === userId;
  if (!isOwner && !row.membership) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'project_not_found' });
  }

  return {
    project: row.project,
    isOwner,
    permissions:
      isOwner || !row.membership
        ? OWNER_PERMISSIONS
        : {
            canCreateKeys: row.membership.canCreateKeys,
            canTranslate: row.membership.canTranslate,
            canDeleteKeys: row.membership.canDeleteKeys,
          },
  };
}

export async function requireProject(
  db: Database,
  projectId: number,
  userId: number,
): Promise<Project> {
  return (await requireProjectMembership(db, projectId, userId)).project;
}

export function requireOwner(project: Project, userId: number): void {
  if (project.ownerId !== userId) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'owner_only' });
  }
}

export function requirePermission(
  permissions: MemberPermissions,
  permission: keyof MemberPermissions,
  message: string,
): void {
  if (!permissions[permission]) {
    throw new TRPCError({ code: 'FORBIDDEN', message });
  }
}
