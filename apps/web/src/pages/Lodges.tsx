import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Globe, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/shared/Button';
import StatusPill from '@/components/shared/StatusPill';

interface AdminLodge {
  id: string; name: string; number: string; slug: string | null;
  subdomain: string | null; siteMode: 'PUBLIC_PAGE' | 'LOGIN_DIRECT';
  domainStatus: string; isActive: boolean;
  province: { id: string; name: string };
  _count: { members: number };
}

interface Province {
  id: string; name: string;
}

export default function Lodges() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', number: '', slug: '', provinceId: '', siteMode: 'LOGIN_DIRECT' as const });

  const { data: lodges = [], isLoading } = useQuery<AdminLodge[]>({
    queryKey: ['admin-lodges'],
    queryFn: async () => {
      const { data } = await api.get('/tenants');
      return Array.isArray(data) ? data : (data?.lodges ?? []);
    },
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const { data: provinces = [] } = useQuery<Province[]>({
    queryKey: ['provinces'],
    queryFn: async () => {
      const { data } = await api.get('/provinces');
      // Tolerate both `{ provinces: [...] }` and bare `[...]` shapes.
      return Array.isArray(data) ? data : (data?.provinces ?? []);
    },
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const createMut = useMutation({
    mutationFn: async (payload: typeof draft) => (await api.post('/tenants', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lodges'] });
      qc.invalidateQueries({ queryKey: ['tenants-me'] });
      setCreating(false);
      setDraft({ name: '', number: '', slug: '', provinceId: '', siteMode: 'LOGIN_DIRECT' });
    },
  });

  if (user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-forge-orange" />
        <p className="text-off-white">Lodge administration is restricted to platform administrators.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-2">Platform</p>
          <h1 className="text-3xl text-off-white">Lodges</h1>
        </div>
        <Button onClick={() => setCreating(true)}><Plus size={16} /> Add lodge</Button>
      </div>

      {creating && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMut.mutate(draft); }}
          className="rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] p-6 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Lodge name">
              <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className={inputClass} placeholder="Vulcan Lodge" />
            </Field>
            <Field label="Lodge number">
              <input required value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                className={inputClass} placeholder="4510" />
            </Field>
            <Field label="Slug (subdomain)">
              <input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase() })}
                pattern="[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?"
                className={inputClass} placeholder="vulcan" />
            </Field>
            <Field label="Province">
              <select required value={draft.provinceId} onChange={(e) => setDraft({ ...draft, provinceId: e.target.value })}
                className={inputClass}>
                <option value="">Select…</option>
                {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={createMut.isPending}>Create lodge</Button>
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          </div>
          {createMut.isError && (
            <p className="text-sm text-forge-orange">
              {(createMut.error as any)?.response?.data?.error || 'Failed to create lodge'}
            </p>
          )}
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-steel-grey">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)]">
          <table className="w-full">
            <thead className="border-b border-[var(--border-subtle)] bg-white/[0.02] text-left">
              <tr>
                <Th>Lodge</Th>
                <Th>Province</Th>
                <Th>Subdomain</Th>
                <Th>Mode</Th>
                <Th>Members</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lodges.map((lodge) => (
                <tr key={lodge.id} className="border-b border-[var(--border-subtle)] last:border-b-0 hover:bg-white/[0.02]">
                  <Td>
                    <p className="font-medium text-off-white">{lodge.name}</p>
                    <p className="text-xs text-steel-grey">No. {lodge.number}</p>
                  </Td>
                  <Td><span className="text-sm text-steel-grey">{lodge.province?.name ?? '—'}</span></Td>
                  <Td>
                    {lodge.subdomain ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-brass-gold">
                        <Globe size={12} /> {lodge.subdomain}
                      </span>
                    ) : lodge.slug ? (
                      <span className="text-xs text-steel-grey">slug: {lodge.slug}</span>
                    ) : (
                      <span className="text-xs text-steel-grey/60">none</span>
                    )}
                  </Td>
                  <Td><span className="text-xs uppercase tracking-[0.12em] text-steel-grey">{lodge.siteMode.replace(/_/g, ' ')}</span></Td>
                  <Td><span className="text-sm text-off-white">{lodge._count?.members ?? 0}</span></Td>
                  <Td><StatusPill status={lodge.domainStatus} /></Td>
                  <Td className="text-right">
                    <Link to={`/lodges/${lodge.id}`} className="text-sm text-brass-gold hover:underline">
                      Manage →
                    </Link>
                  </Td>
                </tr>
              ))}
              {lodges.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-steel-grey">No lodges yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-2 text-sm text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none focus:ring-1 focus:ring-brass-gold/30';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-steel-grey">{label}</span>
      {children}
    </label>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-steel-grey">{children}</th>;
}
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-4 align-middle ${className}`}>{children}</td>;
}
