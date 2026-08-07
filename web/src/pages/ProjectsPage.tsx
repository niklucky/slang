import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ProjectFormModal } from "../components/ProjectFormModal.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { trpc } from "../trpc.js";

export function ProjectsPage() {
  const projects = trpc.projects.list.useQuery();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold tracking-tight">Projects</h1>
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
        {projects.data?.map((project) => (
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
            </div>
          </Link>
        ))}
      </div>

      <ProjectFormModal
        mode="create"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
