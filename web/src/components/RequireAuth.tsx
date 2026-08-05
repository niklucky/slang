import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { clearToken, getToken, trpc } from '../trpc.js';

/**
 * Guards authenticated pages. Invalid or missing tokens land on /login;
 * a server with no users at all lands on /setup.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const me = trpc.auth.me.useQuery(undefined, {
    enabled: getToken() !== null,
    retry: false,
  });
  const status = trpc.auth.status.useQuery();

  if (!getToken() || me.error) {
    if (status.data?.setupRequired) return <Navigate to="/setup" replace />;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (me.isPending || !me.data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}

export function useLogout(): () => void {
  return () => {
    clearToken();
    window.location.href = '/login';
  };
}
