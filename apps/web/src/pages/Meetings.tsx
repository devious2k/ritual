import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  ScrollText,
  Users,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';

interface Meeting {
  id: string;
  type: string;
  date: string;
  startTime?: string;
  venue?: string;
  ceremonyType?: string;
  attendanceCount?: number;
}

const typeOptions = [
  { value: '', label: 'All meetings' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'EMERGENCY', label: 'Emergency' },
  { value: 'INSTALLATION', label: 'Installation' },
  { value: 'REHEARSAL', label: 'Rehearsal' },
  { value: 'LODGE_OF_INSTRUCTION', label: 'Lodge of Instruction' },
  { value: 'COMMITTEE', label: 'Committee' },
  { value: 'SOCIAL', label: 'Social' },
];

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function nextMeetingFromList(meetings: Meeting[]) {
  const now = new Date().getTime();
  return [...meetings]
    .filter((meeting) => new Date(meeting.date).getTime() >= now - 24 * 60 * 60 * 1000)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
}

export default function Meetings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canAdd = ['SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'].includes(user?.role ?? '');

  const [typeFilter, setTypeFilter] = useState('');
  const [showModal, setShowModal] = useState(false);

  const { data: meetingsRaw = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ['meetings', typeFilter],
    queryFn: () =>
      api
        .get('/meetings', { params: { type: typeFilter || undefined } })
        .then((r) => r.data?.data ?? r.data ?? []),
  });

  // Surface upcoming first (soonest at top), then past meetings most-recent first.
  const meetings = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cmp = (a: Meeting, b: Meeting) => +new Date(a.date) - +new Date(b.date);
    const upcoming = meetingsRaw.filter((m) => new Date(m.date) >= today).sort(cmp);
    const past = meetingsRaw.filter((m) => new Date(m.date) < today).sort((a, b) => -cmp(a, b));
    return [...upcoming, ...past];
  })();

  const nextMeeting = nextMeetingFromList(meetings);
  const ceremonyCount = meetings.filter((meeting) => meeting.ceremonyType).length;
  const attendanceTotal = meetings.reduce(
    (sum, meeting) => sum + (meeting.attendanceCount || 0),
    0,
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Meetings</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink-strong)]">
            Keep the evening organised before anyone arrives.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
            Schedule lodge nights, set the ceremony, and keep the details visible to everyone
            preparing the room, the ritual, and the festive board.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              {typeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {canAdd ? (
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(24,40,64,0.96),rgba(16,28,46,0.96))] px-5 py-3 text-sm font-medium text-[var(--gold-soft)] shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px]"
              >
                <Plus className="h-4 w-4" />
                New meeting
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Next in the diary</p>
          {nextMeeting ? (
            <>
              <h2 className="mt-3 font-display text-3xl text-white">
                {meetingTypeLabel(nextMeeting.type)}
              </h2>
              <p className="mt-2 text-sm text-white/72">{formatDate(nextMeeting.date)}</p>
              <div className="mt-6 space-y-3 text-sm text-white/74">
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <Clock3 className="h-4 w-4 text-[var(--gold-soft)]" />
                  <span>{nextMeeting.startTime || 'Time not set yet'}</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <MapPin className="h-4 w-4 text-[var(--gold-soft)]" />
                  <span>{nextMeeting.venue || 'Venue not set yet'}</span>
                </div>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <ScrollText className="h-4 w-4 text-[var(--gold-soft)]" />
                  <span>{nextMeeting.ceremonyType || 'No ceremony assigned yet'}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-white/5 p-4 text-sm text-white/70">
              No upcoming meeting has been scheduled yet.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
          <p className="text-sm text-[var(--ink-muted)]">Meetings in view</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{meetings.length}</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
          <p className="text-sm text-[var(--ink-muted)]">Ceremonial nights</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{ceremonyCount}</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
          <p className="text-sm text-[var(--ink-muted)]">Attendance recorded</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{attendanceTotal}</p>
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Meeting Room</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Schedule and records</h2>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-[var(--ink-muted)]">Loading meetings...</div>
        ) : meetings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-white/[0.03] py-16 text-[var(--ink-muted)]">
            <Calendar className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium text-[var(--ink-strong)]">No meetings scheduled</p>
            <p className="mt-1 text-xs">Create your first meeting to begin planning.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {meetings.map((meeting) => (
              <button
                key={meeting.id}
                type="button"
                onClick={() => navigate(`/meetings/${meeting.id}`)}
                className="group rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5 text-left transition hover:translate-y-[-1px] hover:bg-white"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[rgba(201,168,76,0.12)]">
                      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold-deep)]">
                        {new Date(meeting.date).toLocaleDateString('en-GB', { month: 'short' })}
                      </span>
                      <span className="font-display text-2xl text-[var(--ink-strong)]">
                        {new Date(meeting.date).getDate()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-display text-2xl text-[var(--ink-strong)]">
                          {meetingTypeLabel(meeting.type)}
                        </h3>
                        <span className="rounded-full border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.12)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--gold-deep)]">
                          {formatDate(meeting.date)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-[var(--gold-deep)]" />
                          {meeting.startTime || 'Time not set'}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-[var(--gold-deep)]" />
                          {meeting.venue || 'Venue not set'}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Users className="h-4 w-4 text-[var(--gold-deep)]" />
                          {meeting.attendanceCount != null ? `${meeting.attendanceCount} attending` : 'Attendance not tracked'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 lg:min-w-[220px] lg:justify-end">
                    <div className="text-left lg:text-right">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--ink-faint)]">Ceremony</p>
                      <p className="mt-1 text-sm text-[var(--ink-strong)]">
                        {meeting.ceremonyType || 'Not assigned'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-[var(--ink-faint)] transition group-hover:text-[var(--ink-strong)]" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {showModal ? (
        <AddMeetingModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['meetings'] });
          }}
        />
      ) : null}
    </div>
  );
}

function AddMeetingModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    type: 'REGULAR',
    date: '',
    startTime: '',
    venue: '',
    ceremonyType: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/meetings', data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to create meeting.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate(form);
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,20,34,0.55)] px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-[0_30px_80px_rgba(12,22,38,0.28)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Create Meeting</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Add a new lodge date</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-[var(--border-subtle)] bg-white/60 p-2 text-[var(--ink-muted)] transition hover:bg-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Meeting type</label>
            <select
              value={form.type}
              onChange={(e) => update('type', e.target.value)}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              {typeOptions
                .filter((option) => option.value)
                .map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Date</label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => update('date', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Start time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => update('startTime', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Venue</label>
            <input
              value={form.venue}
              onChange={(e) => update('venue', e.target.value)}
              placeholder="Temple, hall, or venue"
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Ceremony</label>
            <input
              value={form.ceremonyType}
              onChange={(e) => update('ceremonyType', e.target.value)}
              placeholder="First Degree, Installation, rehearsal, or similar"
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl px-4 py-3 text-sm font-medium text-[var(--ink-muted)] transition hover:bg-white/60 hover:text-[var(--ink-strong)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(24,40,64,0.96),rgba(16,28,46,0.96))] px-5 py-3 text-sm font-medium text-[var(--gold-soft)] transition disabled:opacity-50"
            >
              {mutation.isPending ? 'Creating...' : 'Create meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
