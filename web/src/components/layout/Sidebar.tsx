import { LogOut, Plus, X } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

import { cx } from "../../lib/cx.js";
import { formatRelativeTime } from "../../lib/time.js";
import { trpc } from "../../trpc.js";
import { useLogout } from "../RequireAuth.js";
import { Avatar } from "../ui/avatar.js";
import { IconButton } from "../ui/icon-button.js";
import { Logo } from "../ui/logo.js";
import { MemberStack } from "../ui/member-stack.js";
import { ProjectIcon } from "../ui/project-icon.js";
import { ThemeToggle } from "../ui/theme-toggle.js";

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const projects = trpc.projects.list.useQuery();
  const me = trpc.auth.me.useQuery();
  const logout = useLogout();
  const user = me.data;

  return (
    <aside className="sticky top-0 flex h-screen w-full flex-col border-r border-line md:w-64 md:shrink-0">
      <div className="flex items-center justify-between pr-3">
        <Link className="flex items-center gap-2.5 px-4 pb-4 pt-5" to="/">
          <Logo size="sm" />
          <span className="text-[15px] font-semibold tracking-tight">Slang</span>
        </Link>
        {onClose && (
          <IconButton label="Close menu" onClick={onClose}>
            <X size={18} />
          </IconButton>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        <div className="flex items-center justify-between px-1.5 pb-1.5 pt-3">
          <span className="text-xs font-medium text-ink-3">Projects</span>
          <NavLink
            to="/projects"
            aria-label="All projects"
            title="All projects"
            className="rounded-md p-1 text-ink-3 transition-colors hover:bg-fill hover:text-ink"
          >
            <Plus size={14} />
          </NavLink>
        </div>
        <ul className="space-y-0.5">
          {projects.data?.map((project) => (
            <li key={project.id}>
              <NavLink
                to={`/projects/${project.id}`}
                className={({ isActive }) =>
                  cx(
                    "block rounded-lg px-2.5 py-2 transition-colors",
                    isActive ? "bg-selected" : "hover:bg-fill",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-1.5">
                      <ProjectIcon
                        projectId={project.id}
                        name={project.name}
                        hasIcon={project.iconMimeType !== null}
                      />
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-ink-3">
                        #{project.id}
                      </span>
                      <span
                        className={cx(
                          "truncate",
                          isActive ? "font-medium text-ink" : "text-ink-2",
                        )}
                        title={project.name}
                      >
                        {project.name}
                      </span>
                      <span
                        className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-3"
                        title={`${project.wordCount} keys · ${project.untranslatedCount} untranslated`}
                      >
                        {project.wordCount}
                        <span className="px-0.5">|</span>
                        <span
                          className={cx(
                            project.untranslatedCount > 0 && "text-warning",
                          )}
                        >
                          {project.untranslatedCount}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className="truncate text-[11px] text-ink-3"
                        title={`Updated ${new Date(project.lastActivityAt).toLocaleString()}`}
                      >
                        {formatRelativeTime(project.lastActivityAt)}
                      </span>
                      <MemberStack
                        size="xs"
                        names={project.members.map((member) => member.name)}
                      />
                    </div>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        {projects.data?.length === 0 && (
          <p className="px-2.5 py-1 text-xs text-ink-3">No projects yet.</p>
        )}
      </nav>

      <div className="flex items-center gap-1.5 border-t border-line px-3 py-3">
        {user && (
          <>
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1 pl-1">
              <div className="truncate text-sm font-medium text-ink">
                {user.name}
              </div>
              <div className="truncate text-xs text-ink-3">{user.email}</div>
            </div>
          </>
        )}
        <ThemeToggle />
        <IconButton label="Log out" onClick={logout}>
          <LogOut size={16} />
        </IconButton>
      </div>
    </aside>
  );
}
