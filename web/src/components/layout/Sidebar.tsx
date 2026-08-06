import { Folder, LogOut, Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { cx } from '../../lib/cx.js';
import { trpc } from '../../trpc.js';
import { useLogout } from '../RequireAuth.js';
import { Avatar } from '../ui/avatar.js';
import { IconButton } from '../ui/icon-button.js';
import { Logo } from '../ui/logo.js';
import { ThemeToggle } from '../ui/theme-toggle.js';

export function Sidebar() {
  const projects = trpc.projects.list.useQuery();
  const me = trpc.auth.me.useQuery();
  const logout = useLogout();
  const user = me.data;

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <Logo size="sm" />
        <span className="text-[15px] font-semibold tracking-tight">Slang</span>
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
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-selected font-medium text-ink'
                      : 'text-ink-2 hover:bg-fill hover:text-ink',
                  )
                }
              >
                <Folder size={15} className="shrink-0 text-ink-3" />
                <span className="truncate">{project.name}</span>
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
              <div className="truncate text-sm font-medium text-ink">{user.name}</div>
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
