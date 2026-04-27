import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, CheckCircle2, Coins, Edit3, FileSignature, Mail, RefreshCcw, Wallet, Users as UsersIcon } from 'lucide-react';
import api from '@/lib/api';

interface DueInstalment {
  id: string;
  monthIndex: number;
  dueDate: string;
  expectedAmount: number;
  paidDate: string | null;
  paidAmount: number | null;
}

interface DueRow {
  memberId: string;
  memberName: string;
  recordId: string | null;
  amount: number | null;
  status: string;
  dueDate: string;
  paidDate: string | null;
  paidAmount: number | null;
  subscriptionMode: 'LUMP_SUM' | 'STANDING_ORDER';
  instalments: DueInstalment[];
  instalmentsPaidCount: number;
  instalmentsTotal: number;
  collected: number;
  isFullyPaid: boolean;
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

  const markInstalmentMut = useMutation({
    mutationFn: async ({ recordId, instalmentId }: { recordId: string; instalmentId: string }) =>
      (await api.post(`/treasurer/dues/${recordId}/instalments/${instalmentId}/mark-paid`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['treasurer-dashboard'] }),
  });

  const setModeMut = useMutation({
    mutationFn: async ({ memberId, mode }: { memberId: string; mode: 'LUMP_SUM' | 'STANDING_ORDER' }) =>
      (await api.put(`/treasurer/members/${memberId}/subscription-mode`, { mode })).data,
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
      <header className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-8">
        <p className="eyebrow mb-1">Treasurer · Masonic Year {cycle.label}</p>
        <h1 className="font-display text-2xl sm:text-4xl text-[var(--ink-strong)]">{lodge.name} No. {lodge.number}</h1>
        <p className="mt-2 text-sm text-steel-grey">
          Annual subscription <strong className="text-[var(--ink-strong)]">{gbp(lodge.annualDues)}</strong> · Joining fee <strong className="text-[var(--ink-strong)]">{gbp(lodge.joiningFee)}</strong>
          {lodge.bankSortCode && lodge.bankAccount ? <> · Bank {lodge.bankSortCode} / {lodge.bankAccount}</> : null}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
            <DuesRow
              key={d.memberId}
              row={d}
              onSetMode={(mode) => setModeMut.mutate({ memberId: d.memberId, mode })}
              onMarkLumpPaid={() => d.recordId && markDuesPaidMut.mutate(d.recordId)}
              onMarkInstalment={(instalmentId) => d.recordId && markInstalmentMut.mutate({ recordId: d.recordId, instalmentId })}
              isBusy={markDuesPaidMut.isPending || markInstalmentMut.isPending || setModeMut.isPending}
            />
          ))}
        </div>
      </section>

      <PaymentPlansSection />

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
              <div key={j.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2">
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

interface PaymentPlanRow {
  id: string;
  status: 'PROPOSED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  joiningFeeAmount: number;
  year1SubsAmount: number;
  totalAmount: number;
  cadence: string;
  candidateCircumstances: string | null;
  proposedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  candidate: { id: string; firstName: string; lastName: string; email: string | null; initiationDate: string | null };
  instalments: Array<{ id: string; sequence: number; label: string; dueDate: string; amount: number; isJoiningFee: boolean; paidDate: string | null; paidAmount: number | null }>;
  proposedBy: { email: string } | null;
  approvedBy: { email: string } | null;
}

function PaymentPlansSection() {
  const qc = useQueryClient();
  const { data: plans = [] } = useQuery<PaymentPlanRow[]>({
    queryKey: ['payment-plans'],
    queryFn: async () => (await api.get('/payment-plans')).data,
  });

  const approveAndSendMut = useMutation({
    mutationFn: async (planId: string) => {
      await api.post(`/payment-plans/${planId}/approve`);
      await api.post(`/payment-plans/${planId}/send-email`);
      return planId;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-plans'] }),
  });

  const cancelMut = useMutation({
    mutationFn: async (planId: string) => (await api.post(`/payment-plans/${planId}/cancel`, { reason: 'Cancelled by Treasurer' })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-plans'] }),
  });

  const resendMut = useMutation({
    mutationFn: async (planId: string) => (await api.post(`/payment-plans/${planId}/send-email`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['payment-plans'] }),
  });

  if (plans.length === 0) return null;

  const proposed = plans.filter((p) => p.status === 'PROPOSED');
  const live = plans.filter((p) => p.status === 'APPROVED' || p.status === 'ACTIVE');

  return (
    <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 space-y-6">
      <div>
        <p className="eyebrow mb-1">Initiate payment plans</p>
        <h2 className="font-display text-2xl text-[var(--ink-strong)]">Year-1 plans</h2>
        <p className="mt-1 text-sm text-steel-grey">Incus drafts these from candidate circumstances. Review the schedule, then Approve &amp; Send to email it.</p>
      </div>

      {proposed.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brass-gold">Awaiting your approval ({proposed.length})</p>
          {proposed.map((p) => (
            <PaymentPlanCard
              key={p.id}
              plan={p}
              actions={
                <>
                  <button
                    onClick={() => { if (confirm(`Approve and email this plan to ${p.candidate.firstName}?`)) approveAndSendMut.mutate(p.id); }}
                    disabled={approveAndSendMut.isPending || !p.candidate.email}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-navy hover:shadow-glow disabled:opacity-40">
                    <Mail size={12} /> Approve &amp; send
                  </button>
                  <button onClick={() => { if (confirm('Cancel this proposed plan?')) cancelMut.mutate(p.id); }}
                    disabled={cancelMut.isPending}
                    className="rounded-sm border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-steel-grey hover:border-forge-orange/40 hover:text-forge-orange">
                    Cancel
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}

      {live.length > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400">Active plans ({live.length})</p>
          {live.map((p) => (
            <PaymentPlanCard
              key={p.id}
              plan={p}
              actions={
                <>
                  <button onClick={() => { if (confirm(`Resend the plan email to ${p.candidate.firstName}?`)) resendMut.mutate(p.id); }}
                    disabled={resendMut.isPending || !p.candidate.email}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-brass-gold/40 bg-deep-blue/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:border-brass-gold disabled:opacity-40">
                    <Mail size={12} /> Resend email
                  </button>
                  <button onClick={() => { if (confirm(`Cancel ${p.candidate.firstName}'s plan? This cannot be undone.`)) cancelMut.mutate(p.id); }}
                    disabled={cancelMut.isPending}
                    className="rounded-sm border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-steel-grey hover:border-forge-orange/40 hover:text-forge-orange">
                    Cancel
                  </button>
                </>
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentPlanCard({ plan, actions }: { plan: PaymentPlanRow; actions?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg text-[var(--ink-strong)]">{plan.candidate.firstName} {plan.candidate.lastName}</p>
          <p className="text-[11px] text-steel-grey">
            Initiation {plan.candidate.initiationDate ? new Date(plan.candidate.initiationDate).toLocaleDateString('en-GB') : 'not set'} · {plan.candidate.email ?? 'no email'}
          </p>
          <p className="mt-1 text-xs text-steel-grey">
            Joining fee {gbp(plan.joiningFeeAmount)} + Year-1 subs {gbp(plan.year1SubsAmount)} = <strong className="text-[var(--ink-strong)]">{gbp(plan.totalAmount)}</strong>, {plan.cadence.toLowerCase()}
          </p>
          {plan.candidateCircumstances && (
            <p className="mt-2 text-[11px] italic text-steel-grey">"{plan.candidateCircumstances}"</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      </div>

      <div className="mt-3 grid gap-1">
        {plan.instalments.map((i) => (
          <div key={i.id} className={`flex items-center justify-between text-[11px] px-2 py-1.5 rounded-md ${i.isJoiningFee ? 'bg-brass-gold/10 border border-brass-gold/30' : 'bg-white/[0.02]'}`}>
            <span className="text-[var(--ink-strong)]">
              {i.sequence}. <strong>{i.label}</strong> · {new Date(i.dueDate).toLocaleDateString('en-GB')}
            </span>
            <span className={`${i.paidDate ? 'text-emerald-300' : 'text-steel-grey'}`}>
              {gbp(i.amount)} {i.paidDate ? '· paid' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DuesRow({ row, onSetMode, onMarkLumpPaid, onMarkInstalment, isBusy }: {
  row: DueRow;
  onSetMode: (mode: 'LUMP_SUM' | 'STANDING_ORDER') => void;
  onMarkLumpPaid: () => void;
  onMarkInstalment: (instalmentId: string) => void;
  isBusy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isStandingOrder = row.subscriptionMode === 'STANDING_ORDER';

  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-deep-blue/40">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm text-[var(--ink-strong)]">{row.memberName}</p>
            <ModeBadge mode={row.subscriptionMode} onChange={onSetMode} disabled={isBusy} />
          </div>
          <p className="text-[11px] text-steel-grey">
            {!row.recordId
              ? 'No record yet — roll dues to create'
              : isStandingOrder
                ? row.instalmentsTotal > 0
                  ? `${row.instalmentsPaidCount}/${row.instalmentsTotal} months received · ${gbp(row.collected)} of ${gbp(row.amount)}`
                  : 'Switch on standing order to generate the 12 monthly instalments'
                : row.paidDate
                  ? `Paid ${new Date(row.paidDate).toLocaleDateString('en-GB')} · ${gbp(row.paidAmount)}`
                  : `Outstanding · due ${new Date(row.dueDate).toLocaleDateString('en-GB')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--ink-strong)]">{gbp(row.amount)}</span>
          {!row.recordId ? (
            <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-steel-grey">No record</span>
          ) : isStandingOrder ? (
            <button onClick={() => setExpanded((v) => !v)}
              className="rounded-md border border-brass-gold/40 bg-deep-blue/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:border-brass-gold">
              {expanded ? 'Hide months' : 'Show months'}
            </button>
          ) : row.paidDate ? (
            <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.06em] text-emerald-300">Paid</span>
          ) : (
            <button onClick={onMarkLumpPaid} disabled={isBusy}
              className="rounded-md border border-brass-gold/40 bg-deep-blue/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:border-brass-gold disabled:opacity-40">
              Mark paid
            </button>
          )}
        </div>
      </div>

      {expanded && isStandingOrder && row.instalments.length > 0 && (
        <div className="grid grid-cols-2 gap-1 border-t border-[var(--border-subtle)] bg-white/[0.02] px-3 py-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {row.instalments.map((i) => (
            <div key={i.id} className={`flex items-center justify-between rounded-md border px-2 py-1.5 ${
              i.paidDate ? 'border-emerald-400/30 bg-emerald-500/10' : 'border-[var(--border-subtle)] bg-deep-blue/40'
            }`}>
              <span className="text-[10px] text-steel-grey">{new Date(i.dueDate).toLocaleDateString('en-GB', { month: 'short' })}</span>
              {i.paidDate ? (
                <span className="text-[10px] text-emerald-300">{gbp(i.paidAmount)}</span>
              ) : (
                <button onClick={() => onMarkInstalment(i.id)} disabled={isBusy}
                  className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:underline disabled:opacity-40">
                  {gbp(i.expectedAmount)}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeBadge({ mode, onChange, disabled }: {
  mode: 'LUMP_SUM' | 'STANDING_ORDER';
  onChange: (mode: 'LUMP_SUM' | 'STANDING_ORDER') => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={mode}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as any)}
      className="rounded-md border border-[var(--border-subtle)] bg-deep-blue/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-steel-grey hover:border-brass-gold/40 focus:border-brass-gold/60 focus:outline-none disabled:opacity-40"
    >
      <option value="LUMP_SUM">Lump sum</option>
      <option value="STANDING_ORDER">Standing order · £17 × 12</option>
    </select>
  );
}
