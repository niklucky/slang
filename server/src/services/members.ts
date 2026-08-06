import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { Role, users, usersToProjects } from '../db/schema.js';

export interface MemberPermissions {
  canCreateKeys: boolean;
  canTranslate: boolean;
  canDeleteKeys: boolean;
}

export interface ProjectMember extends MemberPermissions {
  userId: number;
  email: string;
  name: string;
  roleId: number;
  isOwner: boolean;
  assignedAt: Date;
}

const FULL_PERMISSIONS: MemberPermissions = {
  canCreateKeys: true,
  canTranslate: true,
  canDeleteKeys: true,
};

/**
 * Members of a project, owner first. The owner is always included even if
 * their membership row is missing (defensive against legacy data).
 */
export async function listMembers(
  db: Database,
  projectId: number,
  ownerId: number,
): Promise<ProjectMember[]> {
  const rows = await db
    .select({
      user: users,
      membership: usersToProjects,
    })
    .from(usersToProjects)
    .innerJoin(users, eq(usersToProjects.userId, users.id))
    .where(eq(usersToProjects.projectId, projectId))
    .orderBy(usersToProjects.assignedAt);

  const members: ProjectMember[] = rows.map(({ user, membership }) => ({
    userId: user.id,
    email: user.email,
    name: user.name,
    roleId: membership.roleId,
    isOwner: user.id === ownerId,
    assignedAt: membership.assignedAt,
    canCreateKeys: user.id === ownerId ? true : membership.canCreateKeys,
    canTranslate: user.id === ownerId ? true : membership.canTranslate,
    canDeleteKeys: user.id === ownerId ? true : membership.canDeleteKeys,
  }));

  if (!members.some((member) => member.userId === ownerId)) {
    const [owner] = await db.select().from(users).where(eq(users.id, ownerId)).limit(1);
    if (owner) {
      members.unshift({
        userId: owner.id,
        email: owner.email,
        name: owner.name,
        roleId: Role.OWNER,
        isOwner: true,
        assignedAt: owner.createdAt,
        ...FULL_PERMISSIONS,
      });
    }
  }

  members.sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.assignedAt.getTime() - b.assignedAt.getTime());
  return members;
}

export async function setMemberPermissions(
  db: Database,
  projectId: number,
  userId: number,
  permissions: MemberPermissions,
): Promise<ProjectMember | null> {
  const [row] = await db
    .update(usersToProjects)
    .set({ ...permissions })
    .where(and(eq(usersToProjects.projectId, projectId), eq(usersToProjects.userId, userId)))
    .returning();
  if (!row) return null;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    roleId: row.roleId,
    isOwner: false,
    assignedAt: row.assignedAt,
    canCreateKeys: row.canCreateKeys,
    canTranslate: row.canTranslate,
    canDeleteKeys: row.canDeleteKeys,
  };
}
