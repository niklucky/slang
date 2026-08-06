import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { PublicLayout } from '../components/layout/PublicLayout.js';
import { Button } from '../components/ui/button.js';
import { Field, Input } from '../components/ui/input.js';
import { setToken, trpc } from '../trpc.js';

export function RegisterPage() {
  const [params] = useSearchParams();
  const key = params.get('key') ?? '';

  const resolve = trpc.invitations.resolve.useQuery(
    { key },
    { enabled: key.length > 0, retry: false },
  );

  if (!key) return <Notice message="This invitation link is missing its key." />;
  if (resolve.isPending) return <Notice message="Checking invitation…" />;
  if (!resolve.data) {
    return <Notice message="This invitation is not found or has expired." />;
  }

  return (
    <RegisterForm
      key={resolve.data.email}
      invitationKey={key}
      email={resolve.data.email}
      projectName={resolve.data.projectName}
      inviterName={resolve.data.inviterName}
    />
  );
}

function Notice({ message }: { message: string }) {
  return (
    <PublicLayout>
      <div className="space-y-3">
        <h1 className="text-lg font-semibold tracking-tight">Invitation</h1>
        <p className="text-sm text-danger">{message}</p>
        <Button variant="secondary" className="w-full" onClick={() => (window.location.href = '/login')}>
          Go to sign in
        </Button>
      </div>
    </PublicLayout>
  );
}

interface RegisterFormProps {
  invitationKey: string;
  /** The invited address; the account is always created under it. */
  email: string;
  projectName: string;
  inviterName: string;
}

function RegisterForm({ invitationKey, email, projectName, inviterName }: RegisterFormProps) {
  const navigate = useNavigate();
  const register = trpc.auth.register.useMutation({
    onSuccess: ({ accessToken }) => {
      setToken(accessToken);
      navigate('/projects', { replace: true });
    },
  });

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    register.mutate({ key: invitationKey, name, password });
  }

  function errorMessage(message: string): string {
    switch (message) {
      case 'email_taken':
        return 'An account with this email already exists.';
      case 'invitation_not_found':
        return 'This invitation is not found or has expired.';
      default:
        return message;
    }
  }

  return (
    <PublicLayout>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Join {projectName}</h1>
          <p className="mt-1 text-xs text-ink-3">
            {inviterName} invited you to collaborate on Slang.
          </p>
        </div>
        <Field label="Email">
          <Input type="email" value={email} autoComplete="email" readOnly />
        </Field>
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
          />
        </Field>
        {register.error && (
          <p className="text-sm text-danger">{errorMessage(register.error.message)}</p>
        )}
        <Button type="submit" disabled={register.isPending} className="w-full">
          {register.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </PublicLayout>
  );
}
