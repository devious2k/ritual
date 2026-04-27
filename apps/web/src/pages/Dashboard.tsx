import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  Crown,
  Drumstick,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/lib/utils';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  upcomingMeetings: number;
  outstandingDues: { total: number; count: number };
  attendanceRate?: number;
}

interface UpcomingMeeting {
  id: string;
  type: string;
  date: string;
  startTime?: string;
  venue?: string;
  ceremonyType?: string;
}

interface ActionItem {
  id: string;
  type: 'candidate' | 'minutes' | 'dues' | 'attendance';
  title: string;
  description: string;
  link: string;
}

interface DiningRecord {
  id: string;
  amount: number;
  guestAmount?: number;
  guestCount: number;
  status: string;
  meeting?: { id: string; date: string; type: string };
  attendance?: { diningChoice?: string };
}

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => api.get('/dashboard/stats').then((r) => r.data),
  });

  const { data: upcoming = [] } = useQuery<UpcomingMeeting[]>({
    queryKey: ['dashboard', 'upcoming'],
    queryFn: () => api.get('/dashboard/upcoming').then((r) => r.data?.meetings ?? r.data ?? []),
  });

  const { data: actions = [] } = useQuery<ActionItem[]>({
    queryKey: ['dashboard', 'action-items'],
    queryFn: () =>
      api.get('/dashboard/action-items').then((r) => {
        const items = r.data?.actionItems ?? r.data;
        if (items && typeof items === 'object' && !Array.isArray(items)) {
          const result: ActionItem[] = [];
          if (items.outstandingDues > 0) {
            result.push({
              id: 'dues',
              type: 'dues',
              title: 'Outstanding dining or lodge balances',
              description: `${items.outstandingDues} member${items.outstandingDues !== 1 ? 's' : ''} still need payment follow-up`,
              link: '/dining',
            });
          }
          if (items.unapprovedMinutes > 0) {
            result.push({
              id: 'minutes',
              type: 'minutes',
              title: 'Meeting records need approval',
              description: `${items.unapprovedMinutes} meeting${items.unapprovedMinutes !== 1 ? 's' : ''} still waiting for minutes approval`,
              link: '/meetings',
            });
          }
          if (items.unconfirmedCeremonies > 0) {
            result.push({
              id: 'ceremonies',
              type: 'attendance',
              title: 'Ceremony plans need confirmation',
              description: `${items.unconfirmedCeremonies} ceremony plan${items.unconfirmedCeremonies !== 1 ? 's' : ''} still need roles or confirmation`,
              link: '/ceremonies',
            });
          }
          if (items.unsentSummonses > 0) {
            result.push({
              id: 'summonses',
              type: 'minutes',
              title: 'Summons still unsent',
              description: `${items.unsentSummonses} summons${items.unsentSummonses !== 1 ? 'es' : ''} have not gone out yet`,
              link: '/meetings',
            });
          }
          if (items.pendingCandidates > 0 || items.pendingBallots > 0) {
            result.push({
              id: 'candidates',
              type: 'candidate',
              title: 'Candidate work still pending',
              description: `${(items.pendingCandidates || 0) + (items.pendingBallots || 0)} candidate-related item${(items.pendingCandidates || 0) + (items.pendingBallots || 0) !== 1 ? 's' : ''} need attention`,
              link: '/ceremonies',
            });
          }
          return result;
        }

        return Array.isArray(items) ? items : [];
      }),
  });

  const { data: diningRecords = [] } = useQuery<DiningRecord[]>({
    queryKey: ['dining', 'overview'],
    queryFn: () => api.get('/dining').then((r) => r.data?.data ?? r.data ?? []),
  });

  const nextMeeting = upcoming[0];
  const nextMeetingDining = nextMeeting
    ? diningRecords.filter((record) => record.meeting?.id === nextMeeting.id)
    : [];
  const totalGuests = nextMeetingDining.reduce((sum, record) => sum + (record.guestCount || 0), 0);
  const diningChoices = nextMeetingDining.filter((record) => record.attendance?.diningChoice).length;
  const diningOutstanding = nextMeetingDining
    .filter((record) => record.status !== 'SUCCEEDED')
    .reduce((sum, record) => sum + record.amount + (record.guestAmount || 0) * record.guestCount, 0);
  const readinessSignal = stats?.attendanceRate != null ? `${Math.round(stats.attendanceRate)}%` : 'Pending';

  const spotlightStats = [
    {
      label: 'Active Brethren',
      value: stats?.activeMembers ?? stats?.totalMembers ?? '-',
      icon: Users,
    },
    {
      label: 'Upcoming Meetings',
      value: stats?.upcomingMeetings ?? '-',
      icon: CalendarDays,
    },
    {
      label: 'Dining Replies',
      value: nextMeetingDining.length,
      icon: UtensilsCrossed,
    },
    {
      label: 'Open Actions',
      value: actions.length,
      icon: Clock3,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.9fr)]">
        <div className="overflow-hidden rounded-[32px] border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(10,20,34,0.97),rgba(18,32,52,0.95)_45%,rgba(39,29,14,0.88)_100%)] p-8 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]">
          <p className="mb-3 text-[11px] uppercase tracking-[0.32em] text-[var(--gold-soft)]">
            One Lodge. One Night. Everything Ready.
          </p>
          <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
            Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/72">
            The product is now centred on the evening itself: meetings, ceremony readiness,
            dining numbers, and the members who make the night run well.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {spotlightStats.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-white/6 p-4 backdrop-blur"
              >
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-white/66">{item.label}</p>
                  <item.icon className="h-5 w-5 text-[var(--gold-soft)]" />
                </div>
                <p className="font-display text-3xl text-white">
                  {statsLoading ? (
                    <span className="inline-block h-8 w-16 animate-pulse rounded bg-white/10" />
                  ) : (
                    item.value
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Next Meeting</p>
          {nextMeeting ? (
            <>
              <h2 className="mt-3 font-display text-3xl text-[var(--ink-strong)]">
                {meetingTypeLabel(nextMeeting.type)}
              </h2>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                {formatDate(nextMeeting.date)}
                {nextMeeting.startTime ? ` at ${nextMeeting.startTime}` : ''}
                {nextMeeting.venue ? `, ${nextMeeting.venue}` : ''}
              </p>

              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 p-4">
                  <div className="flex items-center gap-3">
                    <Crown className="h-5 w-5 text-[var(--gold-deep)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--ink-strong)]">Ceremony</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {nextMeeting.ceremonyType || 'No ceremony chosen yet'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 p-4">
                  <div className="flex items-center gap-3">
                    <Drumstick className="h-5 w-5 text-[var(--gold-deep)]" />
                    <div>
                      <p className="text-sm font-medium text-[var(--ink-strong)]">Festive board</p>
                      <p className="text-sm text-[var(--ink-muted)]">
                        {nextMeetingDining.length} replies, {totalGuests} guest{totalGuests === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Link
                to="/meetings"
                className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-strong)] px-4 py-3 text-sm font-medium text-[var(--gold-deep)] transition hover:translate-y-[-1px] hover:bg-white"
              >
                Open meeting plan
                <ChevronRight className="h-4 w-4" />
              </Link>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-6 text-sm text-[var(--ink-muted)]">
              No upcoming meeting found yet. Once one exists, this panel becomes the control
              point for ceremony planning and dining readiness.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Night Readiness</p>
              <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">What needs attention</h2>
            </div>
            <Link to="/ceremonies" className="text-sm text-[var(--gold-deep)] hover:underline">
              Open ceremonies
            </Link>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5">
              <p className="text-sm text-[var(--ink-muted)]">Ceremony readiness</p>
              <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{readinessSignal}</p>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Temporary signal using current attendance-rate data until ceremony-specific readiness lands.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5">
              <p className="text-sm text-[var(--ink-muted)]">Dining choices logged</p>
              <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{diningChoices}</p>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Members who have submitted a meal choice for the next meeting.
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5">
              <p className="text-sm text-[var(--ink-muted)]">Outstanding dining</p>
              <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">
                {formatCurrency(diningOutstanding)}
              </p>
              <p className="mt-2 text-sm text-[var(--ink-muted)]">
                Unpaid dining balances currently attached to the next meeting.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Action List</p>
              <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Before the next meeting</h2>
            </div>
            <Link to="/dining" className="text-sm text-[var(--gold-deep)] hover:underline">
              View dining
            </Link>
          </div>

          {actions.length > 0 ? (
            <ul className="mt-6 space-y-3">
              {actions.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.link}
                    className="group flex items-start gap-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4 transition hover:translate-y-[-1px] hover:bg-white"
                  >
                    <div className="mt-0.5 rounded-2xl bg-[rgba(201,168,76,0.12)] p-2 text-[var(--gold-deep)]">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[var(--ink-strong)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--ink-muted)]">{item.description}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 text-[var(--ink-faint)] group-hover:text-[var(--ink-strong)]" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-6 text-sm text-[var(--ink-muted)]">
              No immediate action items. The next pass can add ceremony-specific role gaps and dining deadlines here.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Upcoming Meetings</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Calendar at a glance</h2>
          </div>
          <Link to="/meetings" className="text-sm text-[var(--gold-deep)] hover:underline">
            View all meetings
          </Link>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {upcoming.length > 0 ? (
            upcoming.slice(0, 3).map((meeting) => (
              <article
                key={meeting.id}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5"
              >
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">
                  {meetingTypeLabel(meeting.type)}
                </p>
                <h3 className="mt-3 font-display text-2xl text-[var(--ink-strong)]">
                  {formatDate(meeting.date)}
                </h3>
                <p className="mt-2 text-sm text-[var(--ink-muted)]">
                  {meeting.ceremonyType || 'Ceremony not set yet'}
                </p>
                {meeting.venue ? (
                  <p className="mt-1 text-sm text-[var(--ink-muted)]">{meeting.venue}</p>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-6 text-sm text-[var(--ink-muted)]">
              No upcoming meetings yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
