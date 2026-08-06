import { Outlet } from 'react-router-dom';

import { InvitationBanner } from '../InvitationBanner.js';
import { Sidebar } from './Sidebar.js';

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="space-y-4 px-6 py-6">
          <InvitationBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
