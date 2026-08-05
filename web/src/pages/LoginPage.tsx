import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Sign in to Slang</h1>
        <label className="block text-sm">
          <span className="text-zinc-600">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 focus:border-zinc-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 focus:border-zinc-500 focus:outline-none"
          />
        </label>
        {login.error && (
          <p className="text-sm text-red-600">
            {login.error.message === 'bad_credentials' ? 'Wrong username or password.' : login.error.message}
          </p>
        )}
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
