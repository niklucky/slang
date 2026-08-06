import { TRPCError } from '@trpc/server';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import {
  invitations,
  projects,
  Role,
  users,
  usersToProjects,
  type Invitation,
  type User,
} from '../db/schema.js';
import { generateInvitationKey } from '../lib/ids.js';
import { hashPassword } from '../lib/password.js';
import type { Tx } from './words.js';

type Db = Database | Tx;

export const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

function newExpiry(): Date {
  return new Date(Date.now() + INVITATION_TTL_MS);
}

export function isExpired(invitation: Pick<Invitation, 'expiresAt'>): boolean {
  return invitation.expiresAt.getTime() <= Date.now();
}

/** Pending and unexpired invitations addressed to this user's email. */
function matchesUser(invitation: Invitation, user: { email: string | null }): boolean {
  return user.email !== null && invitation.email === user.email;
}

async function isProjectMember(db: Database, projectId: number, userId: number): Promise<boolean> {
  const [row] = await db
    .select({ projectId: usersToProjects.projectId })
    .from(usersToProjects)
    .where(and(eq(usersToProjects.projectId, projectId), eq(usersToProjects.userId, userId)))
    .limit(1);
  return row !== undefined;
}

export interface CreateInvitationResult {
  invitation: Invitation;
  /** The existing account holding this email, when any. */
  targetUser: User | null;
}

export async function createInvitation(
  db: Database,
  projectId: number,
  invitedById: number,
  rawEmail: string,
): Promise<CreateInvitationResult> {
  const email = rawEmail.trim().toLowerCase();

  const [targetUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (
    targetUser &&
    (targetUser.id === (await projectOwnerId(db, projectId)) ||
      (await isProjectMember(db, projectId, targetUser.id)))
  ) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'already_member' });
  }

  const [duplicate] = await db
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.projectId, projectId),
        eq(invitations.status, 'pending'),
        gt(invitations.expiresAt, new Date()),
        eq(invitations.email, email),
      ),
    )
    .limit(1);
  if (duplicate) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'already_invited' });
  }

  const [invitation] = await db
    .insert(invitations)
    .values({
      projectId,
      invitedById,
      email,
      key: generateInvitationKey(),
      expiresAt: newExpiry(),
    })
    .returning();
  if (!invitation) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
  return { invitation, targetUser: targetUser ?? null };
}

async function projectOwnerId(db: Database, projectId: number): Promise<number | null> {
  const [row] = await db
    .select({ ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return row?.ownerId ?? null;
}

/**
 * Resend support: rotates the key and extends the expiry of a pending
 * (possibly expired) invitation.
 */
export async function refreshInvitation(
  db: Database,
  invitationId: number,
  projectId: number,
): Promise<Invitation> {
  const [invitation] = await db
    .update(invitations)
    .set({ key: generateInvitationKey(), expiresAt: newExpiry(), updatedAt: new Date() })
    .where(
      and(
        eq(invitations.id, invitationId),
        eq(invitations.projectId, projectId),
        eq(invitations.status, 'pending'),
      ),
    )
    .returning();
  if (!invitation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'invitation_not_found' });
  }
  return invitation;
}

/**
 * Invitation row without the redemption key — only the email recipient may
 * hold the key.
 */
export interface ProjectInvitation {
  id: number;
  projectId: number;
  invitedById: number;
  email: string;
  status: Invitation['status'];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  invitedByName: string;
}

export async function listInvitationsForProject(
  db: Database,
  projectId: number,
): Promise<ProjectInvitation[]> {
  return db
    .select({
      id: invitations.id,
      projectId: invitations.projectId,
      invitedById: invitations.invitedById,
      email: invitations.email,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      createdAt: invitations.createdAt,
      updatedAt: invitations.updatedAt,
      invitedByName: users.name,
    })
    .from(invitations)
    .innerJoin(users, eq(invitations.invitedById, users.id))
    .where(eq(invitations.projectId, projectId))
    .orderBy(desc(invitations.createdAt));
}

export interface PendingInvitationView {
  id: number;
  projectId: number;
  projectName: string;
  inviterName: string;
  expiresAt: Date;
}

export async function listPendingInvitationsForUser(
  db: Database,
  user: { email: string | null },
): Promise<PendingInvitationView[]> {
  if (!user.email) return [];
  return db
    .select({
      id: invitations.id,
      projectId: projects.id,
      projectName: projects.name,
      inviterName: users.name,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(projects, eq(invitations.projectId, projects.id))
    .innerJoin(users, eq(invitations.invitedById, users.id))
    .where(
      and(
        eq(invitations.status, 'pending'),
        gt(invitations.expiresAt, new Date()),
        isNull(projects.deletedAt),
        eq(invitations.email, user.email),
      ),
    )
    .orderBy(invitations.createdAt);
}

export async function acceptInvitation(
  db: Database,
  invitationId: number,
  user: { id: number; email: string | null },
): Promise<Invitation> {
  return db.transaction(async (tx) => {
    const invitation = await findRedeemable(tx, invitationId, user);
    const [updated] = await tx
      .update(invitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id))
      .returning();
    await tx
      .insert(usersToProjects)
      .values({
        projectId: invitation.projectId,
        userId: user.id,
        assignedById: invitation.invitedById,
        roleId: Role.EDITOR,
      })
      .onConflictDoNothing();
    return updated!;
  });
}

export async function declineInvitation(
  db: Database,
  invitationId: number,
  user: { email: string | null },
): Promise<Invitation> {
  const invitation = await findRedeemable(db, invitationId, user);
  const [updated] = await db
    .update(invitations)
    .set({ status: 'declined', updatedAt: new Date() })
    .where(eq(invitations.id, invitation.id))
    .returning();
  return updated!;
}

async function findRedeemable(
  db: Db,
  invitationId: number,
  user: { email: string | null },
): Promise<Invitation> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.id, invitationId))
    .limit(1);
  if (
    !invitation ||
    invitation.status !== 'pending' ||
    isExpired(invitation) ||
    !matchesUser(invitation, user)
  ) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'invitation_not_found' });
  }
  return invitation;
}

export interface ResolvedInvitation {
  email: string;
  projectName: string;
  inviterName: string;
}

/** Public lookup for the registration page; hides the key itself. */
export async function resolveInvitationByKey(db: Database, key: string): Promise<ResolvedInvitation> {
  const invitation = await findActiveByKey(db, key);
  if (!invitation) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'invitation_not_found' });
  }
  const [[project], [inviter]] = await Promise.all([
    db
      .select({ name: projects.name })
      .from(projects)
      .where(and(eq(projects.id, invitation.projectId), isNull(projects.deletedAt)))
      .limit(1),
    db.select({ name: users.name }).from(users).where(eq(users.id, invitation.invitedById)).limit(1),
  ]);
  if (!project || !inviter) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'invitation_not_found' });
  }
  return { email: invitation.email, projectName: project.name, inviterName: inviter.name };
}

async function findActiveByKey(db: Db, key: string): Promise<Invitation | null> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(and(eq(invitations.key, key), eq(invitations.status, 'pending')))
    .limit(1);
  if (!invitation || isExpired(invitation)) return null;
  return invitation;
}

export interface RegisterWithInvitationInput {
  key: string;
  name: string;
  password: string;
}

/**
 * Redeems an invitation: creates the account under the invited email, marks
 * the invitation accepted and adds the membership — all in one transaction.
 */
export async function registerWithInvitation(
  db: Database,
  input: RegisterWithInvitationInput,
): Promise<User> {
  return db.transaction(async (tx) => {
    const invitation = await findActiveByKey(tx, input.key);
    if (!invitation) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'invitation_not_found' });
    }

    const [emailTaken] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.email))
      .limit(1);
    if (emailTaken) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'email_taken' });
    }

    const [user] = await tx
      .insert(users)
      .values({
        email: invitation.email,
        name: input.name,
        password: await hashPassword(input.password),
      })
      .returning();
    if (!user) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

    await tx
      .update(invitations)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
    await tx
      .insert(usersToProjects)
      .values({
        projectId: invitation.projectId,
        userId: user.id,
        assignedById: invitation.invitedById,
        roleId: Role.EDITOR,
      })
      .onConflictDoNothing();
    return user;
  });
}
