import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { PublicLayout } from '../components/layout/PublicLayout.js';
import { Button } from '../components/ui/button.js';
import { Field, Input } from '../components/ui/input.js';
import { setToken, trpc } from '../trpc.js';

export function LoginPage() {
  const navigate = useNavigate();
  const status = trpc.auth.status.useQuery();
  const login = trpc.auth.login.useMutation({
    onSuccess: ({ accessToken }) => {
      setToken(accessToken);
      navigate('/projects', { replace: true });
    },
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (status.data?.setupRequired) return <Navigate to="/setup" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate({ username, password });
  }

  return (
    <PublicLayout>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-xs text-ink-3">Manage projects, locales and translations.</p>
        </div>
        <Field label="Username">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        {login.error && (
          <p className="text-sm text-danger">
            {login.error.message === 'bad_credentials' ? 'Wrong username or password.' : login.error.message}
          </p>
        )}
        <Button type="submit" disabled={login.isPending} className="w-full">
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </PublicLayout>
  );
}
