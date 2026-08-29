import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { invitations, type Project } from '../src/db/schema.js';
import { openTestDb, resetDb, seedUser, trpc } from './helpers.js';

const handle = openTestDb();
const app = createApp(handle.db);

beforeEach(() => resetDb(handle));
afterAll(() => handle.close());

interface AuthResult {
  user: { id: number; email: string };
  accessToken: string;
}

interface PendingInvitation {
  id: number;
  projectId: number;
  projectName: string;
  inviterName: string;
}

interface MembersResult {
  isOwner: boolean;
  members: Array<{
    userId: number;
    email: string;
    isOwner: boolean;
    canCreateKeys: boolean;
    canTranslate: boolean;
    canDeleteKeys: boolean;
  }>;
  invitations: Array<{
    id: number;
    email: string;
    status: string;
  }>;
}

/** Invitation rows straight from the db (the API never exposes keys). */
function dbInvitations(projectId: number) {
  return handle.db
    .select()
    .from(invitations)
    .where(eq(invitations.projectId, projectId))
    .orderBy(invitations.createdAt);
}

interface ResolvedInvitation {
  email: string;
  projectName: string;
  inviterName: string;
}

async function login(email: string): Promise<AuthResult> {
  const user = await seedUser(handle, email);
  const result = await trpc<AuthResult>(app, 'auth.login', {
    input: { email, password: 'password123' },
  });
  return { user: { id: user.id, email }, accessToken: result.accessToken };
}

async function createProject(token: string, name = 'Demo'): Promise<Project> {
  return trpc<Project>(app, 'projects.create', { input: { name, url: null }, token });
}

async function setupProjectWithBob() {
  const alice = await login('alice@example.com');
  const bob = await login('bob@example.com');
  const project = await createProject(alice.accessToken);
  return { alice, bob, project };
}

describe('invitations to existing accounts (banner)', () => {
  it('invite creates a pending invitation visible in the invitee banner', async () => {
    const { alice, bob, project } = await setupProjectWithBob();

    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });

    const pending = await trpc<PendingInvitation[]>(app, 'invitations.myPending', {
      kind: 'query',
      token: bob.accessToken,
    });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      projectId: project.id,
      projectName: 'Demo',
      inviterName: 'alice',
    });

    // The inviter has no banner of their own.
    const alicePending = await trpc<PendingInvitation[]>(app, 'invitations.myPending', {
      kind: 'query',
      token: alice.accessToken,
    });
    expect(alicePending).toEqual([]);
  });

  it('accept grants membership; the invitation is single-use', async () => {
    const { alice, bob, project } = await setupProjectWithBob();
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });
    const members = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    const invitation = members.invitations[0]!;

    await trpc(app, 'invitations.accept', {
      input: { invitationId: invitation.id },
      token: bob.accessToken,
    });

    const bobProjects = await trpc<Project[]>(app, 'projects.list', {
      kind: 'query',
      token: bob.accessToken,
    });
    expect(bobProjects.map((p) => p.id)).toContain(project.id);

    const after = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    expect(after.members.map((m) => m.email)).toEqual(['alice@example.com', 'bob@example.com']);
    expect(after.invitations[0]!.status).toBe('accepted');

    await expect(
      trpc(app, 'invitations.accept', {
        input: { invitationId: invitation.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('decline removes the invitation from the banner', async () => {
    const { alice, bob, project } = await setupProjectWithBob();
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });
    const members = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });

    await trpc(app, 'invitations.decline', {
      input: { invitationId: members.invitations[0]!.id },
      token: bob.accessToken,
    });

    const pending = await trpc<PendingInvitation[]>(app, 'invitations.myPending', {
      kind: 'query',
      token: bob.accessToken,
    });
    expect(pending).toEqual([]);
  });

  it('rejects inviting members, duplicates and malformed emails', async () => {
    const { alice, bob, project } = await setupProjectWithBob();
    // bob is not a member yet; invite a third user and accept first.
    const carol = await login('carol@example.com');

    await expect(
      trpc(app, 'projects.invite', {
        input: { projectId: project.id, email: 'not-an-email' },
        token: alice.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'carol@example.com' },
      token: alice.accessToken,
    });
    const members = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    await trpc(app, 'invitations.accept', {
      input: { invitationId: members.invitations[0]!.id },
      token: carol.accessToken,
    });

    await expect(
      trpc(app, 'projects.invite', {
        input: { projectId: project.id, email: 'carol@example.com' },
        token: alice.accessToken,
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('already_member') });

    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });
    await expect(
      trpc(app, 'projects.invite', {
        input: { projectId: project.id, email: 'bob@example.com' },
        token: alice.accessToken,
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('already_invited') });

    // Non-members cannot invite (NOT_FOUND so project ids stay unenumerable).
    await expect(
      trpc(app, 'projects.invite', {
        input: { projectId: project.id, email: 'bob@example.com' },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('the invitations list is only returned to the owner', async () => {
    const { alice, bob, project } = await setupProjectWithBob();
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'someone@example.com' },
      token: alice.accessToken,
    });

    const ownerView = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    expect(ownerView.isOwner).toBe(true);
    expect(ownerView.invitations).toHaveLength(1);

    // Bob is not even a member of this project, so he cannot see it at all.
    await expect(
      trpc(app, 'projects.members', {
        kind: 'query',
        input: { projectId: project.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('members who are not owner see members but no invitations', async () => {
    const { alice, bob, project } = await setupProjectWithBob();
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });
    const invited = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    await trpc(app, 'invitations.accept', {
      input: { invitationId: invited.invitations[0]!.id },
      token: bob.accessToken,
    });

    const bobView = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: bob.accessToken,
    });
    expect(bobView.isOwner).toBe(false);
    expect(bobView.members.map((m) => m.email)).toEqual(['alice@example.com', 'bob@example.com']);
    expect(bobView.invitations).toEqual([]);
  });

  it('users.search tells whether an email already has an account', async () => {
    const { accessToken } = await login('alice@example.com');
    await seedUser(handle, 'bob@example.com');

    const found = await trpc<Array<{ email: string; name: string }>>(app, 'users.search', {
      kind: 'query',
      input: { email: 'bob@example.com' },
      token: accessToken,
    });
    expect(found).toMatchObject([{ email: 'bob@example.com', name: 'bob' }]);

    const missing = await trpc<Array<{ email: string }>>(app, 'users.search', {
      kind: 'query',
      input: { email: 'ghost@example.com' },
      token: accessToken,
    });
    expect(missing).toEqual([]);
  });
});

describe('invitations to new emails (registration)', () => {
  it('invite by email exposes a key that resolves and registers the account', async () => {
    const alice = await login('alice@example.com');
    const project = await createProject(alice.accessToken);

    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'New.User@Example.com' },
      token: alice.accessToken,
    });

    const members = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    expect(members.invitations[0]!.email).toBe('new.user@example.com');
    const invitation = (await dbInvitations(project.id))[0]!;

    const resolved = await trpc<ResolvedInvitation>(app, 'invitations.resolve', {
      kind: 'query',
      input: { key: invitation.key },
    });
    expect(resolved).toEqual({
      email: 'new.user@example.com',
      projectName: 'Demo',
      inviterName: 'alice',
    });

    const registered = await trpc<AuthResult>(app, 'auth.register', {
      input: { key: invitation.key, name: 'New User', password: 'password123' },
    });
    expect(registered.user.email).toBe('new.user@example.com');

    const projects = await trpc<Project[]>(app, 'projects.list', {
      kind: 'query',
      token: registered.accessToken,
    });
    expect(projects.map((p) => p.id)).toContain(project.id);

    // The key is single-use.
    await expect(
      trpc(app, 'invitations.resolve', { kind: 'query', input: { key: invitation.key } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      trpc(app, 'auth.register', {
        input: { key: invitation.key, name: 'Late', password: 'password123' },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects registration when an account with the invited email appeared meanwhile', async () => {
    const alice = await login('alice@example.com');
    const project = await createProject(alice.accessToken);
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'latecomer@example.com' },
      token: alice.accessToken,
    });
    const invitation = (await dbInvitations(project.id))[0]!;

    // Another flow creates the account for that email first.
    await seedUser(handle, 'latecomer@example.com');

    await expect(
      trpc(app, 'auth.register', {
        input: { key: invitation.key, name: 'Other', password: 'password123' },
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('email_taken') });
  });

  it('resolve fails for unknown keys', async () => {
    await expect(
      trpc(app, 'invitations.resolve', { kind: 'query', input: { key: 'nope' } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('expired invitations cannot be resolved, registered or bannered', async () => {
    const { alice, bob, project } = await setupProjectWithBob();
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'old@example.com' },
      token: alice.accessToken,
    });

    const past = new Date(Date.now() - 60_000);
    await handle.db
      .update(invitations)
      .set({ expiresAt: past })
      .where(eq(invitations.projectId, project.id));

    const pending = await trpc<PendingInvitation[]>(app, 'invitations.myPending', {
      kind: 'query',
      token: bob.accessToken,
    });
    expect(pending).toEqual([]);

    const rows = await dbInvitations(project.id);
    const emailInvitation = rows.find((i) => i.email === 'old@example.com')!;
    await expect(
      trpc(app, 'invitations.resolve', { kind: 'query', input: { key: emailInvitation.key } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('resend rotates the key and extends the expiry', async () => {
    const alice = await login('alice@example.com');
    const project = await createProject(alice.accessToken);
    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'friend@example.com' },
      token: alice.accessToken,
    });
    const invitation = (await dbInvitations(project.id))[0]!;

    await trpc(app, 'projects.resendInvitation', {
      input: { projectId: project.id, invitationId: invitation.id },
      token: alice.accessToken,
    });

    const refreshed = (await dbInvitations(project.id))[0]!;
    expect(refreshed.key).not.toBe(invitation.key);
    expect(refreshed.expiresAt.getTime()).toBeGreaterThan(invitation.expiresAt.getTime());

    // The old key stops working, the new one resolves.
    await expect(
      trpc(app, 'invitations.resolve', { kind: 'query', input: { key: invitation.key } }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      trpc(app, 'invitations.resolve', { kind: 'query', input: { key: refreshed.key } }),
    ).resolves.toMatchObject({ email: 'friend@example.com' });
  });
});

describe('member permissions', () => {
  async function setupMember() {
    const alice = await login('alice@example.com');
    const bob = await login('bob@example.com');
    const project = await createProject(alice.accessToken);
    const catalog = await trpc<Array<{ id: number; code: string }>>(app, 'locales.catalog', {
      kind: 'query',
      token: alice.accessToken,
    });
    const en = catalog.find((locale) => locale.code === 'en')!;

    await trpc(app, 'projects.invite', {
      input: { projectId: project.id, email: 'bob@example.com' },
      token: alice.accessToken,
    });
    const members = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    await trpc(app, 'invitations.accept', {
      input: { invitationId: members.invitations[0]!.id },
      token: bob.accessToken,
    });
    return { alice, bob, project, en };
  }

  it('new members get all permissions; owner can revoke them individually', async () => {
    const { alice, bob, project, en } = await setupMember();

    const members = await trpc<MembersResult>(app, 'projects.members', {
      kind: 'query',
      input: { projectId: project.id },
      token: alice.accessToken,
    });
    const bobRow = members.members.find((m) => m.email === 'bob@example.com')!;
    expect(bobRow).toMatchObject({
      canCreateKeys: true,
      canTranslate: true,
      canDeleteKeys: true,
    });

    // Bob can create keys and delete them with default permissions.
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, value: 'Hello' }],
      },
      token: bob.accessToken,
    });

    await trpc(app, 'projects.setMemberPermissions', {
      input: {
        projectId: project.id,
        userId: bobRow.userId,
        canCreateKeys: false,
        canTranslate: true,
        canDeleteKeys: false,
      },
      token: alice.accessToken,
    });

    // Translating an existing key still works.
    await trpc(app, 'words.upsert', {
      input: {
        projectId: project.id,
        key: 'greeting',
        translations: [{ localeId: en.id, value: 'Hi!' }],
      },
      token: bob.accessToken,
    });

    // Creating a new key is now forbidden.
    await expect(
      trpc(app, 'words.upsert', {
        input: {
          projectId: project.id,
          key: 'another',
          translations: [{ localeId: en.id, value: 'x' }],
        },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('create_keys_forbidden') });

    // Deleting is forbidden too.
    const list = (
      await trpc<{ items: Array<{ id: number }>; total: number; nextCursor: number | null }>(app, 'words.list', {
        kind: 'query',
        input: { projectId: project.id },
        token: bob.accessToken,
      })
    ).items;
    await expect(
      trpc(app, 'words.remove', {
        input: { projectId: project.id, wordId: list[0]!.id },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('delete_keys_forbidden') });

    // The owner ignores permission revocations.
    await trpc(app, 'words.remove', {
      input: { projectId: project.id, wordId: list[0]!.id },
      token: alice.accessToken,
    });

    // Owner permissions cannot be edited.
    await expect(
      trpc(app, 'projects.setMemberPermissions', {
        input: {
          projectId: project.id,
          userId: alice.user.id,
          canCreateKeys: false,
          canTranslate: false,
          canDeleteKeys: false,
        },
        token: alice.accessToken,
      }),
    ).rejects.toMatchObject({ message: expect.stringContaining('cannot_change_owner_permissions') });

    // Non-owners cannot edit permissions.
    await expect(
      trpc(app, 'projects.setMemberPermissions', {
        input: {
          projectId: project.id,
          userId: bobRow.userId,
          canCreateKeys: true,
          canTranslate: true,
          canDeleteKeys: true,
        },
        token: bob.accessToken,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
