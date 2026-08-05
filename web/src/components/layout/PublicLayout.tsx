import type { ReactNode } from 'react';

import { Logo } from '../ui/logo.js';
import { ThemeToggle } from '../ui/theme-toggle.js';

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mb-6 flex items-center gap-2.5">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">Slang</span>
      </div>
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
