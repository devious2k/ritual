import { useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Globe, Loader2, Mail, Plus, RefreshCw, Trash2, Upload, X, ExternalLink, Inbox as InboxIcon } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/shared/Button';
import StatusPill from '@/components/shared/StatusPill';

interface AdminLodge {
  id: string; name: string; number: string; slug: string | null;
  subdomain: string | null; siteMode: 'PUBLIC_PAGE' | 'LOGIN_DIRECT';
  domainStatus: string; domainError: string | null;
  domainProvisionedAt: string | null; isActive: boolean;
  meetingDay: string | null; venue: string | null; venueAddress: string | null;
  crestUrl: string | null;
  province: { id: string; name: string };
}

const inputClass =
  'w-full rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-2 text-sm text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none focus:ring-1 focus:ring-brass-gold/30';

export default function LodgeDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data: lodge, isLoading } = useQuery<AdminLodge | undefined>({
    queryKey: ['admin-lodge', id],
    queryFn: async () => {
      const { data } = await api.get('/tenants');
      const list: AdminLodge[] = Array.isArray(data) ? data : (data?.lodges ?? []);
      return list.find((l) => l.id === id);
    },
    enabled: !!id && user?.role === 'SUPER_ADMIN',
  });

  const [identity, setIdentity] = useState<Partial<AdminLodge> | null>(null);
  const draft = identity || lodge || {};

  const updateMut = useMutation({
    mutationFn: async (payload: Partial<AdminLodge>) => (await api.put(`/tenants/${id}`, payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lodges'] });
      qc.invalidateQueries({ queryKey: ['admin-lodge', id] });
      qc.invalidateQueries({ queryKey: ['tenants-me'] });
      setIdentity(null);
    },
  });

  const provisionMut = useMutation({
    mutationFn: async () => (await api.post(`/tenants/${id}/domain`)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-lodges'] });
      qc.invalidateQueries({ queryKey: ['admin-lodge', id] });
    },
  });

  const refreshMut = useMutation({
    mutationFn: async () => (await api.get(`/tenants/${id}/domain/status`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lodges'] }),
  });

  const removeMut = useMutation({
    mutationFn: async () => (await api.delete(`/tenants/${id}/domain`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-lodges'] }),
  });

  if (user?.role !== 'SUPER_ADMIN') {
    return <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 text-center text-off-white">Restricted.</div>;
  }

  if (isLoading || !lodge) {
    return <div className="flex items-center justify-center py-16 text-steel-grey"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link to="/lodges" className="text-steel-grey hover:text-off-white"><ChevronLeft /></Link>
        <div>
          <p className="eyebrow mb-1">{lodge.province.name}</p>
          <h1 className="text-3xl text-off-white">{lodge.name} <span className="text-steel-grey">No. {lodge.number}</span></h1>
        </div>
      </div>

      {/* Identity */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6">
        <h2 className="mb-4 text-xl text-off-white">Identity</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input value={draft.name ?? ''} onChange={(e) => setIdentity({ ...draft, name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Number">
            <input value={draft.number ?? ''} onChange={(e) => setIdentity({ ...draft, number: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Slug (sets the subdomain)">
            <input value={draft.slug ?? ''} onChange={(e) => setIdentity({ ...draft, slug: e.target.value.toLowerCase() })}
              pattern="[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?" className={inputClass} placeholder="vulcan" />
          </Field>
          <Field label="Site mode">
            <select value={draft.siteMode ?? 'LOGIN_DIRECT'}
              onChange={(e) => setIdentity({ ...draft, siteMode: e.target.value as 'PUBLIC_PAGE' | 'LOGIN_DIRECT' })}
              className={inputClass}>
              <option value="LOGIN_DIRECT">Direct to login</option>
              <option value="PUBLIC_PAGE">Public page</option>
            </select>
          </Field>
          <Field label="Meeting day">
            <input value={draft.meetingDay ?? ''} onChange={(e) => setIdentity({ ...draft, meetingDay: e.target.value })} className={inputClass} placeholder="Third Wednesday" />
          </Field>
          <Field label="Venue">
            <input value={draft.venue ?? ''} onChange={(e) => setIdentity({ ...draft, venue: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Crest / emblem">
            <CrestUpload
              value={draft.crestUrl ?? null}
              onChange={(next) => setIdentity({ ...draft, crestUrl: next })}
            />
          </Field>
          <Field label="Venue address">
            <input value={draft.venueAddress ?? ''} onChange={(e) => setIdentity({ ...draft, venueAddress: e.target.value })} className={inputClass} />
          </Field>
        </div>
        {identity && (
          <div className="mt-4 flex gap-3">
            <Button onClick={() => updateMut.mutate(identity)} loading={updateMut.isPending}>Save</Button>
            <Button variant="ghost" onClick={() => setIdentity(null)}>Cancel</Button>
          </div>
        )}
      </section>

      {/* Email & Routing */}
      <MailSection lodgeId={id} />

      {/* Domain */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl text-off-white">Domain</h2>
          <StatusPill status={lodge.domainStatus} />
        </div>

        {lodge.subdomain ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-brass-gold">
              <Globe size={16} />
              <a
                href={`https://${lodge.subdomain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline inline-flex items-center gap-1"
              >
                {lodge.subdomain}<ExternalLink size={12} />
              </a>
            </div>
            {lodge.domainError && (
              <p className="rounded-lg border border-forge-orange/30 bg-forge-orange/10 p-3 text-sm text-forge-orange">
                {lodge.domainError}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => refreshMut.mutate()} loading={refreshMut.isPending}>
                <RefreshCw size={14} /> Refresh status
              </Button>
              <Button variant="danger" onClick={() => { if (confirm(`Tear down ${lodge.subdomain}?`)) removeMut.mutate(); }} loading={removeMut.isPending}>
                <Trash2 size={14} /> Remove
              </Button>
            </div>
            <p className="text-xs text-steel-grey">
              First request after provisioning may take 30–90 seconds while Vercel issues the SSL certificate.
            </p>
          </div>
        ) : lodge.slug ? (
          <div className="space-y-4">
            <p className="text-sm text-steel-grey">
              Provision <code className="rounded bg-white/5 px-1.5 py-0.5 text-brass-gold">{lodge.slug}.freemasons.app</code> — adds a Cloudflare CNAME and attaches the domain to the LodgeKey web project on Vercel.
            </p>
            <Button onClick={() => provisionMut.mutate()} loading={provisionMut.isPending}>
              <Globe size={14} /> Provision domain
            </Button>
            {provisionMut.isError && (
              <p className="text-sm text-forge-orange">
                {(provisionMut.error as any)?.response?.data?.error || 'Provision failed'}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-steel-grey">Set a slug above before provisioning a domain.</p>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-steel-grey">{label}</span>
      {children}
    </label>
  );
}

interface MailDomain {
  id: string; domain: string; kind: 'TENANT_SUBDOMAIN' | 'CUSTOM_DOMAIN';
  status: 'PENDING' | 'ACTIVE' | 'ERROR'; verificationToken: string | null;
  inboundError: string | null;
}
interface OfficeRow {
  office: string; localPart: string; label: string;
  holder: { name: string; email: string | null; memberId: string } | null;
  apexAddress: string | null;
}
interface InboundMessage {
  id: string; fromEmail: string; fromName: string | null;
  toEmail: string; recipientLocal: string; mappedOffice: string | null;
  subject: string; bodyText: string | null; status: string;
  spfPass: boolean; dkimPass: boolean; receivedAt: string;
}

function MailSection({ lodgeId }: { lodgeId: string }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');

  const { data: mailData } = useQuery<{ domains: MailDomain[]; offices: OfficeRow[]; lodgeSlug: string | null }>({
    queryKey: ['mail-domains', lodgeId],
    queryFn: async () => (await api.get(`/mail-domains/lodge/${lodgeId}`)).data,
  });

  const { data: inboxData } = useQuery<{ messages: InboundMessage[] }>({
    queryKey: ['lodge-inbox', lodgeId],
    queryFn: async () => (await api.get(`/inbox/lodge/${lodgeId}`)).data,
    refetchInterval: 30_000,
  });

  const addMut = useMutation({
    mutationFn: async (domain: string) =>
      (await api.post(`/mail-domains/lodge/${lodgeId}`, { domain })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mail-domains', lodgeId] });
      setAdding(false);
      setNewDomain('');
    },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/mail-domains/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mail-domains', lodgeId] }),
  });

  const domains = mailData?.domains ?? [];
  const offices = mailData?.offices ?? [];
  const messages = inboxData?.messages ?? [];

  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl text-off-white"><Mail size={18} /> Email & Routing</h2>
        <Button variant="secondary" onClick={() => setAdding(true)}><Plus size={14} /> Add domain</Button>
      </div>

      {adding && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (newDomain) addMut.mutate(newDomain.trim().toLowerCase()); }}
          className="mb-6 flex gap-3"
        >
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. vulcan.freemasons.app or vulcan4510.com"
            className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-2 text-sm text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none"
          />
          <Button type="submit" loading={addMut.isPending}>Add</Button>
          <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
        </form>
      )}

      {/* Mail domains */}
      <div className="mb-6 space-y-3">
        {domains.length === 0 && (
          <p className="text-sm text-steel-grey">No mail domains yet. Add one to start routing role-addressed mail through the lodge.</p>
        )}
        {domains.map((d) => (
          <div key={d.id} className="rounded-xl border border-[var(--border-subtle)] bg-white/[0.02] p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-off-white">{d.domain}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-steel-grey">{d.kind.replace('_', ' ').toLowerCase()}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={d.status} />
                <button
                  onClick={() => { if (confirm(`Remove ${d.domain}?`)) removeMut.mutate(d.id); }}
                  className="rounded-lg p-2 text-steel-grey transition-colors hover:bg-white/5 hover:text-forge-orange"
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {d.kind === 'CUSTOM_DOMAIN' && d.status === 'PENDING' && d.verificationToken && (
              <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-navy/40 p-3 text-xs text-steel-grey">
                <p className="mb-2 font-semibold uppercase tracking-[0.12em] text-brass-gold">DNS records to add at {d.domain}</p>
                <pre className="whitespace-pre-wrap break-all text-[11px] text-off-white/80">
{`MX   @                    route1.mx.cloudflare.net   priority 1
MX   @                    route2.mx.cloudflare.net   priority 2
MX   @                    route3.mx.cloudflare.net   priority 3
TXT  _lodgekey-verify     ${d.verificationToken}`}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Role address map */}
      {offices.length > 0 && (
        <div className="mb-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-steel-grey">Role addresses (current holders)</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {offices.map((o) => {
              const customDomain = domains.find((d) => d.kind === 'CUSTOM_DOMAIN' && d.status === 'ACTIVE');
              const primary = customDomain
                ? `${o.localPart}@${customDomain.domain}`
                : o.apexAddress; // <role>.<slug>@freemasons.app
              return (
                <OfficeRowCard key={o.office} office={o} primary={primary} lodgeId={lodgeId} />
              );
            })}
          </div>
        </div>
      )}

      {/* Inbox */}
      <div>
        <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-steel-grey">
          <InboxIcon size={12} /> Recent inbound mail
        </p>
        <div className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-sm text-steel-grey/70">Nothing received yet.</p>
          ) : messages.map((m) => (
            <div key={m.id} className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-off-white">{m.subject}</p>
                  <p className="truncate text-[11px] text-steel-grey">
                    From {m.fromName ? `${m.fromName} <${m.fromEmail}>` : m.fromEmail} →
                    {' '}<span className="text-brass-gold">{m.toEmail}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusPill status={m.status} />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-steel-grey/70">
                    {new Date(m.receivedAt).toLocaleString()}
                  </span>
                </div>
              </div>
              {m.bodyText && (
                <p className="mt-2 line-clamp-2 text-xs text-steel-grey">{m.bodyText.slice(0, 240)}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function OfficeRowCard({
  office, primary, lodgeId,
}: {
  office: OfficeRow; primary: string | null; lodgeId: string;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<string>(office.holder?.email ?? '');
  const [editing, setEditing] = useState(false);

  // Keep the draft in sync if the server-side data changes (e.g. switcher pulls
  // a refresh).
  if (!editing && draft !== (office.holder?.email ?? '')) {
    setDraft(office.holder?.email ?? '');
  }

  const saveMut = useMutation({
    mutationFn: async (email: string) => {
      if (!office.holder) throw new Error('No holder');
      return (await api.put(`/members/${office.holder.memberId}`, { email: email || null })).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mail-domains', lodgeId] });
      setEditing(false);
    },
  });

  const dirty = editing && draft !== (office.holder?.email ?? '');

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-off-white">
            {primary ? (
              <>
                <span className="text-brass-gold">{primary.split('@')[0]}</span>
                <span className="text-steel-grey">@{primary.split('@')[1]}</span>
              </>
            ) : (
              <span className="text-steel-grey/60">— set a slug to enable —</span>
            )}
          </p>
          <p className="truncate text-[11px] uppercase tracking-[0.12em] text-steel-grey">{office.label}</p>
        </div>
        <div className="text-right">
          {office.holder ? (
            <p className="truncate text-sm text-off-white">{office.holder.name}</p>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.12em] text-steel-grey/60">vacant</span>
          )}
        </div>
      </div>
      {office.holder && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="email"
            value={draft}
            onFocus={() => setEditing(true)}
            onChange={(e) => { setEditing(true); setDraft(e.target.value); }}
            placeholder="forwarding email…"
            className="w-full rounded-md border border-[var(--border-subtle)] bg-navy/40 px-2 py-1 text-xs text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/50 focus:outline-none"
          />
          {dirty && (
            <>
              <button
                onClick={() => saveMut.mutate(draft.trim())}
                disabled={saveMut.isPending}
                className="rounded-md bg-brass-gold/20 px-2 py-1 text-[11px] uppercase tracking-[0.06em] text-brass-gold hover:bg-brass-gold/30 disabled:opacity-50"
              >
                {saveMut.isPending ? '…' : 'Save'}
              </button>
              <button
                onClick={() => { setEditing(false); setDraft(office.holder?.email ?? ''); }}
                className="rounded-md px-2 py-1 text-[11px] text-steel-grey hover:text-forge-orange"
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}
      {saveMut.isError && (
        <p className="mt-1 text-[11px] text-forge-orange">
          {(saveMut.error as any)?.response?.data?.error || 'Failed to save'}
        </p>
      )}
    </div>
  );
}

const CREST_MAX_PX = 256;
const CREST_MAX_BYTES = 1024 * 1024; // 1 MB raw upload limit

async function compressToDataUrl(file: File): Promise<string> {
  if (file.size > CREST_MAX_BYTES) {
    throw new Error(`Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Keep it under 1 MB.`);
  }
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(CREST_MAX_PX / bitmap.width, CREST_MAX_PX / bitmap.height, 1);
  const w = Math.round(bitmap.width * ratio);
  const h = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(bitmap, 0, 0, w, h);
  // PNG preserves transparency for emblems; switch to image/jpeg if you need smaller files.
  return canvas.toDataURL('image/png');
}

function CrestUpload({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const dataUrl = await compressToDataUrl(file);
      onChange(dataUrl);
    } catch (e: any) {
      setError(e?.message || 'Could not read image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-white/5 overflow-hidden">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-contain p-1" />
          ) : (
            <span className="text-[10px] uppercase tracking-[0.18em] text-steel-grey/60">none</span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            // allow re-selecting the same file
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-off-white transition-colors hover:border-brass-gold/50 hover:bg-deep-blue disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {value ? 'Replace' : 'Upload image'}
        </button>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-steel-grey transition-colors hover:bg-white/5 hover:text-forge-orange"
            title="Remove crest"
          >
            <X size={14} /> Remove
          </button>
        )}
      </div>

      <p className="text-[11px] text-steel-grey/70">
        PNG, JPEG, WebP, or SVG. Resized to {CREST_MAX_PX}px. 1 MB max.
      </p>
      {error && <p className="text-xs text-forge-orange">{error}</p>}
    </div>
  );
}
