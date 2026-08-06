import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout.js';
import { RequireAuth } from './components/RequireAuth.js';
import { LoginPage } from './pages/LoginPage.js';
import { ProjectPage } from './pages/ProjectPage.js';
import { ProjectsPage } from './pages/ProjectsPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { SetupPage } from './pages/SetupPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
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
