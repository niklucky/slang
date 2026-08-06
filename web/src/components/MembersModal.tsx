import { Mail, Send, UserPlus } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import type { ProjectInvitation, ProjectMember } from 'slang-server/trpc';

import { trpc } from '../trpc.js';
import { Avatar } from './ui/avatar.js';
import { Badge, type BadgeTone } from './ui/badge.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';
import { Modal } from './ui/modal.js';

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Dates travel as ISO strings over the plain-JSON tRPC link. */
type Wire<T, K extends keyof T> = Omit<T, K> & { [P in K]: string | Date };

interface MembersData {
  isOwner: boolean;
  members: Wire<ProjectMember, 'assignedAt'>[];
  invitations: Wire<ProjectInvitation, 'expiresAt' | 'createdAt' | 'updatedAt'>[];
}

export interface MembersModalProps {
  projectId: number;
  open: boolean;
  onClose: () => void;
}

export function MembersModal({ projectId, open, onClose }: MembersModalProps) {
  const members = trpc.projects.members.useQuery({ projectId }, { enabled: open });

  return (
    <Modal open={open} onClose={onClose} title="Members" size="lg" description="Invite collaborators and manage their permissions.">
      {members.isPending && <p className="text-sm text-ink-3">Loading…</p>}
      {members.error && <p className="text-sm text-danger">{members.error.message}</p>}
      {members.data && <MembersContent projectId={projectId} data={members.data} />}
    </Modal>
  );
}

type Member = MembersData['members'][number];
type Invitation = MembersData['invitations'][number];

function MembersContent({ projectId, data }: { projectId: number; data: MembersData }) {
  const utils = trpc.useUtils();
  const invalidate = () => void utils.projects.members.invalidate({ projectId });

  return (
    <div className="space-y-6">
      {data.isOwner && <InviteForm projectId={projectId} onInvited={invalidate} />}

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">
          Members ({data.members.length})
        </h3>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {data.members.map((member) => (
            <MemberRow
              key={member.userId}
              projectId={projectId}
              member={member}
              canManage={data.isOwner}
              onChanged={invalidate}
            />
          ))}
        </ul>
      </section>

      {/* The server only returns invitations to the owner. */}
      {data.isOwner && data.invitations.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">
            Invitations ({data.invitations.length})
          </h3>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {data.invitations.map((invitation) => (
              <InvitationRow
                key={invitation.id}
                projectId={projectId}
                invitation={invitation}
                onChanged={invalidate}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InviteForm({ projectId, onInvited }: { projectId: number; onInvited: () => void }) {
  const [email, setEmail] = useState('');
  const debounced = useDebounced(email.trim(), 300);
  const validEmail = looksLikeEmail(debounced);

  const search = trpc.users.search.useQuery({ email: debounced }, { enabled: validEmail });
  const invite = trpc.projects.invite.useMutation({
    onSuccess: () => {
      setEmail('');
      onInvited();
    },
  });

  const existingUser = search.data?.[0];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validEmail) return;
    invite.mutate({ projectId, email: debounced });
  }

  function errorMessage(message: string): string {
    switch (message) {
      case 'already_member':
        return 'This person is already a member of the project.';
      case 'already_invited':
        return 'This person already has a pending invitation.';
      case 'email_send_failed':
        return 'The invitation was saved, but the email could not be sent. Try resending it.';
      default:
        return message;
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email…"
        />
        <Button type="submit" disabled={invite.isPending || !validEmail}>
          <UserPlus size={14} />
          {invite.isPending ? 'Inviting…' : 'Invite'}
        </Button>
      </div>

      {validEmail && (
        <div className="rounded-lg border border-line bg-fill/50 px-3 py-2 text-xs text-ink-2">
          {search.isPending && 'Checking for an existing account…'}
          {!search.isPending && existingUser && (
            <span>
              <span className="font-medium">{existingUser.name}</span> already has an account —
              they will see the invitation in the app.
            </span>
          )}
          {!search.isPending && !existingUser && (
            <span>No account yet — they will register through the emailed link.</span>
          )}
        </div>
      )}

      {invite.error && <p className="text-sm text-danger">{errorMessage(invite.error.message)}</p>}
    </form>
  );
}

const PERMISSION_LABELS: Array<{ key: 'canCreateKeys' | 'canTranslate' | 'canDeleteKeys'; label: string }> = [
  { key: 'canCreateKeys', label: 'Create keys' },
  { key: 'canTranslate', label: 'Translate' },
  { key: 'canDeleteKeys', label: 'Delete keys' },
];

function MemberRow({
  projectId,
  member,
  canManage,
  onChanged,
}: {
  projectId: number;
  member: Member;
  canManage: boolean;
  onChanged: () => void;
}) {
  const setPermissions = trpc.projects.setMemberPermissions.useMutation({ onSuccess: onChanged });
  const editable = canManage && !member.isOwner;

  function toggle(key: (typeof PERMISSION_LABELS)[number]['key']) {
    setPermissions.mutate({
      projectId,
      userId: member.userId,
      canCreateKeys: key === 'canCreateKeys' ? !member.canCreateKeys : member.canCreateKeys,
      canTranslate: key === 'canTranslate' ? !member.canTranslate : member.canTranslate,
      canDeleteKeys: key === 'canDeleteKeys' ? !member.canDeleteKeys : member.canDeleteKeys,
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
      <Avatar name={member.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-ink">{member.name}</span>
          {member.isOwner && <Badge tone="accent">Owner</Badge>}
        </div>
        <div className="truncate text-xs text-ink-3">{member.email}</div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {PERMISSION_LABELS.map(({ key, label }) => (
          <label
            key={key}
            className={
              editable
                ? 'flex cursor-pointer items-center gap-1.5 text-xs text-ink-2'
                : 'flex items-center gap-1.5 text-xs text-ink-3 opacity-70'
            }
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-accent"
              checked={member[key]}
              disabled={!editable || setPermissions.isPending}
              onChange={() => toggle(key)}
            />
            {label}
          </label>
        ))}
      </div>
      {setPermissions.error && (
        <p className="w-full text-xs text-danger">{setPermissions.error.message}</p>
      )}
    </li>
  );
}

function invitationStatus(invitation: Invitation): { label: string; tone: BadgeTone } {
  if (invitation.status === 'accepted') return { label: 'Accepted', tone: 'success' };
  if (invitation.status === 'declined') return { label: 'Declined', tone: 'danger' };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return { label: 'Expired', tone: 'neutral' };
  }
  return { label: 'Pending', tone: 'warning' };
}

function InvitationRow({
  projectId,
  invitation,
  onChanged,
}: {
  projectId: number;
  invitation: Invitation;
  onChanged: () => void;
}) {
  const resend = trpc.projects.resendInvitation.useMutation({ onSuccess: onChanged });
  const status = invitationStatus(invitation);
  const canResend = invitation.status === 'pending';

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
      <Mail size={14} className="shrink-0 text-ink-3" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{invitation.email}</span>
      <span className="text-xs text-ink-3">by {invitation.invitedByName}</span>
      <Badge tone={status.tone}>{status.label}</Badge>
      {canResend && (
        <Button
          size="sm"
          variant="secondary"
          disabled={resend.isPending}
          onClick={() => resend.mutate({ projectId, invitationId: invitation.id })}
        >
          <Send size={12} />
          {resend.isPending ? 'Sending…' : 'Resend'}
        </Button>
      )}
      {resend.error && <p className="w-full text-xs text-danger">{resend.error.message}</p>}
    </li>
  );
}
