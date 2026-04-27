import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Gavel,
  GripVertical,
  Mail,
  MapPin,
  Plus,
  ScrollText,
  Trash2,
  UserPlus,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate, formatCurrency, initials } from '@/lib/utils';
import Badge from '@/components/shared/Badge';
import StatusPill from '@/components/shared/StatusPill';

interface AttendanceRecord {
  id: string;
  status: string;
  diningChoice?: string;
  guestCount: number;
  member: { id: string; firstName: string; lastName: string };
}

interface Visitor {
  id: string;
  firstName: string;
  lastName: string;
  rank?: string;
  lodgeName: string;
  lodgeNumber?: string;
  dining: boolean;
}

interface AgendaItem {
  title: string;
  description?: string;
}

interface CeremonyPlan {
  id: string;
  ceremonyType: string;
  isConfirmed: boolean;
  roles: Array<{ role: string; memberId: string; memberName?: string; confirmed: boolean }>;
}

interface MeetingDetailData {
  id: string;
  type: string;
  date: string;
  startTime?: string;
  venue?: string;
  diningTime?: string;
  diningCost?: number;
  diningMenu?: string[];
  agendaItems?: AgendaItem[];
  minutesContent?: string;
  minutesApproved: boolean;
  minutesApprovedDate?: string;
  ceremonyType?: string;
  candidateName?: string;
  attendance: AttendanceRecord[];
  visitors?: Visitor[];
  ceremonyPlan?: CeremonyPlan;
}

const detailTabs = [
  { key: 'agenda', label: 'Agenda', icon: ClipboardList },
  { key: 'attendance', label: 'Attendance', icon: Users },
  { key: 'minutes', label: 'Minutes', icon: FileText },
  { key: 'dining', label: 'Dining', icon: UtensilsCrossed },
  { key: 'visitors', label: 'Visitors', icon: UserPlus },
  { key: 'ceremony', label: 'Ceremony', icon: Gavel },
] as const;

type DetailTabKey = (typeof detailTabs)[number]['key'];

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isWM = user?.role === 'WORSHIPFUL_MASTER' || user?.role === 'PROVINCE_ADMIN';
  const canUpdateAttendance = ['SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'].includes(
    user?.role ?? '',
  );

  const [activeTab, setActiveTab] = useState<DetailTabKey>('agenda');

  const { data: meeting, isLoading } = useQuery<MeetingDetailData>({
    queryKey: ['meeting', id],
    queryFn: () => api.get(`/meetings/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const approveMinutesMutation = useMutation({
    mutationFn: () => api.patch(`/meetings/${id}/approve-minutes`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting', id] }),
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: ({ attendanceId, status }: { attendanceId: string; status: string }) =>
      api.patch(`/attendance/${attendanceId}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meeting', id] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-[var(--ink-muted)]">
        Loading meeting...
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--ink-muted)]">
        <p className="text-sm">Meeting not found.</p>
        <button
          onClick={() => navigate('/meetings')}
          className="mt-3 text-sm text-[var(--gold-deep)] hover:underline"
        >
          Back to meetings
        </button>
      </div>
    );
  }

  const presentCount = meeting.attendance.filter((entry) => entry.status === 'PRESENT').length;
  const apologyCount = meeting.attendance.filter((entry) => entry.status === 'APOLOGY').length;
  const absentCount = meeting.attendance.filter((entry) => entry.status === 'ABSENT').length;
  const guestCount = meeting.attendance.reduce((sum, entry) => sum + (entry.guestCount || 0), 0);
  const diningResponses = meeting.attendance.filter((entry) => entry.diningChoice).length;
  const confirmedRoles = meeting.ceremonyPlan?.roles.filter((role) => role.confirmed).length ?? 0;

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate('/meetings')}
        className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink-strong)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to meetings
      </button>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="info">{meetingTypeLabel(meeting.type)}</Badge>
            {meeting.ceremonyType ? <Badge variant="default">{meeting.ceremonyType}</Badge> : null}
            {meeting.minutesApproved ? (
              <Badge variant="success">Minutes approved</Badge>
            ) : (
              <Badge variant="warning">Minutes pending</Badge>
            )}
          </div>

          <h1 className="mt-4 font-display text-4xl text-[var(--ink-strong)]">
            {meetingTypeLabel(meeting.type)}
          </h1>

          <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
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
                <UtensilsCrossed className="h-4 w-4 text-[var(--gold-deep)]" />
                Dining {formatCurrency(meeting.diningCost)}
              </span>
            ) : null}
          </div>

          {meeting.candidateName ? (
            <div className="mt-6 rounded-2xl border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Candidate</p>
              <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">{meeting.candidateName}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Night pulse</p>
          <div className="mt-6 grid gap-3">
            <PulseCard label="Present" value={presentCount} />
            <PulseCard label="Apologies" value={apologyCount} />
            <PulseCard label="Guests" value={guestCount} />
            <PulseCard label="Dining choices" value={diningResponses} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <MetricCard label="Present" value={presentCount} />
        <MetricCard label="Apologies" value={apologyCount} />
        <MetricCard label="Absent" value={absentCount} />
        <MetricCard label="Confirmed roles" value={confirmedRoles} />
      </section>

      <SummonsAndRsvpSection meetingId={id!} />


      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div className="border-b border-[var(--border-subtle)] px-3 pt-3">
          <nav className="flex gap-1 overflow-x-auto">
            {detailTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border border-b-0 border-[var(--border-subtle)] bg-[var(--surface-strong)] text-[var(--ink-strong)]'
                    : 'text-[var(--ink-muted)] hover:bg-white/[0.04] hover:text-[var(--ink-strong)]'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'agenda' ? (
            <AgendaEditor meetingId={id!} initial={meeting.agendaItems ?? []} />
          ) : null}

          {activeTab === 'attendance' ? (
            meeting.attendance.length > 0 ? (
              <div className="grid gap-3">
                {meeting.attendance.map((record) => (
                  <article
                    key={record.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.12)] text-sm font-semibold text-[var(--gold-deep)]">
                          {initials(record.member.firstName, record.member.lastName)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[var(--ink-strong)]">
                            {record.member.firstName} {record.member.lastName}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-3 text-sm text-[var(--ink-muted)]">
                            <span>{record.diningChoice || 'No dining choice'}</span>
                            <span>{record.guestCount} guest{record.guestCount === 1 ? '' : 's'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill status={record.status} />
                        {canUpdateAttendance ? (
                          <div className="flex gap-1">
                            {['PRESENT', 'APOLOGY', 'ABSENT'].map((status) => (
                              <button
                                key={status}
                                onClick={() =>
                                  updateAttendanceMutation.mutate({
                                    attendanceId: record.id,
                                    status,
                                  })
                                }
                                disabled={record.status === status}
                                className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                                  record.status === status
                                    ? 'bg-[linear-gradient(135deg,rgba(24,40,64,0.96),rgba(16,28,46,0.96))] text-[var(--gold-soft)]'
                                    : 'border border-[var(--border-subtle)] bg-deep-blue/60 text-[var(--ink-muted)] hover:text-[var(--ink-strong)]'
                                }`}
                              >
                                {status.toLowerCase()}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No attendance records have been added." />
            )
          ) : null}

          {activeTab === 'minutes' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--ink-strong)]">Minutes</p>
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">
                      {meeting.minutesApproved
                        ? `Approved${meeting.minutesApprovedDate ? ` on ${formatDate(meeting.minutesApprovedDate)}` : ''}`
                        : 'Awaiting approval'}
                    </p>
                  </div>
                  {isWM && !meeting.minutesApproved ? (
                    <button
                      onClick={() => approveMinutesMutation.mutate()}
                      disabled={approveMinutesMutation.isPending}
                      className="rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(24,40,64,0.96),rgba(16,28,46,0.96))] px-4 py-3 text-sm font-medium text-[var(--gold-soft)] transition disabled:opacity-50"
                    >
                      {approveMinutesMutation.isPending ? 'Approving...' : 'Approve minutes'}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5">
                {meeting.minutesContent ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap text-[var(--ink-strong)]">
                    {meeting.minutesContent}
                  </div>
                ) : (
                  <EmptyBlock message="No minutes have been added yet." compact />
                )}
              </div>
            </div>
          ) : null}

          {activeTab === 'dining' ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Dining responses" value={diningResponses} compact />
                <MetricCard label="Guest covers" value={guestCount} compact />
                <MetricCard
                  label="Dining cost"
                  value={meeting.diningCost != null ? formatCurrency(meeting.diningCost) : 'Not set'}
                  compact
                />
              </div>

              {meeting.diningMenu && meeting.diningMenu.length > 0 ? (
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5">
                  <p className="text-sm font-medium text-[var(--ink-strong)]">Menu</p>
                  <ul className="mt-3 grid gap-2 text-sm text-[var(--ink-muted)]">
                    {meeting.diningMenu.map((item, index) => (
                      <li key={`${item}-${index}`} className="inline-flex items-center gap-2">
                        <ScrollText className="h-4 w-4 text-[var(--gold-deep)]" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="grid gap-3">
                {meeting.attendance
                  .filter((entry) => entry.diningChoice || entry.guestCount > 0)
                  .map((entry) => (
                    <article
                      key={entry.id}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--ink-strong)]">
                            {entry.member.firstName} {entry.member.lastName}
                          </p>
                          <p className="mt-1 text-sm text-[var(--ink-muted)]">
                            {entry.diningChoice || 'Dining choice not provided'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-[var(--ink-muted)]">
                          <span>{entry.guestCount} guest{entry.guestCount === 1 ? '' : 's'}</span>
                          <StatusPill status={entry.status} />
                        </div>
                      </div>
                    </article>
                  ))}

                {meeting.attendance.filter((entry) => entry.diningChoice || entry.guestCount > 0).length === 0 ? (
                  <EmptyBlock message="No dining responses recorded yet." />
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'visitors' ? (
            meeting.visitors && meeting.visitors.length > 0 ? (
              <div className="grid gap-3">
                {meeting.visitors.map((visitor) => (
                  <article
                    key={visitor.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">
                          {visitor.firstName} {visitor.lastName}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                          {visitor.rank ? `${visitor.rank}, ` : ''}
                          {visitor.lodgeName}
                          {visitor.lodgeNumber ? ` No. ${visitor.lodgeNumber}` : ''}
                        </p>
                      </div>
                      <Badge variant={visitor.dining ? 'success' : 'default'}>
                        {visitor.dining ? 'Dining' : 'Meeting only'}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No visitors recorded for this meeting." />
            )
          ) : null}

          {activeTab === 'ceremony' ? (
            meeting.ceremonyPlan ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-display text-3xl text-[var(--ink-strong)]">
                      {meeting.ceremonyPlan.ceremonyType}
                    </h3>
                    <Badge variant={meeting.ceremonyPlan.isConfirmed ? 'success' : 'warning'}>
                      {meeting.ceremonyPlan.isConfirmed ? 'Confirmed' : 'Draft'}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3">
                  {meeting.ceremonyPlan.roles.map((role) => (
                    <article
                      key={`${role.role}-${role.memberId}`}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-medium text-[var(--ink-strong)]">{role.role}</p>
                          <p className="mt-1 text-sm text-[var(--ink-muted)]">
                            {role.memberName || 'Member assigned'}
                          </p>
                        </div>
                        <Badge variant={role.confirmed ? 'success' : 'warning'}>
                          {role.confirmed ? 'Confirmed' : 'Awaiting confirmation'}
                        </Badge>
                      </div>
                    </article>
                  ))}

                  {meeting.ceremonyPlan.roles.length === 0 ? (
                    <EmptyBlock message="No roles allocated yet." />
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyBlock message="No ceremony plan linked to this meeting." />
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}

function PulseCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 font-display text-3xl text-white">{value}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string | number;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 ${
        compact ? 'p-4' : 'p-5'
      }`}
    >
      <p className="text-sm text-[var(--ink-muted)]">{label}</p>
      <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

function EmptyBlock({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] text-sm text-[var(--ink-muted)] ${
        compact ? 'p-4' : 'p-6'
      }`}
    >
      {message}
    </div>
  );
}

interface RsvpSummary {
  PENDING?: number; ATTENDING?: number; ATTENDING_WITH_GUESTS?: number; NOT_ATTENDING?: number;
  guests?: number; totalDining?: number;
}
interface RsvpRow {
  id: string; status: string; guestCount: number; guestNames: string | null;
  dietaryRequirements: string | null; notes: string | null; respondedAt: string | null;
  member: { id: string; firstName: string; lastName: string; email: string | null };
}

function SummonsAndRsvpSection({ meetingId }: { meetingId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ rsvps: RsvpRow[]; summary: RsvpSummary }>({
    queryKey: ['rsvps', meetingId],
    queryFn: async () => (await api.get(`/ritual/summons/rsvps/${meetingId}`)).data,
    refetchInterval: 60_000,
  });
  const sendMut = useMutation({
    mutationFn: async () => (await api.post(`/ritual/summons/send/${meetingId}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rsvps', meetingId] }),
  });

  // Lookup the memberIds for "me" (Jamie) and Alex (DC) so the test button
  // hits exactly those two regardless of UI ordering.
  const { data: meta } = useQuery<{ jamieId?: string; alexId?: string }>({
    queryKey: ['rsvp-test-targets'],
    queryFn: async () => {
      const { data } = await api.get('/members?limit=500');
      const list: Array<{ id: string; firstName: string; lastName: string; email: string | null }> =
        Array.isArray(data) ? data : data?.data ?? data?.members ?? [];
      const jamie = list.find((m) => m.email === 'jamie.white@gmail.com');
      const alex = list.find((m) => m.email === 'arobinson1988@hotmail.co.uk');
      return { jamieId: jamie?.id, alexId: alex?.id };
    },
    staleTime: 5 * 60_000,
  });

  const testMut = useMutation({
    mutationFn: async () => {
      const recipientIds = [meta?.jamieId, meta?.alexId].filter(Boolean) as string[];
      return (await api.post(`/ritual/summons/send/${meetingId}`, { recipientIds, testTag: true })).data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rsvps', meetingId] }),
  });

  const summary = data?.summary ?? {};
  const rsvps = data?.rsvps ?? [];

  return (
    <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow mb-1">Summons & dining</p>
          <h2 className="font-display text-xl sm:text-2xl text-[var(--ink-strong)]">Send summons / RSVPs</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`${api.defaults.baseURL}/ritual/summons/pdf/${meetingId}`}
            target="_blank"
            rel="noreferrer"
            onClick={async (e) => {
              // axios attaches Authorization via interceptors; <a> can't,
              // so fetch the PDF blob via api and open it in a new tab.
              e.preventDefault();
              const r = await api.get(`/ritual/summons/pdf/${meetingId}`, { responseType: 'blob' });
              const url = URL.createObjectURL(r.data);
              window.open(url, '_blank');
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }}
            className="inline-flex items-center gap-2 rounded-sm border border-brass-gold/40 bg-deep-blue/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-brass-gold transition-colors hover:border-brass-gold hover:bg-deep-blue"
          >
            <FileText size={14} />
            Preview PDF
          </a>
          <button
            onClick={() => testMut.mutate()}
            disabled={testMut.isPending || !(meta?.jamieId && meta?.alexId)}
            title="Sends only to jamie.white@gmail.com and arobinson1988@hotmail.co.uk"
            className="inline-flex items-center gap-2 rounded-sm border border-brass-gold/40 bg-deep-blue/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.06em] text-brass-gold transition-colors hover:border-brass-gold hover:bg-deep-blue disabled:opacity-40"
          >
            <Mail size={14} />
            {testMut.isPending ? 'Sending…' : 'Test summons (me + DC)'}
          </button>
          <button
            onClick={() => { if (confirm('Send the summons to every active member with an email on file?')) sendMut.mutate(); }}
            disabled={sendMut.isPending}
            className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.06em] text-navy transition-all duration-300 hover:shadow-glow hover:-translate-y-0.5 disabled:opacity-40"
          >
            <Mail size={14} />
            {sendMut.isPending ? 'Sending…' : 'Send summons'}
          </button>
        </div>
      </div>
      {(sendMut.data || testMut.data) && (
        <p className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {testMut.data ? '[Test] ' : ''}Sent {(sendMut.data ?? testMut.data).sent} summons · skipped {(sendMut.data ?? testMut.data).skipped} (no email on file)
          {(sendMut.data ?? testMut.data).errors?.length ? ` · ${(sendMut.data ?? testMut.data).errors.length} failed` : ''}
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Mini label="Attending" value={(summary.ATTENDING ?? 0) + (summary.ATTENDING_WITH_GUESTS ?? 0)} />
        <Mini label="Guests" value={summary.guests ?? 0} />
        <Mini label="Apologies" value={summary.NOT_ATTENDING ?? 0} />
        <Mini label="Pending" value={summary.PENDING ?? 0} />
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-6 text-center text-[var(--ink-muted)]">Loading RSVPs…</div>
      ) : rsvps.length === 0 ? (
        <EmptyBlock message="No RSVPs yet — send the summons to start collecting responses." />
      ) : (
        <div className="space-y-2">
          {rsvps.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-[var(--ink-strong)]">{r.member.firstName} {r.member.lastName}</p>
                <p className="truncate text-[11px] text-steel-grey">
                  {r.dietaryRequirements ? `🍽️ ${r.dietaryRequirements}` : ''}
                  {r.dietaryRequirements && r.notes ? ' · ' : ''}
                  {r.notes ? `📝 ${r.notes}` : ''}
                  {r.guestNames ? ` · 👥 ${r.guestNames}` : ''}
                </p>
              </div>
              <div className="ml-3 text-right">
                {r.status === 'ATTENDING' && <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.06em] text-emerald-300">Attending</span>}
                {r.status === 'ATTENDING_WITH_GUESTS' && <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-[11px] uppercase tracking-[0.06em] text-emerald-300">Attending +{r.guestCount}</span>}
                {r.status === 'NOT_ATTENDING' && <span className="rounded-md bg-forge-orange/20 px-2 py-1 text-[11px] uppercase tracking-[0.06em] text-forge-orange">Apology</span>}
                {r.status === 'PENDING' && <span className="rounded-md bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.06em] text-steel-grey">Pending</span>}
                {r.respondedAt && <p className="mt-1 text-[10px] text-steel-grey/70">{new Date(r.respondedAt).toLocaleDateString('en-GB')}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-deep-blue/40 p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-steel-grey">{label}</p>
      <p className="mt-1 font-display text-2xl text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}

interface AgendaItemRow {
  uid: string; // local-only stable id for dnd-kit
  title: string;
  description?: string;
}

function AgendaEditor({ meetingId, initial }: { meetingId: string; initial: AgendaItem[] }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<AgendaItemRow[]>(() =>
    initial.map((it, i) => ({ uid: `seed-${i}-${Math.random().toString(36).slice(2, 7)}`, title: it.title, description: it.description })),
  );
  const [dirty, setDirty] = useState(false);

  // Re-seed local state when the parent re-fetches with fresh data.
  useEffect(() => {
    setItems(initial.map((it, i) => ({ uid: `seed-${i}-${Math.random().toString(36).slice(2, 7)}`, title: it.title, description: it.description })));
    setDirty(false);
  }, [initial]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const saveMut = useMutation({
    mutationFn: async (next: AgendaItemRow[]) => {
      const payload = next
        .filter((r) => r.title.trim().length > 0)
        .map(({ title, description }) => ({
          title: title.trim(),
          ...(description?.trim() ? { description: description.trim() } : {}),
        }));
      await api.put(`/meetings/${meetingId}`, { agendaItems: payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meeting', meetingId] });
      setDirty(false);
    },
  });

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((p) => p.uid === active.id);
      const newIndex = prev.findIndex((p) => p.uid === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
  };

  const updateRow = (uid: string, patch: Partial<AgendaItemRow>) => {
    setItems((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
    setDirty(true);
  };

  const removeRow = (uid: string) => {
    setItems((prev) => prev.filter((r) => r.uid !== uid));
    setDirty(true);
  };

  const addRow = () => {
    setItems((prev) => [...prev, { uid: `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: '' }]);
    setDirty(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--ink-muted)]">Drag the handle to reorder. Items save when you press Save.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={addRow}
            className="inline-flex items-center gap-1.5 rounded-sm border border-brass-gold/40 bg-deep-blue/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-brass-gold transition-colors hover:border-brass-gold hover:bg-deep-blue"
          >
            <Plus size={14} /> Add item
          </button>
          <button
            onClick={() => saveMut.mutate(items)}
            disabled={!dirty || saveMut.isPending}
            className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-navy transition-all duration-300 hover:shadow-glow hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            {saveMut.isPending ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyBlock message="No agenda items yet — click 'Add item' to start." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.uid)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-2">
              {items.map((row, idx) => (
                <AgendaRow
                  key={row.uid}
                  row={row}
                  index={idx}
                  onChange={(patch) => updateRow(row.uid, patch)}
                  onRemove={() => removeRow(row.uid)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function AgendaRow({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: AgendaItemRow;
  index: number;
  onChange: (patch: Partial<AgendaItemRow>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.uid });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-3"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-1.5 cursor-grab touch-none rounded-md p-1 text-steel-grey hover:bg-white/5 hover:text-[var(--ink-strong)] active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical size={16} />
      </button>
      <span className="mt-1.5 w-6 text-center font-display text-lg text-[var(--gold-deep)]">{index + 1}</span>
      <div className="flex-1 space-y-1.5">
        <input
          value={row.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Agenda item title"
          className="w-full rounded-md border border-[var(--border-subtle)] bg-deep-blue/40 px-2.5 py-1.5 text-sm text-[var(--ink-strong)] placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none"
        />
        <input
          value={row.description ?? ''}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Optional notes (e.g. proposer, candidate details)"
          className="w-full rounded-md border border-[var(--border-subtle)] bg-deep-blue/30 px-2.5 py-1.5 text-xs text-[var(--ink-muted)] placeholder:text-steel-grey/50 focus:border-brass-gold/60 focus:outline-none"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="mt-1 rounded-md p-1.5 text-steel-grey hover:bg-forge-orange/10 hover:text-forge-orange"
        aria-label="Remove agenda item"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
