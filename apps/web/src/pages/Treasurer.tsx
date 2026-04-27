import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, Coins, Edit3, RefreshCcw, Wallet, Users as UsersIcon } from 'lucide-react';
import api from '@/lib/api';

interface DueRow {
  memberId: string;
  memberName: string;
  recordId: string | null;
  amount: number | null;
  status: string;
  dueDate: string;
  paidDate: string | null;
  paidAmount: number | null;
}

interface JoiningRow {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  dueDate: string | null;
  paidDate: string | null;
  paidAmount: number | null;
  notes: string | null;
}

interface DashboardData {
  lodge: {
    id: string; name: string; number: string;
    annualDues: number | null; joiningFee: number | null;
    masonicYearStartMonth: number;
    bankSortCode: string | null; bankAccount: string | null; bankAccountName: string | null;
  };
  cycle: { startYear: number; endYear: number; startDate: string; label: string };
  totals: {
    memberCount: number;
    subsCharged: number; subsCollected: number; subsOutstanding: number; subsCollectedCount: number;
    joiningCharged: number; joiningCollected: number; joiningOutstanding: number;
  };
  dues: DueRow[];
  joiningFees: JoiningRow[];
}

const gbp = (n: number | null) =>
  n == null ? '—' : new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

export default function Treasurer() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['treasurer-dashboard'],
    queryFn: async () => (await api.get('/treasurer/dashboard')).data,
  });

  const rollMut = useMutation({
    mutationFn: async () => (await api.post('/treasurer/dues/roll')).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treasurer-dashboard'] }),
  });

  const markDuesPaidMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/treasurer/dues/${id}/mark-paid`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treasurer-dashboard'] }),
  });

  const markJoiningPaidMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/treasurer/joining-fees/${id}/mark-paid`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treasurer-dashboard'] }),
  });

  if (isLoading || !data) return <div className="py-16 text-center text-steel-grey">Loading treasurer…</div>;

  const { lodge, cycle, totals, dues, joiningFees } = data;
  const collectionRate = totals.subsCharged > 0 ? Math.round((totals.subsCollected / totals.subsCharged) * 100) : 0;

  return (
    <div className="space-y-8">
      <header className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8">
        <p className="eyebrow mb-1">Treasurer · Masonic Year {cycle.label}</p>
        <h1 className="font-display text-4xl text-[var(--ink-strong)]">{lodge.name} No. {lodge.number}</h1>
        <p className="mt-2 text-sm text-steel-grey">
          Annual subscription <strong className="text-[var(--ink-strong)]">{gbp(lodge.annualDues)}</strong> · Joining fee <strong className="text-[var(--ink-strong)]">{gbp(lodge.joiningFee)}</strong>
          {lodge.bankSortCode && lodge.bankAccount ? <> · Bank {lodge.bankSortCode} / {lodge.bankAccount}</> : null}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => setEditing((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-sm border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-steel-grey hover:border-brass-gold/40 hover:text-brass-gold">
            <Edit3 size={14} /> {editing ? 'Close editor' : 'Edit fee config'}
          </button>
          <button onClick={() => { if (confirm(`Generate dues for every active member at ${gbp(lodge.annualDues)} for ${cycle.label}?`)) rollMut.mutate(); }}
            disabled={rollMut.isPending || !lodge.annualDues}
            className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-navy hover:shadow-glow disabled:opacity-40">
            <RefreshCcw size={14} /> {rollMut.isPending ? 'Rolling…' : `Roll ${cycle.label} dues`}
          </button>
        </div>
      </header>

      {editing ? <FeeEditor lodge={lodge} onSaved={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['treasurer-dashboard'] }); }} /> : null}

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat icon={<UsersIcon size={16} />} label="Active members" value={String(totals.memberCount)} />
        <Stat icon={<Coins size={16} />} label="Subs charged" value={gbp(totals.subsCharged)} sub={`${cycle.label}`} />
        <Stat icon={<CheckCircle2 size={16} />} label="Subs collected" value={gbp(totals.subsCollected)} sub={`${totals.subsCollectedCount}/${totals.memberCount} paid · ${collectionRate}%`} accent="emerald" />
        <Stat icon={<Banknote size={16} />} label="Outstanding" value={gbp(totals.subsOutstanding)} accent={totals.subsOutstanding > 0 ? 'orange' : 'emerald'} />
      </section>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">Annual subscriptions</p>
            <h2 className="font-display text-2xl text-[var(--ink-strong)]">Dues — {cycle.label}</h2>
          </div>
          <p className="text-xs text-steel-grey">Click a row to mark paid</p>
        </div>
        <div className="space-y-1.5">
          {dues.map((d) => (
            <div key={d.memberId} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2">
              <div>
                <p className="text-sm text-[var(--ink-strong)]">{d.memberName}</p>
                <p className="text-[11px] text-steel-grey">
                  {d.paidDate
                    ? `Paid ${new Date(d.paidDate).toLocaleDateString('en-GB')} · ${gbp(d.paidAmount)}`
                    : d.recordId
                      ? `Outstanding · due ${new Date(d.dueDate).toLocaleDateString('en-GB')}`
                      : 'No record yet — roll dues to create'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--ink-strong)]">{gbp(d.amount)}</span>
                {d.paidDate ? (
                  <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-emerald-300">Paid</span>
                ) : d.recordId ? (
                  <button onClick={() => markDuesPaidMut.mutate(d.recordId!)}
                    disabled={markDuesPaidMut.isPending}
                    className="rounded-md border border-brass-gold/40 bg-deep-blue/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:border-brass-gold disabled:opacity-40">
                    Mark paid
                  </button>
                ) : (
                  <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-steel-grey">No record</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="eyebrow mb-1">One-off joining fees</p>
            <h2 className="font-display text-2xl text-[var(--ink-strong)]">Initiation payments</h2>
          </div>
          <div className="text-right">
            <p className="text-xs text-steel-grey">Outstanding</p>
            <p className="font-display text-xl text-[var(--ink-strong)]">{gbp(totals.joiningOutstanding)}</p>
          </div>
        </div>
        {joiningFees.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-6 text-center text-sm text-steel-grey">
            No joining fees raised yet. They appear here when a candidate is set up for initiation.
          </div>
        ) : (
          <div className="space-y-1.5">
            {joiningFees.map((j) => (
              <div key={j.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2">
                <div>
                  <p className="text-sm text-[var(--ink-strong)]">{j.memberName}</p>
                  <p className="text-[11px] text-steel-grey">
                    {j.paidDate
                      ? `Paid ${new Date(j.paidDate).toLocaleDateString('en-GB')} · ${gbp(j.paidAmount)}`
                      : j.dueDate
                        ? `Outstanding · due ${new Date(j.dueDate).toLocaleDateString('en-GB')}`
                        : 'Outstanding'}
                    {j.notes ? ` · ${j.notes}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-[var(--ink-strong)]">{gbp(j.amount)}</span>
                  {j.paidDate ? (
                    <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-emerald-300">Paid</span>
                  ) : (
                    <button onClick={() => markJoiningPaidMut.mutate(j.id)}
                      disabled={markJoiningPaidMut.isPending}
                      className="rounded-md border border-brass-gold/40 bg-deep-blue/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:border-brass-gold disabled:opacity-40">
                      Mark paid
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value, sub, accent = 'default' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
  accent?: 'default' | 'emerald' | 'orange';
}) {
  const ring = accent === 'emerald' ? 'border-emerald-400/30' : accent === 'orange' ? 'border-forge-orange/40' : 'border-[var(--border-subtle)]';
  return (
    <div className={`rounded-2xl border ${ring} bg-deep-blue/60 p-4`}>
      <div className="flex items-center gap-2 text-steel-grey">
        {icon}
        <p className="text-[11px] uppercase tracking-[0.18em]">{label}</p>
      </div>
      <p className="mt-2 font-display text-3xl text-[var(--ink-strong)]">{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-steel-grey">{sub}</p> : null}
    </div>
  );
}

function FeeEditor({ lodge, onSaved }: { lodge: DashboardData['lodge']; onSaved: () => void }) {
  const [annualDues, setAnnualDues] = useState(lodge.annualDues ?? 0);
  const [joiningFee, setJoiningFee] = useState(lodge.joiningFee ?? 0);
  const [bankSortCode, setSort] = useState(lodge.bankSortCode ?? '');
  const [bankAccount, setAcc] = useState(lodge.bankAccount ?? '');
  const [bankAccountName, setName] = useState(lodge.bankAccountName ?? '');
  const [yearStart, setYearStart] = useState(lodge.masonicYearStartMonth ?? 4);

  const saveMut = useMutation({
    mutationFn: async () => (await api.put('/treasurer/lodge', {
      annualDues: Number(annualDues), joiningFee: Number(joiningFee),
      bankSortCode, bankAccount, bankAccountName,
      masonicYearStartMonth: Number(yearStart),
    })).data,
    onSuccess: () => onSaved(),
  });

  return (
    <section className="rounded-[24px] border border-brass-gold/40 bg-[var(--surface-strong)] p-6">
      <p className="eyebrow mb-3">Lodge fee configuration</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Annual subscription (£)" type="number" value={annualDues} onChange={(v) => setAnnualDues(Number(v))} />
        <Field label="Joining fee (£)" type="number" value={joiningFee} onChange={(v) => setJoiningFee(Number(v))} />
        <Field label="Masonic year start month (1-12)" type="number" value={yearStart} onChange={(v) => setYearStart(Number(v))} />
        <Field label="Bank sort code" value={bankSortCode} onChange={setSort} placeholder="00-00-00" />
        <Field label="Bank account number" value={bankAccount} onChange={setAcc} placeholder="00000000" />
        <Field label="Account name" value={bankAccountName} onChange={setName} />
      </div>
      <div className="mt-4 flex justify-end">
        <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
          className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-5 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-navy hover:shadow-glow disabled:opacity-40">
          <Wallet size={14} />
          {saveMut.isPending ? 'Saving…' : 'Save configuration'}
        </button>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string | number; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.12em] text-steel-grey mb-1.5">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2 text-sm text-[var(--ink-strong)] focus:border-brass-gold/60 focus:outline-none"
      />
    </label>
  );
}
