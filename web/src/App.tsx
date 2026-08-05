import { Link, Navigate, Outlet, Route, Routes } from 'react-router-dom';

import { RequireAuth, useLogout } from './components/RequireAuth.js';
import { LoginPage } from './pages/LoginPage.js';
import { ProjectPage } from './pages/ProjectPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { SetupPage } from './pages/SetupPage.js';

function Shell() {
  const logout = useLogout();
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/projects" className="text-lg font-semibold tracking-tight text-zinc-900">
            Slang
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/projects" className="text-zinc-600 hover:text-zinc-900">
              Projects
            </Link>
            <button
              type="button"
              onClick={logout}
              className="text-zinc-600 hover:text-zinc-900"
            >
              Log out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Shell />
          </RequireAuth>
        }
      >
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
