import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, CalendarCheck, Clock, Copy, Download, Plus, Search, X,
} from 'lucide-react';
import api from '@/lib/api';

type Category = 'LORE' | 'RITUAL' | 'SYMBOLISM' | 'RESPONSIBILITIES' | 'HISTORY';

interface Delivery {
  id: string;
  date: string;
  notes: string | null;
  member: { id: string; firstName: string; lastName: string } | null;
  meeting: { id: string; date: string; type: string } | null;
}

interface Lecture {
  id: string;
  lodgeId: string | null;
  slug: string;
  number: number | null;
  series: string | null;
  title: string;
  subtitle: string | null;
  category: Category;
  minutes: number;
  summary: string;
  object: string | null;
  takeaways: string[] | null;
  spine: { time: string; heading: string }[] | null;
  sources: string[] | null;
  scriptMd?: string | null;
  handoutUrl: string | null;
  status: 'AVAILABLE' | 'SCHEDULED' | 'DELIVERED' | 'RETIRED';
  notes: string | null;
  hasScript?: boolean;
  lastDelivered?: string | null;
  timesDelivered?: number;
  deliveries: Delivery[];
}

const CATEGORY_LABEL: Record<Category, string> = {
  LORE: 'Lore',
  RITUAL: 'Ritual',
  SYMBOLISM: 'Symbolism',
  RESPONSIBILITIES: 'Responsibilities',
  HISTORY: 'History',
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Lectures() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'ALL'>('ALL');
  const [len, setLen] = useState<'ALL' | 10 | 20>('ALL');
  const [openId, setOpenId] = useState<string | null>(null);
  const [logging, setLogging] = useState<Lecture | null>(null);

  const { data: lectures = [], isLoading } = useQuery<Lecture[]>({
    queryKey: ['lectures'],
    queryFn: async () => (await api.get('/lectures')).data,
  });

  const { data: detail } = useQuery<Lecture>({
    queryKey: ['lecture', openId],
    queryFn: async () => (await api.get(`/lectures/${openId}`)).data,
    enabled: Boolean(openId),
  });

  const copy = useMutation({
    mutationFn: async (id: string) => (await api.post(`/lectures/${id}/copy`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lectures'] }),
  });

  const logDelivery = useMutation({
    mutationFn: async (v: { id: string; date: string; notes: string }) =>
      (await api.post(`/lectures/${v.id}/deliveries`, { date: v.date, notes: v.notes })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lectures'] });
      setLogging(null);
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lectures.filter((l) => {
      if (cat !== 'ALL' && l.category !== cat) return false;
      if (len !== 'ALL' && l.minutes !== len) return false;
      if (!needle) return true;
      return (
        l.title.toLowerCase().includes(needle) ||
        (l.subtitle ?? '').toLowerCase().includes(needle) ||
        l.summary.toLowerCase().includes(needle)
      );
    });
  }, [lectures, q, cat, len]);

  const stats = useMemo(() => {
    const given = lectures.filter((l) => (l.timesDelivered ?? 0) > 0).length;
    return {
      total: lectures.length,
      given,
      unused: lectures.length - given,
      tens: lectures.filter((l) => l.minutes === 10).length,
      twenties: lectures.filter((l) => l.minutes === 20).length,
    };
  }, [lectures]);

  return (
    <div className="space-y-6">
      {/* header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--gold-soft)]">
            Open lodge · brethren only
          </p>
          <h1 className="mt-1 font-serif text-3xl text-white">Lectures</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/55">
            Papers for delivery in open lodge. The Director of Ceremonies programmes the season from
            here; the delivery log records what has already been given, and to whom.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="rounded-full border border-white/10 px-3 py-1">
            Visible to DC, WM and administrators
          </span>
        </div>
      </header>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'In the library', value: stats.total, icon: <BookOpen size={16} /> },
          { label: 'Given', value: stats.given, icon: <CalendarCheck size={16} /> },
          { label: 'Not yet used', value: stats.unused, icon: <Clock size={16} /> },
          { label: '10 / 20 min', value: `${stats.tens} / ${stats.twenties}`, icon: <Clock size={16} /> },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3"
          >
            <div className="flex items-center gap-2 text-[var(--gold-soft)]">{s.icon}</div>
            <p className="mt-2 font-serif text-2xl text-white">{s.value}</p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">{s.label}</p>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the library…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-[var(--border-strong)] focus:outline-none"
          />
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value as Category | 'ALL')}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="ALL">All subjects</option>
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={String(len)}
          onChange={(e) => setLen(e.target.value === 'ALL' ? 'ALL' : (Number(e.target.value) as 10 | 20))}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="ALL">Any length</option>
          <option value="10">10 minutes</option>
          <option value="20">20 minutes</option>
        </select>
      </div>

      {/* list */}
      {isLoading ? (
        <p className="py-12 text-center text-sm text-white/40">Loading the library…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <p className="text-sm text-white/50">No papers match that.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((l) => {
            const used = (l.timesDelivered ?? 0) > 0;
            return (
              <li
                key={l.id}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--border-strong)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                      {l.number != null && (
                        <span className="text-[var(--gold-soft)]">
                          {l.series ? `${l.series} · ` : ''}No. {l.number}
                        </span>
                      )}
                      <span className="text-white/35">{CATEGORY_LABEL[l.category]}</span>
                      <span className="text-white/35">{l.minutes} min</span>
                      {l.lodgeId === null && (
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/40">
                          Platform
                        </span>
                      )}
                      {used && (
                        <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[var(--gold-soft)]">
                          Given {l.timesDelivered}×
                        </span>
                      )}
                    </div>

                    <h2 className="mt-1.5 font-serif text-xl text-white">{l.title}</h2>
                    {l.subtitle && <p className="text-sm text-white/45">{l.subtitle}</p>}
                    <p className="mt-2 text-sm leading-relaxed text-white/65">{l.summary}</p>

                    {l.object && (
                      <p className="mt-2 text-xs text-white/40">
                        <span className="text-[var(--gold-soft)]">On the table — </span>
                        {l.object}
                      </p>
                    )}

                    {l.lastDelivered && (
                      <p className="mt-2 text-xs text-white/35">
                        Last given {fmt(l.lastDelivered)}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    <button
                      onClick={() => setOpenId(l.id)}
                      className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-[var(--border-strong)] hover:text-white"
                    >
                      Read
                    </button>
                    {l.handoutUrl && (
                      <a
                        href={l.handoutUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:border-[var(--border-strong)] hover:text-white"
                      >
                        <Download size={13} /> Handout
                      </a>
                    )}
                    <button
                      onClick={() => setLogging(l)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.05))] px-3 py-1.5 text-xs text-[var(--gold-soft)] transition hover:brightness-125"
                    >
                      <CalendarCheck size={13} /> Log
                    </button>
                    {l.lodgeId === null && (
                      <button
                        onClick={() => copy.mutate(l.id)}
                        disabled={copy.isPending}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:text-white disabled:opacity-40"
                      >
                        <Copy size={13} /> Copy
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* reader */}
      {openId && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          onClick={() => setOpenId(null)}
        >
          <div
            className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-[#0b1a3a] p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpenId(null)}
              className="float-right rounded-lg border border-white/10 p-1.5 text-white/60 hover:text-white"
            >
              <X size={16} />
            </button>

            {!detail ? (
              <p className="text-sm text-white/40">Loading…</p>
            ) : (
              <article className="space-y-5">
                <header>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--gold-soft)]">
                    {detail.series ?? 'Paper'} {detail.number != null ? `· No. ${detail.number}` : ''} ·{' '}
                    {detail.minutes} minutes
                  </p>
                  <h2 className="mt-1 font-serif text-3xl text-white">{detail.title}</h2>
                  {detail.subtitle && <p className="text-white/50">{detail.subtitle}</p>}
                </header>

                <p className="border-l-2 border-[var(--gold-soft)] pl-4 font-serif text-lg leading-relaxed text-white/85">
                  {detail.summary}
                </p>

                {detail.object && (
                  <p className="text-sm text-white/60">
                    <span className="text-[var(--gold-soft)]">On the table — </span>
                    {detail.object}
                  </p>
                )}

                {detail.takeaways?.length ? (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-soft)]">
                      Three things to take away
                    </h3>
                    <ol className="mt-2 space-y-2 text-sm text-white/75">
                      {detail.takeaways.map((t, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="text-[var(--gold-soft)]">{i + 1}</span>
                          <span>{t}</span>
                        </li>
                      ))}
                    </ol>
                  </section>
                ) : null}

                {detail.spine?.length ? (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-soft)]">
                      How the paper runs
                    </h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-white/70">
                      {detail.spine.map((s, i) => (
                        <li key={i} className="flex gap-4">
                          <span className="w-14 shrink-0 text-[var(--gold-soft)]">{s.time}</span>
                          <span>{s.heading}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {detail.scriptMd && (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-soft)]">
                      Script
                    </h3>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/75">
                      {detail.scriptMd}
                    </pre>
                  </section>
                )}

                {detail.sources?.length ? (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-soft)]">
                      Sources
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-white/60">
                      {detail.sources.map((s, i) => (
                        <li key={i}>— {s}</li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {detail.deliveries.length > 0 && (
                  <section>
                    <h3 className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-soft)]">
                      Delivery log
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-white/60">
                      {detail.deliveries.map((dv) => (
                        <li key={dv.id}>
                          {fmt(dv.date)}
                          {dv.member ? ` — ${dv.member.firstName} ${dv.member.lastName}` : ''}
                          {dv.notes ? ` · ${dv.notes}` : ''}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </article>
            )}
          </div>
        </div>
      )}

      {/* log delivery */}
      {logging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setLogging(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget as HTMLFormElement);
              logDelivery.mutate({
                id: logging.id,
                date: String(f.get('date') || ''),
                notes: String(f.get('notes') || ''),
              });
            }}
            className="w-full max-w-md space-y-4 rounded-2xl border border-white/10 bg-[#0f1b2e] p-6"
          >
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--gold-soft)]">
                Record a delivery
              </p>
              <h3 className="mt-1 font-serif text-xl text-white">{logging.title}</h3>
            </div>
            <label className="block text-sm">
              <span className="text-white/60">Date given</span>
              <input
                required
                type="date"
                name="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white focus:outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="text-white/60">Notes — who gave it, how it went</span>
              <textarea
                name="notes"
                rows={3}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-white focus:outline-none"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogging(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={logDelivery.isPending}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(201,168,76,0.22),rgba(201,168,76,0.06))] px-4 py-2 text-sm text-[var(--gold-soft)] disabled:opacity-50"
              >
                <Plus size={14} /> Record
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
