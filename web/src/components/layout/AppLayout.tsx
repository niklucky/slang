import { Menu } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { cx } from '../../lib/cx.js';
import { InvitationBanner } from '../InvitationBanner.js';
import { IconButton } from '../ui/icon-button.js';
import { Logo } from '../ui/logo.js';
import { Sidebar } from './Sidebar.js';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawerRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = drawerRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (menuOpen) {
      wasOpenRef.current = true;
      return;
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg px-4 py-2.5 md:hidden">
        <Link className="flex items-center gap-2.5" to="/">
          <Logo size="sm" />
          <span className="text-[15px] font-semibold tracking-tight">Slang</span>
        </Link>
        <IconButton
          ref={triggerRef}
          label="Open menu"
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={18} />
        </IconButton>
      </header>

      <div className="flex">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        <div
          className={cx('fixed inset-0 z-40 md:hidden', !menuOpen && 'pointer-events-none')}
          aria-hidden={!menuOpen}
          inert={!menuOpen}
        >
          <div
            className={cx(
              'absolute inset-0 bg-black/40 transition-opacity duration-200',
              menuOpen ? 'opacity-100' : 'opacity-0',
            )}
            onClick={() => setMenuOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            tabIndex={-1}
            className={cx(
              'absolute inset-y-0 left-0 w-72 max-w-[85vw] transform bg-bg shadow-xl transition-transform duration-200 ease-out focus:outline-none',
              menuOpen ? 'translate-x-0' : '-translate-x-full',
            )}
          >
            <Sidebar onClose={() => setMenuOpen(false)} />
          </div>
        </div>

        <main className="min-w-0 flex-1">
          <div className="space-y-4 px-4 py-6 md:px-6">
            <InvitationBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
