import { UserPlus } from 'lucide-react';

import { trpc } from '../trpc.js';
import { Button } from './ui/button.js';

/** Top-of-page banners for pending project invitations addressed to the user. */
export function InvitationBanner() {
  const utils = trpc.useUtils();
  const pending = trpc.invitations.myPending.useQuery();

  const invalidate = () => {
    void utils.invitations.myPending.invalidate();
    void utils.projects.list.invalidate();
    void utils.projects.members.invalidate();
  };
  const accept = trpc.invitations.accept.useMutation({ onSuccess: invalidate });
  const decline = trpc.invitations.decline.useMutation({ onSuccess: invalidate });

  if (!pending.data || pending.data.length === 0) return null;

  return (
    <div className="space-y-2">
      {pending.data.map((invitation) => {
        const busy =
          (accept.isPending && accept.variables?.invitationId === invitation.id) ||
          (decline.isPending && decline.variables?.invitationId === invitation.id);
        return (
          <div
            key={invitation.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3"
          >
            <UserPlus size={16} className="shrink-0 text-accent" />
            <p className="min-w-0 flex-1 text-sm text-ink">
              <span className="font-medium">{invitation.inviterName}</span> invited you to join{' '}
              <span className="font-medium">{invitation.projectName}</span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => accept.mutate({ invitationId: invitation.id })}
              >
                {accept.isPending && accept.variables?.invitationId === invitation.id
                  ? 'Accepting…'
                  : 'Accept'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => decline.mutate({ invitationId: invitation.id })}
              >
                {decline.isPending && decline.variables?.invitationId === invitation.id
                  ? 'Declining…'
                  : 'Decline'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
