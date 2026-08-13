import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { ProjectFormModal } from "../components/ProjectFormModal.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { LocaleFlag } from "../components/ui/locale-flag.js";
import { MemberStack } from "../components/ui/member-stack.js";
import { cx } from "../lib/cx.js";
import { formatRelativeTime } from "../lib/time.js";
import { trpc } from "../trpc.js";

/** 12-column grid template shared by the header row and every body row. */
const GRID = "grid grid-cols-12 items-center";

/** Column spans must sum to 12 so header and body cells line up. */
const spans = {
  id: "col-span-1",
  name: "col-span-3",
  locales: "col-span-2",
  members: "col-span-2",
  keys: "col-span-1",
  untranslated: "col-span-2",
  updated: "col-span-1",
} as const;

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

      {projects.data && projects.data.length > 0 && (
        <div className="overflow-x-auto">
          <div className="flex min-w-[760px] flex-col gap-2 p-2">
            <div
              className={cx(
                GRID,
                "text-xs font-medium uppercase tracking-wide text-ink-3",
              )}
            >
              <div className={cx(spans.id, "px-3 py-2")}>ID</div>
              <div className={cx(spans.name, "px-3 py-2")}>Name</div>
              <div className={cx(spans.locales, "px-3 py-2")}>Locales</div>
              <div className={cx(spans.members, "px-3 py-2")}>Members</div>
              <div className={cx(spans.keys, "px-3 py-2 text-right")}>Keys</div>
              <div className={cx(spans.untranslated, "px-3 py-2 text-right")}>
                Untranslated
              </div>
              <div className={cx(spans.updated, "px-3 py-2 text-right")}>
                Updated
              </div>
            </div>

            {projects.data.map((project) => {
              const isDeleted = project.deletedAt !== null;
              const rowClass = cx(
                GRID,
                "w-full rounded-md text-left text-sm shadow-md transition",
                isDeleted
                  ? "bg-danger-soft/40 hover:bg-danger-soft/60"
                  : "bg-surface hover:shadow-lg",
              );

              const cells = (
                <>
                  <div
                    className={cx(
                      spans.id,
                      "px-3 py-2.5 text-xs tabular-nums text-ink-3",
                    )}
                  >
                    #{project.id}
                  </div>

                  <div className={cx(spans.name, "min-w-0 px-3 py-2.5")}>
                    <div className="flex items-center gap-2">
                      <span
                        className="truncate font-medium text-ink"
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      {isDeleted && <Badge tone="danger">Deleted</Badge>}
                    </div>
                    {project.description && (
                      <div
                        className="truncate text-xs text-ink-3"
                        title={project.description}
                      >
                        {project.description}
                      </div>
                    )}
                  </div>

                  <div className={cx(spans.locales, "min-w-0 px-3 py-2.5")}>
                    {project.locales.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {project.locales.map((locale) => (
                          <LocaleFlag
                            key={locale.id}
                            code={locale.code}
                            name={locale.name}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-3">—</span>
                    )}
                  </div>

                  <div className={cx(spans.members, "min-w-0 px-3 py-2.5")}>
                    <MemberStack
                      stacked={false}
                      size="xs"
                      names={project.members.map((member) => member.name)}
                    />
                  </div>

                  <div
                    className={cx(
                      spans.keys,
                      "px-3 py-2.5 text-right tabular-nums text-ink-2",
                    )}
                  >
                    {project.wordCount}
                  </div>

                  <div
                    className={cx(
                      spans.untranslated,
                      "px-3 py-2.5 text-right tabular-nums",
                      project.untranslatedCount > 0
                        ? "text-warning"
                        : "text-ink-3",
                    )}
                  >
                    {project.untranslatedCount}
                  </div>

                  <div
                    className={cx(
                      spans.updated,
                      "px-3 py-2.5 text-right text-xs text-ink-3",
                    )}
                    title={new Date(project.lastActivityAt).toLocaleString()}
                  >
                    {formatRelativeTime(project.lastActivityAt)}
                  </div>
                </>
              );

              return isDeleted ? (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setEditingProjectId(project.id)}
                  className={rowClass}
                  title="Deleted — open to restore or delete permanently"
                >
                  {cells}
                </button>
              ) : (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className={rowClass}
                >
                  {cells}
                </Link>
              );
            })}
          </div>
        </div>
      )}

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
