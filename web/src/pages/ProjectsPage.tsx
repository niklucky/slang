import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ProjectFormModal } from "../components/ProjectFormModal.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { MemberStack } from "../components/ui/member-stack.js";
import { trpc } from "../trpc.js";

export function ProjectsPage() {
  const [showDeleted, setShowDeleted] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const projects = trpc.projects.list.useQuery(
    showDeleted ? { includeDeleted: true } : undefined,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
          <label
            className="flex cursor-pointer items-center gap-2 text-sm text-ink-2"
            title="Also show your deleted projects"
          >
            <input
              type="checkbox"
              className="accent-accent"
              checked={showDeleted}
              onChange={() => setShowDeleted((prev) => !prev)}
            />
            Show deleted
          </label>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={16} />
          New project
        </Button>
      </div>

      {projects.isPending && <p className="text-sm text-ink-3">Loading…</p>}
      {projects.data?.length === 0 && (
        <p className="text-sm text-ink-3">
          No projects yet — create the first one.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {projects.data?.map((project) =>
          project.deletedAt !== null ? (
            <button
              key={project.id}
              type="button"
              onClick={() => setEditingProjectId(project.id)}
              className="rounded-xl border border-danger/40 bg-danger-soft/40 p-4 text-left transition-colors hover:border-danger"
              title="Deleted — open to restore or delete permanently"
            >
              <div className="flex items-center gap-2">
                <div className="font-medium text-ink">{project.name}</div>
                <Badge tone="danger">Deleted</Badge>
              </div>
              {project.description && (
                <div className="mt-1 text-sm text-ink-2">
                  {project.description}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge>{project.wordCount} keys</Badge>
                <Badge>{project.localeCount} locales</Badge>
                <span className="ml-auto text-xs text-ink-3">
                  Deleted {new Date(project.deletedAt).toLocaleDateString()}
                </span>
              </div>
            </button>
          ) : (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
            >
              <div className="font-medium text-ink">{project.name}</div>
              {project.description && (
                <div className="mt-1 text-sm text-ink-2">
                  {project.description}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge>{project.wordCount} keys</Badge>
                <Badge>{project.localeCount} locales</Badge>
                {project.wordCount > 0 && (
                  <Badge
                    tone={project.untranslatedCount > 0 ? "warning" : "success"}
                  >
                    {project.untranslatedCount > 0
                      ? `${project.untranslatedCount} untranslated`
                      : "all translated"}
                  </Badge>
                )}
                <MemberStack
                  className="ml-auto"
                  names={project.members.map((member) => member.name)}
                />
              </div>
            </Link>
          ),
        )}
      </div>

      <ProjectFormModal
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      <ProjectFormModal
        mode="edit"
        projectId={editingProjectId ?? undefined}
        open={editingProjectId !== null}
        onClose={() => setEditingProjectId(null)}
      />
    </div>
  );
}
