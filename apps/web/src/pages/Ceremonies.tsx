import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, CheckCircle, Plus, Sparkles, Users } from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';
import Button from '@/components/shared/Button';
import Modal from '@/components/shared/Modal';
import Badge from '@/components/shared/Badge';
import EmptyState from '@/components/shared/EmptyState';

interface CeremonyRole {
  id: string;
  role: string;
  confirmed: boolean;
  member: { id: string; firstName: string; lastName: string };
}

interface Rehearsal {
  id: string;
  date: string;
  time?: string;
  venue?: string;
  notes?: string;
}

interface CeremonyPlan {
  id: string;
  ceremonyType: string;
  isConfirmed: boolean;
  notes?: string;
  meetingId: string;
  meeting: { id: string; date: string; type: string };
  roles: CeremonyRole[];
  rehearsals: Rehearsal[];
}

interface MemberOption {
  id: string;
  firstName: string;
  lastName: string;
}

const CEREMONY_ROLES = [
  'Worshipful Master',
  'Senior Warden',
  'Junior Warden',
  'Senior Deacon',
  'Junior Deacon',
  'Inner Guard',
  'Director of Ceremonies',
  'Chaplain',
  'First Degree Charge',
  'Second Degree Charge',
  'Third Degree Charge',
  'Working Tools',
];

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function Ceremonies() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CeremonyPlan | null>(null);
  const [form, setForm] = useState({ meetingId: '', ceremonyType: '', notes: '' });

  const { data: plans = [], isLoading } = useQuery<CeremonyPlan[]>({
    queryKey: ['ceremonies'],
    queryFn: () => api.get('/ceremonies').then((r) => r.data?.data ?? r.data ?? []),
  });

  const { data: meetings = [] } = useQuery<Array<{ id: string; date: string; type: string }>>({
    queryKey: ['meetings', 'upcoming'],
    queryFn: () =>
      api
        .get('/meetings', { params: { upcoming: true } })
        .then((r) => r.data?.data ?? r.data ?? []),
  });

  const { data: members = [] } = useQuery<MemberOption[]>({
    queryKey: ['members', 'list'],
    queryFn: () =>
      api.get('/members', { params: { status: 'ACTIVE' } }).then((r) => r.data?.data ?? r.data ?? []),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => {
      const degreeMap: Record<string, string> = {
        'First Degree': 'FIRST',
        'Second Degree': 'SECOND',
        'Third Degree': 'THIRD',
        'Installation': 'INSTALLATION',
      };
      const degree = degreeMap[data.ceremonyType] || 'OTHER';
      return api.post('/ritual/ceremonies', { ...data, degree });
    },
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['ceremonies'] });
      setShowCreateModal(false);
      setForm({ meetingId: '', ceremonyType: '', notes: '' });
      // Send the user straight into the planning wizard for the new plan.
      if (data?.id) navigate(`/ceremonies/${data.id}/plan`);
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: (data: { ceremonyPlanId: string; role: string; memberId: string }) =>
      api.post(`/ceremonies/${data.ceremonyPlanId}/roles`, {
        roles: [{ role: data.role, memberId: data.memberId }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ceremonies'] });
      if (selectedPlan) {
        void openPlan(selectedPlan.id);
      }
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  async function openPlan(planId: string) {
    const { data } = await api.get(`/ceremonies/${planId}`);
    setSelectedPlan(data);
  }

  const totalAssigned = plans.reduce((sum, plan) => sum + plan.roles.length, 0);
  const totalConfirmed = plans.reduce(
    (sum, plan) => sum + plan.roles.filter((role) => role.confirmed).length,
    0,
  );
  const nextPlan = [...plans].sort(
    (a, b) => new Date(a.meeting.date).getTime() - new Date(b.meeting.date).getTime(),
  )[0];

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Ceremonies</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink-strong)]">
            See the ritual as a board to be completed, not a list to scroll through.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
            Build each ceremony around one meeting, assign the officers, and quickly spot what
            still needs confirming before rehearsal or the night itself.
          </p>

          <div className="mt-8">
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" /> Create plan
            </Button>
          </div>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Next ceremony</p>
          {nextPlan ? (
            <>
              <h2 className="mt-3 font-display text-3xl text-white">{nextPlan.ceremonyType}</h2>
              <p className="mt-2 text-sm text-white/72">
                {meetingTypeLabel(nextPlan.meeting.type)} on {formatDate(nextPlan.meeting.date)}
              </p>
              <div className="mt-6 grid gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Roles assigned</p>
                  <p className="mt-1 font-display text-3xl text-white">{nextPlan.roles.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Rehearsals</p>
                  <p className="mt-1 font-display text-3xl text-white">{nextPlan.rehearsals.length}</p>
                </div>
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/12 bg-white/5 p-4 text-sm text-white/70">
              No ceremony plan exists yet.
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
          <p className="text-sm text-[var(--ink-muted)]">Plans in motion</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{plans.length}</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
          <p className="text-sm text-[var(--ink-muted)]">Roles assigned</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{totalAssigned}</p>
        </div>
        <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
          <p className="text-sm text-[var(--ink-muted)]">Confirmed parts</p>
          <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{totalConfirmed}</p>
        </div>
      </section>

      {isLoading ? (
        <div className="py-16 text-center text-sm text-[var(--ink-muted)]">Loading ceremony plans...</div>
      ) : plans.length === 0 ? (
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <EmptyState
            icon={<Sparkles size={28} />}
            title="No ceremony plans"
            description="Create a ceremony plan to allocate ritual roles and schedule rehearsals."
            action={<Button onClick={() => setShowCreateModal(true)}>Create plan</Button>}
          />
        </div>
      ) : (
        <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <div>
            <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Ceremony Board</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Plans and allocations</h2>
          </div>

          <div className="mt-6 grid gap-4">
            {plans.map((plan) => {
              const confirmedCount = plan.roles.filter((role) => role.confirmed).length;

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => navigate(`/ceremonies/${plan.id}/plan`)}
                  className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5 text-left transition hover:translate-y-[-1px] hover:bg-white"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="font-display text-2xl text-[var(--ink-strong)]">
                          {plan.ceremonyType}
                        </h3>
                        <Badge variant={plan.isConfirmed ? 'success' : 'warning'}>
                          {plan.isConfirmed ? 'Confirmed' : 'Draft'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
                        <span className="inline-flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-[var(--gold-deep)]" />
                          {formatDate(plan.meeting.date)}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Users className="h-4 w-4 text-[var(--gold-deep)]" />
                          {plan.roles.length} roles assigned
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-[var(--gold-deep)]" />
                          {confirmedCount} confirmed
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[260px]">
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Meeting</p>
                        <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                          {meetingTypeLabel(plan.meeting.type)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Rehearsals</p>
                        <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                          {plan.rehearsals.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Ceremony Plan"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Meeting</label>
            <select
              required
              value={form.meetingId}
              onChange={(e) => setForm({ ...form, meetingId: e.target.value })}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              <option value="">Select meeting...</option>
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meetingTypeLabel(meeting.type)} - {formatDate(meeting.date)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Ceremony type</label>
            <select
              required
              value={form.ceremonyType}
              onChange={(e) => setForm({ ...form, ceremonyType: e.target.value })}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              <option value="">Select type...</option>
              <option value="First Degree">First Degree</option>
              <option value="Second Degree">Second Degree</option>
              <option value="Third Degree">Third Degree</option>
              <option value="Installation">Installation</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create plan
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedPlan}
        onClose={() => setSelectedPlan(null)}
        title={selectedPlan ? `${selectedPlan.ceremonyType} - Role Allocations` : ''}
        size="xl"
      >
        {selectedPlan ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Meeting</p>
                <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                  {meetingTypeLabel(selectedPlan.meeting.type)} on {formatDate(selectedPlan.meeting.date)}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Assigned roles</p>
                <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                  {selectedPlan.roles.length}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">Notes</p>
                <p className="mt-1 text-sm font-medium text-[var(--ink-strong)]">
                  {selectedPlan.notes || 'No notes added'}
                </p>
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-display text-2xl text-[var(--ink-strong)]">Role board</h4>
              <div className="grid gap-3">
                {CEREMONY_ROLES.map((roleName) => {
                  const assigned = selectedPlan.roles.find((role) => role.role === roleName);
                  return (
                    <div
                      key={roleName}
                      className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">{roleName}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                          Ritual station
                        </p>
                      </div>
                      {assigned ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-[var(--ink-strong)]">
                            {assigned.member.firstName} {assigned.member.lastName}
                          </span>
                          {assigned.confirmed ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : null}
                        </div>
                      ) : (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              assignRoleMutation.mutate({
                                ceremonyPlanId: selectedPlan.id,
                                role: roleName,
                                memberId: e.target.value,
                              });
                            }
                          }}
                          className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                          defaultValue=""
                        >
                          <option value="">Assign member...</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.firstName} {member.lastName}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="mb-3 font-display text-2xl text-[var(--ink-strong)]">Rehearsals</h4>
              {selectedPlan.rehearsals.length > 0 ? (
                <div className="grid gap-3">
                  {selectedPlan.rehearsals.map((rehearsal) => (
                    <div
                      key={rehearsal.id}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-[var(--border-subtle)] bg-[rgba(201,168,76,0.12)] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[var(--gold-deep)]">
                          {formatDate(rehearsal.date)}
                        </span>
                        {rehearsal.time ? (
                          <span className="text-sm text-[var(--ink-muted)]">{rehearsal.time}</span>
                        ) : null}
                        {rehearsal.venue ? (
                          <span className="text-sm text-[var(--ink-muted)]">{rehearsal.venue}</span>
                        ) : null}
                      </div>
                      {rehearsal.notes ? (
                        <p className="mt-3 text-sm text-[var(--ink-muted)]">{rehearsal.notes}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-5 text-sm text-[var(--ink-muted)]">
                  No rehearsals scheduled yet.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
