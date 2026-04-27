import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Anvil, X } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import IncusChat from './IncusChat';

// Floating anvil button. Hidden on auth/public pages and when the user
// is unauthenticated. Click toggles a slide-over panel anchored bottom-right.
const HIDDEN_PREFIXES = ['/login', '/forgot-password', '/payment-success', '/rsvp/', '/site/'];

export default function IncusLauncher() {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => !!s.accessToken);
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!isAuthenticated) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return null;
  if (pathname === '/incus') return null; // dedicated page already shows the chat

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Ask Incus"
        aria-label="Ask Incus"
        style={{ bottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        className={`fixed right-4 sm:right-6 z-40 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full border border-brass-gold/50 bg-gradient-to-br from-deep-blue via-navy to-deep-blue text-brass-gold shadow-[0_18px_40px_rgba(12,22,38,0.45)] transition-transform duration-200 hover:scale-105 hover:shadow-glow ${
          open ? 'rotate-45' : ''
        }`}
      >
        {open ? <X size={22} /> : <Anvil size={22} />}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          />
          <aside
            className="fixed right-2 left-2 z-40 flex flex-col overflow-hidden rounded-2xl border border-brass-gold/40 bg-[var(--surface-strong)] shadow-[0_30px_80px_rgba(12,22,38,0.55)] sm:left-auto sm:right-6 sm:w-[380px]"
            style={{ bottom: 'calc(max(1.5rem, env(safe-area-inset-bottom)) + 4.5rem)', height: 'min(640px, calc(100vh - 9rem))' }}
          >
            <header className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Anvil size={18} className="text-brass-gold" />
                <p className="font-display text-base">Incus</p>
                <span className="rounded-full bg-brass-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-brass-gold">Lodge mentor</span>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-md p-1 text-steel-grey hover:bg-white/5 hover:text-off-white">
                <X size={16} />
              </button>
            </header>
            <div className="flex-1 min-h-0">
              <IncusChat compact />
            </div>
          </aside>
        </>
      )}
    </>
  );
}
