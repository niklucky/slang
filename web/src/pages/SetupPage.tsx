import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { PublicLayout } from '../components/layout/PublicLayout.js';
import { Button } from '../components/ui/button.js';
import { Field, Input } from '../components/ui/input.js';
import { setToken, trpc } from '../trpc.js';

export function SetupPage() {
  const navigate = useNavigate();
  const status = trpc.auth.status.useQuery();
  const setup = trpc.auth.setup.useMutation({
    onSuccess: ({ accessToken }) => {
      setToken(accessToken);
      navigate('/projects', { replace: true });
    },
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (status.data && !status.data.setupRequired) return <Navigate to="/login" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    setup.mutate({ name, email, password });
  }

  return (
    <PublicLayout>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Welcome to Slang</h1>
          <p className="mt-1 text-xs text-ink-3">Create the first account. Setup locks afterwards.</p>
        </div>
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Email">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
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
        {setup.error && <p className="text-sm text-danger">{setup.error.message}</p>}
        <Button type="submit" disabled={setup.isPending} className="w-full">
          {setup.isPending ? 'Creating…' : 'Create account'}
        </Button>
      </form>
    </PublicLayout>
  );
}
