import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (status.data && !status.data.setupRequired) return <Navigate to="/login" replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    setup.mutate({ name, username, password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Welcome to Slang</h1>
        <p className="text-sm text-zinc-500">Create the first account. Setup locks afterwards.</p>
        <label className="block text-sm">
          <span className="text-zinc-600">Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 focus:border-zinc-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Username</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            minLength={2}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 focus:border-zinc-500 focus:outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="text-zinc-600">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 focus:border-zinc-500 focus:outline-none"
          />
        </label>
        {setup.error && <p className="text-sm text-red-600">{setup.error.message}</p>}
        <button
          type="submit"
          disabled={setup.isPending}
          className="w-full rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {setup.isPending ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </div>
  );
}
