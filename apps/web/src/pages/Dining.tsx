import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Drumstick, Receipt, Users, UtensilsCrossed } from 'lucide-react';
import api from '@/lib/api';
import { formatDate, formatCurrency } from '@/lib/utils';
import StatusPill from '@/components/shared/StatusPill';
import EmptyState from '@/components/shared/EmptyState';

interface MeetingOption {
  id: string;
  type: string;
  date: string;
}

interface DiningRecord {
  id: string;
  amount: number;
  guestAmount?: number;
  guestCount: number;
  status: string;
  paidDate?: string;
  paymentMethod?: string;
  member: { id: string; firstName: string; lastName: string };
  meeting: { id: string; date: string; type: string };
  attendance?: { diningChoice?: string };
}

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function Dining() {
  const [selectedMeetingId, setSelectedMeetingId] = useState('');

  const { data: meetings = [] } = useQuery<MeetingOption[]>({
    queryKey: ['meetings', 'all'],
    queryFn: () => api.get('/meetings').then((r) => r.data?.data ?? r.data ?? []),
  });

  const { data: diningRecords = [], isLoading } = useQuery<DiningRecord[]>({
    queryKey: ['dining', selectedMeetingId],
    queryFn: () =>
      api
        .get('/dining', { params: { meetingId: selectedMeetingId || undefined } })
        .then((r) => r.data?.data ?? r.data ?? []),
  });

  const selectedMeeting = meetings.find((meeting) => meeting.id === selectedMeetingId) || meetings[0];

  const summary = useMemo(() => {
    const totalOwed = diningRecords.reduce((sum, record) => {
      const lineTotal = record.amount + (record.guestAmount || 0) * record.guestCount;
      return sum + lineTotal;
    }, 0);
    const totalPaid = diningRecords
      .filter((record) => record.status === 'SUCCEEDED')
      .reduce((sum, record) => sum + record.amount + (record.guestAmount || 0) * record.guestCount, 0);
    const guests = diningRecords.reduce((sum, record) => sum + record.guestCount, 0);
    const choices = diningRecords.filter((record) => record.attendance?.diningChoice).length;

    return {
      totalOwed,
      totalPaid,
      outstanding: totalOwed - totalPaid,
      guests,
      choices,
    };
  }, [diningRecords]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Dining</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink-strong)]">
            Treat the festive board like part of the night, not an afterthought.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
            Track meal choices, guest covers, and payment status so the dining side of the
            meeting feels as prepared as the ceremony itself.
          </p>

          <div className="mt-8">
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">
              Meeting in view
            </label>
            <select
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
              className="max-w-md rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              <option value="">All meetings</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meetingTypeLabel(meeting.type)} - {formatDate(meeting.date)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Festive board pulse</p>
          {selectedMeeting ? (
            <>
              <h2 className="mt-3 font-display text-3xl text-white">
                {meetingTypeLabel(selectedMeeting.type)}
              </h2>
              <p className="mt-2 text-sm text-white/72">{formatDate(selectedMeeting.date)}</p>
            </>
          ) : (
            <h2 className="mt-3 font-display text-3xl text-white">All meetings</h2>
          )}

          <div className="mt-6 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Dining replies</p>
              <p className="mt-1 font-display text-3xl text-white">{diningRecords.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Guest covers</p>
              <p className="mt-1 font-display text-3xl text-white">{summary.guests}</p>
            </div>
          </div>
        </div>
      </section>

      {diningRecords.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--ink-muted)]">Total owed</p>
              <Receipt className="h-4 w-4 text-[var(--gold-deep)]" />
            </div>
            <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">
              {formatCurrency(summary.totalOwed)}
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--ink-muted)]">Paid</p>
              <UtensilsCrossed className="h-4 w-4 text-[var(--gold-deep)]" />
            </div>
            <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">
              {formatCurrency(summary.totalPaid)}
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--ink-muted)]">Outstanding</p>
              <Drumstick className="h-4 w-4 text-[var(--gold-deep)]" />
            </div>
            <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">
              {formatCurrency(summary.outstanding)}
            </p>
          </div>
          <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--ink-muted)]">Meal choices</p>
              <Users className="h-4 w-4 text-[var(--gold-deep)]" />
            </div>
            <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{summary.choices}</p>
          </div>
        </section>
      ) : null}

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Dining Register</p>
          <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Responses, covers, and payments</h2>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-[var(--ink-muted)]">Loading dining records...</div>
        ) : diningRecords.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<UtensilsCrossed size={28} />}
              title="No dining records"
              description="Dining fees will appear here once members RSVP for meetings."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {diningRecords.map((record) => {
              const total = record.amount + (record.guestAmount || 0) * record.guestCount;
              return (
                <article
                  key={record.id}
                  className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-display text-2xl text-[var(--ink-strong)]">
                          {record.member.firstName} {record.member.lastName}
                        </h3>
                        <StatusPill status={record.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
                        <span>{meetingTypeLabel(record.meeting.type)} on {formatDate(record.meeting.date)}</span>
                        <span>{record.attendance?.diningChoice || 'No meal choice recorded'}</span>
                        <span>{record.guestCount} guest{record.guestCount === 1 ? '' : 's'}</span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Amount</p>
                        <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                          {formatCurrency(total)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Method</p>
                        <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                          {record.paymentMethod || 'Not recorded'}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Paid date</p>
                        <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                          {record.paidDate ? formatDate(record.paidDate) : 'Awaiting payment'}
                        </p>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
