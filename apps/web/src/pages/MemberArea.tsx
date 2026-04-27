import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  ChevronRight,
  Clock3,
  MapPin,
  Soup,
  Ticket,
  Users,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatCurrency, formatDate } from '@/lib/utils';
import Badge from '@/components/shared/Badge';

interface MeetingItem {
  id: string;
  type: string;
  date: string;
  startTime?: string;
  venue?: string;
  diningTime?: string;
  diningCost?: number;
  ceremonyType?: string;
}

interface AttendanceItem {
  meetingId: string;
  status: string;
  diningChoice?: string;
  guestCount?: number;
  guestNames?: string;
  apologyReason?: string;
  meeting: {
    id: string;
    type: string;
    date: string;
    startTime?: string;
    venue?: string;
  };
}

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function statusLabel(status?: string) {
  if (!status) return 'Awaiting reply';
  if (status === 'PRESENT') return 'Attending';
  if (status === 'APOLOGY') return 'Apologies sent';
  if (status === 'ABSENT') return 'Not attending';
  return status;
}

export default function MemberArea() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { diningChoice: string; guestCount: number }>>({});

  const { data: meetings = [], isLoading } = useQuery<MeetingItem[]>({
    queryKey: ['member-area', 'meetings'],
    queryFn: () => api.get('/meetings').then((r) => r.data?.data ?? r.data ?? []),
  });

  const { data: attendance = [] } = useQuery<AttendanceItem[]>({
    queryKey: ['member-area', 'attendance', user?.memberId],
    queryFn: () =>
      api.get(`/attendance/member/${user?.memberId}`).then((r) => r.data?.data ?? []),
    enabled: !!user?.memberId,
  });

  const rsvpMutation = useMutation({
    mutationFn: (data: {
      meetingId: string;
      status: string;
      diningChoice?: string;
      guestCount?: number;
    }) => api.post('/attendance/self', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['member-area', 'attendance', user?.memberId] });
    },
  });

  const upcomingMeetings = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    return meetings
      .filter((meeting) => new Date(meeting.date) >= startOfToday)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8);
  }, [meetings]);

  const attendanceByMeetingId = useMemo(
    () => Object.fromEntries(attendance.map((item) => [item.meetingId, item])),
    [attendance],
  );

  const respondedCount = attendance.filter((item) => ['PRESENT', 'APOLOGY', 'ABSENT'].includes(item.status)).length;
  const diningCount = attendance.filter((item) => item.diningChoice === 'Dining').length;

  function getDraft(meetingId: string, current?: AttendanceItem) {
    return drafts[meetingId] ?? {
      diningChoice: current?.diningChoice || '',
      guestCount: current?.guestCount || 0,
    };
  }

  if (!user?.memberId) {
    return (
      <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 text-sm text-[var(--ink-muted)] shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        This account is not linked to a member record yet, so the members area is unavailable.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Members Area</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink-strong)]">
            Keep track of lodge dates and send your dining RSVP without leaving the diary.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
            This area is designed for brethren: see the upcoming calendar, confirm whether you are
            attending, and let the lodge know if you are dining and bringing guests.
          </p>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Your pulse</p>
          <div className="mt-6 grid gap-3">
            <MemberPulse label="Upcoming events" value={String(upcomingMeetings.length)} />
            <MemberPulse label="RSVPs sent" value={String(respondedCount)} />
            <MemberPulse label="Dining replies" value={String(diningCount)} />
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-[var(--ink-muted)]">Loading your calendar...</div>
      ) : (
        <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Lodge Diary</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Upcoming meetings and events</h2>
          </div>

          <div className="mt-6 grid gap-4">
            {upcomingMeetings.map((meeting) => {
              const current = attendanceByMeetingId[meeting.id];
              const draft = getDraft(meeting.id, current);

              return (
                <article
                  key={meeting.id}
                  className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-display text-2xl text-[var(--ink-strong)]">
                          {meeting.ceremonyType || meetingTypeLabel(meeting.type)}
                        </h3>
                        <Badge variant={current ? 'info' : 'warning'}>{statusLabel(current?.status)}</Badge>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[var(--gold-deep)]" />
                          {formatDate(meeting.date)}
                        </span>
                        {meeting.startTime ? (
                          <span className="inline-flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-[var(--gold-deep)]" />
                            {meeting.startTime}
                          </span>
                        ) : null}
                        {meeting.venue ? (
                          <span className="inline-flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[var(--gold-deep)]" />
                            {meeting.venue}
                          </span>
                        ) : null}
                        {meeting.diningCost != null ? (
                          <span className="inline-flex items-center gap-2">
                            <Soup className="h-4 w-4 text-[var(--gold-deep)]" />
                            Dining {formatCurrency(meeting.diningCost)}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() =>
                            rsvpMutation.mutate({
                              meetingId: meeting.id,
                              status: 'PRESENT',
                              diningChoice: draft.diningChoice,
                              guestCount: draft.guestCount,
                            })
                          }
                          className="rounded-2xl border border-[rgba(214,180,93,0.18)] bg-[linear-gradient(135deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
                        >
                          I’m attending
                        </button>
                        <button
                          onClick={() =>
                            rsvpMutation.mutate({
                              meetingId: meeting.id,
                              status: 'APOLOGY',
                              diningChoice: '',
                              guestCount: 0,
                            })
                          }
                          className="rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-soft)]"
                        >
                          Send apologies
                        </button>
                        <Link
                          to={`/meetings/${meeting.id}`}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--ink-muted)] no-underline transition hover:text-[var(--ink-strong)]"
                        >
                          Open meeting
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <div className="grid gap-3 rounded-[24px] border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] p-4 xl:min-w-[320px]">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Dining RSVP
                        </p>
                        <select
                          value={draft.diningChoice}
                          onChange={(e) =>
                            setDrafts((state) => ({
                              ...state,
                              [meeting.id]: {
                                ...getDraft(meeting.id, current),
                                diningChoice: e.target.value,
                              },
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                        >
                          <option value="">No dining reply yet</option>
                          <option value="Dining">Dining</option>
                          <option value="Not dining">Not dining</option>
                        </select>
                      </div>

                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Guests dining
                        </p>
                        <input
                          type="number"
                          min="0"
                          value={draft.guestCount}
                          onChange={(e) =>
                            setDrafts((state) => ({
                              ...state,
                              [meeting.id]: {
                                ...getDraft(meeting.id, current),
                                guestCount: Number(e.target.value) || 0,
                              },
                            }))
                          }
                          className="mt-2 w-full rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                        />
                      </div>

                      <button
                        onClick={() =>
                          rsvpMutation.mutate({
                            meetingId: meeting.id,
                            status: current?.status || 'PRESENT',
                            diningChoice: draft.diningChoice,
                            guestCount: draft.guestCount,
                          })
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[rgba(214,180,93,0.18)] bg-[rgba(17,29,46,0.97)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110"
                      >
                        <Ticket className="h-4 w-4" />
                        Save RSVP
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}

            {upcomingMeetings.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-6 text-sm text-[var(--ink-muted)]">
                No upcoming lodge events are currently scheduled.
              </div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}

function MemberPulse({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 font-display text-3xl text-white">{value}</p>
    </div>
  );
}
