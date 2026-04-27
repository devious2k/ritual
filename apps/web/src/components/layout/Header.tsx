import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { Menu, Moon, Sun, ChevronDown, LogOut, User } from 'lucide-react';

const breadcrumbMap: Record<string, string> = {
  '/': 'Overview',
  '/members': 'Members',
  '/meetings': 'Meetings',
  '/ceremonies': 'Ceremonies',
  '/dining': 'Dining',
  '/settings': 'Settings',
};

export default function Header() {
  const { toggleSidebar, darkMode, toggleDarkMode } = useUIStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentPage =
    breadcrumbMap[location.pathname] ??
    (location.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' / ') ||
      'Overview');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.email[0].toUpperCase()
    : '?';

  return (
    <header className="border-b border-[var(--border-subtle)] bg-[rgba(255,251,244,0.72)] px-3 backdrop-blur sm:px-4 md:px-6">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 sm:h-20 sm:gap-4">
        <button
          onClick={toggleSidebar}
          className="rounded-xl border border-[var(--border-subtle)] bg-white/50 p-2 text-[var(--ink-muted)] hover:bg-white lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.24em] text-[var(--ink-faint)] sm:text-[11px] sm:tracking-[0.28em]">LodgeKey</p>
          <h1 className="truncate font-display text-lg text-[var(--ink-strong)] sm:text-2xl">{currentPage}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="rounded-xl border border-[var(--border-subtle)] bg-white/50 p-2 text-[var(--ink-muted)] hover:bg-white"
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white/60 p-1.5 text-[var(--ink-strong)] hover:bg-white"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(11,25,43,0.95),rgba(27,42,74,0.92))] text-sm font-semibold text-[var(--gold-soft)]">
                {userInitials}
              </div>
              <ChevronDown size={16} className="hidden sm:block" />
            </button>

            {dropdownOpen ? (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] py-1 shadow-[0_18px_50px_rgba(12,22,38,0.18)]">
                <div className="border-b border-[var(--border-subtle)] px-4 py-3">
                  <p className="text-sm font-medium text-[var(--ink-strong)]">
                    {user?.firstName && user?.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user?.email ?? 'User'}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)]">{user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[var(--ink-strong)] hover:bg-white/70"
                >
                  <User size={16} />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-700 hover:bg-white/70"
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
