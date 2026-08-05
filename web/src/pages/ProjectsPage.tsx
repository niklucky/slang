import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { trpc } from '../trpc.js';

export function ProjectsPage() {
  const utils = trpc.useUtils();
  const projects = trpc.projects.list.useQuery();
  const create = trpc.projects.create.useMutation({
    onSuccess: () => {
      void utils.projects.list.invalidate();
      setName('');
      setUrl('');
      setDescription('');
    },
  });

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name, url, ...(description ? { description } : {}) });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900">Projects</h1>
      </div>

      <form onSubmit={submit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-700">New project</h2>
        <div className="flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            required
            className="w-48 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            required
            className="w-64 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            className="min-w-64 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={create.isPending}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {create.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
        {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
      </form>

      {projects.isPending && <p className="text-sm text-zinc-500">Loading…</p>}
      {projects.data?.length === 0 && (
        <p className="text-sm text-zinc-500">No projects yet — create the first one above.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.data?.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400"
          >
            <div className="font-medium text-zinc-900">{project.name}</div>
            <div className="mt-1 text-sm text-zinc-500">
              {project.wordCount} keys · {project.localeCount} locales
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
