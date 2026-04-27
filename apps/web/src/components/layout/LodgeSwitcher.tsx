import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Building2, Check, Globe, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { useTenantStore, type TenantLodge } from '@/stores/tenantStore';
import { useAuthStore } from '@/stores/authStore';

interface MeResponse {
  lodges: TenantLodge[];
  role: string;
}

export default function LodgeSwitcher({ collapsed }: { collapsed: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const { activeLodgeId, lodges, setActive, setLodges } = useTenantStore();

  const { data } = useQuery<MeResponse>({
    queryKey: ['tenants-me'],
    queryFn: async () => (await api.get('/tenants/me')).data,
    enabled: !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.lodges) {
      setLodges(data.lodges);
      if (!activeLodgeId && data.lodges.length) {
        setActive(data.lodges[0].id);
      }
    }
  }, [data, activeLodgeId, setActive, setLodges]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const active = lodges.find((l) => l.id === activeLodgeId) || null;
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (collapsed) {
    return (
      <div className="flex h-20 items-center justify-center border-b border-white/10 px-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(212,175,55,0.95),rgba(161,124,43,0.92))] text-navy"
          title={active?.name || 'Select lodge'}
        >
          <Building2 size={18} />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative border-b border-white/10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(212,175,55,0.95),rgba(161,124,43,0.92))] text-navy shadow-[0_10px_30px_rgba(201,168,76,0.25)]">
          {active?.crestUrl ? (
            <img src={active.crestUrl} alt="" className="h-7 w-7 object-contain" />
          ) : (
            <Building2 size={18} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-base tracking-[0.04em] text-brass-gold">
            {active ? active.name : 'No lodge'}
          </p>
          <p className="truncate text-[10px] uppercase tracking-[0.24em] text-white/45">
            {active ? `No. ${active.number}` : (isSuperAdmin ? 'Super admin' : 'No access')}
          </p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-40 mt-2 rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(15,28,52,0.98),rgba(11,26,58,0.98))] shadow-[0_20px_60px_rgba(3,8,20,0.55)] backdrop-blur">
          <div className="max-h-72 overflow-y-auto p-2">
            {lodges.length === 0 && (
              <p className="px-3 py-4 text-xs text-white/55">
                {isSuperAdmin ? 'No lodges yet — create one below.' : 'You haven\'t been added to any lodge yet.'}
              </p>
            )}
            {lodges.map((lodge) => {
              const isActive = lodge.id === activeLodgeId;
              return (
                <button
                  key={lodge.id}
                  onClick={() => { setActive(lodge.id); setOpen(false); }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isActive ? 'bg-brass-gold/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white/5 text-brass-gold">
                    {lodge.crestUrl ? (
                      <img src={lodge.crestUrl} alt="" className="h-5 w-5 object-contain" />
                    ) : (
                      <Building2 size={14} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-off-white">{lodge.name}</p>
                    <p className="flex items-center gap-1.5 truncate text-[10px] uppercase tracking-[0.18em] text-white/45">
                      No. {lodge.number}
                      {lodge.subdomain && (
                        <span className="inline-flex items-center gap-1 normal-case tracking-normal text-brass-gold/70">
                          · <Globe size={10} /> {lodge.subdomain}
                        </span>
                      )}
                    </p>
                  </div>
                  {isActive && <Check size={14} className="shrink-0 text-brass-gold" />}
                </button>
              );
            })}
          </div>

          {isSuperAdmin && (
            <Link
              to="/lodges/new"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-brass-gold transition-colors hover:bg-white/5"
            >
              <Plus size={14} />
              Add a lodge
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
