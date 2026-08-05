import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import { Badge } from '../components/ui/badge.js';
import { Button } from '../components/ui/button.js';
import { Input } from '../components/ui/input.js';
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
      <h1 className="text-lg font-semibold tracking-tight">Projects</h1>

      <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-ink-2">New project</h2>
        <div className="flex flex-wrap gap-3">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            required
            className="w-48"
          />
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
            required
            className="w-64"
          />
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            className="min-w-64 flex-1"
          />
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
        {create.error && <p className="text-sm text-danger">{create.error.message}</p>}
      </form>

      {projects.isPending && <p className="text-sm text-ink-3">Loading…</p>}
      {projects.data?.length === 0 && (
        <p className="text-sm text-ink-3">No projects yet — create the first one above.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.data?.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <div className="font-medium text-ink">{project.name}</div>
            {project.description && (
              <div className="mt-1 text-sm text-ink-2">{project.description}</div>
            )}
            <div className="mt-2 flex items-center gap-2">
              <Badge>{project.wordCount} keys</Badge>
              <Badge>{project.localeCount} locales</Badge>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
