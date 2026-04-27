import { useState, FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  Phone,
  Plus,
  Search,
  Shield,
  Users,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { degreeAbbrev, degreeLabel, initials } from '@/lib/utils';
import Badge from '@/components/shared/Badge';
import StatusPill from '@/components/shared/StatusPill';

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  degree: string;
  status: string;
  office?: string;
  photoUrl?: string;
}

interface MembersResponse {
  data: Member[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'RESIGNED', label: 'Resigned' },
  { value: 'HONORARY', label: 'Honorary' },
  { value: 'COUNTRY_MEMBER', label: 'Country member' },
  { value: 'DECEASED', label: 'Deceased' },
];

const degreeOptions = [
  { value: '', label: 'All degrees' },
  { value: 'ENTERED_APPRENTICE', label: 'Entered Apprentice' },
  { value: 'FELLOW_CRAFT', label: 'Fellow Craft' },
  { value: 'MASTER_MASON', label: 'Master Mason' },
];

function officeLabel(office: string): string {
  return office
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function Members() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canAdd = ['SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'].includes(user?.role ?? '');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [degreeFilter, setDegreeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery<MembersResponse>({
    queryKey: ['members', search, statusFilter, degreeFilter, page],
    queryFn: () =>
      api
        .get('/members', {
          params: {
            search: search || undefined,
            status: statusFilter || undefined,
            degree: degreeFilter || undefined,
            page,
            pageSize: 20,
          },
        })
        .then((r) => r.data),
  });

  const members = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.pages ?? (Math.ceil(total / 20) || 1);
  const activeMembers = members.filter((member) => member.status === 'ACTIVE').length;
  const officeHolders = members.filter((member) => member.office).length;
  const masterMasons = members.filter((member) => member.degree === 'MASTER_MASON').length;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Members</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink-strong)]">
            Keep the lodge roll clear, current, and ready for the next night.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
            See who is active, who holds office, and who may still need attention before the
            next meeting, ceremony, or festive board.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-[minmax(0,1fr)_200px_200px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 py-3 pl-11 pr-4 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={degreeFilter}
              onChange={(e) => {
                setDegreeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
            >
              {degreeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {canAdd ? (
            <div className="mt-6">
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(24,40,64,0.96),rgba(16,28,46,0.96))] px-5 py-3 text-sm font-medium text-[var(--gold-soft)] shadow-[0_12px_24px_rgba(15,23,42,0.18)] transition hover:translate-y-[-1px]"
              >
                <Plus className="h-4 w-4" />
                Add member
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Lodge roll</p>
          <div className="mt-6 grid gap-3">
            <RosterPulse label="Members in view" value={total} />
            <RosterPulse label="Active in view" value={activeMembers} />
            <RosterPulse label="Office holders" value={officeHolders} />
            <RosterPulse label="Master Masons" value={masterMasons} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <MemberMetric label="Total members" value={total} />
        <MemberMetric label="Active members" value={activeMembers} />
        <MemberMetric label="Office holders" value={officeHolders} />
      </section>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div>
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Member roll</p>
          <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">Directory and offices</h2>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-[var(--ink-muted)]">Loading members...</div>
        ) : members.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center rounded-[24px] border border-dashed border-[var(--border-subtle)] bg-white/[0.03] py-16 text-[var(--ink-muted)]">
            <Users className="mb-3 h-10 w-10" />
            <p className="text-sm font-medium text-[var(--ink-strong)]">No members found</p>
            <p className="mt-1 text-xs">Try adjusting the filters or search.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => navigate(`/members/${member.id}`)}
                className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-5 text-left transition hover:translate-y-[-1px] hover:bg-white"
              >
                <div className="flex items-start gap-4">
                  {member.photoUrl ? (
                    <img
                      src={member.photoUrl}
                      alt=""
                      className="h-14 w-14 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-strong)] bg-[rgba(201,168,76,0.12)] text-base font-semibold text-[var(--gold-deep)]">
                      {initials(member.firstName, member.lastName)}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-2xl text-[var(--ink-strong)]">
                        {member.firstName} {member.lastName}
                      </h3>
                      <Badge variant="info">{degreeAbbrev(member.degree)}</Badge>
                      <StatusPill status={member.status} />
                    </div>

                    <p className="mt-1 text-sm text-[var(--ink-muted)]">{degreeLabel(member.degree)}</p>

                    {member.office ? (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-deep)]">
                        <Shield className="h-3.5 w-3.5" />
                        {officeLabel(member.office)}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-4 w-4 text-[var(--gold-deep)]" />
                        {member.email || 'No email recorded'}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 text-[var(--gold-deep)]" />
                        {member.phone || 'No phone recorded'}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="mt-6 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
            <p className="text-xs text-[var(--ink-muted)]">
              Showing {(page - 1) * 20 + 1}&ndash;{Math.min(page * 20, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 p-2 text-[var(--ink-muted)] transition hover:bg-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-[var(--ink-muted)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 p-2 text-[var(--ink-muted)] transition hover:bg-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {showModal ? (
        <AddMemberModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['members'] });
          }}
        />
      ) : null}
    </div>
  );
}

function AddMemberModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    degree: 'ENTERED_APPRENTICE',
    status: 'ACTIVE',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/members', data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => setError(err.response?.data?.error || 'Failed to add member.'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate(form);
  }

  function update(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(11,20,34,0.55)] px-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-[0_30px_80px_rgba(12,22,38,0.28)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Add Member</p>
            <h2 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">New lodge record</h2>
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

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name">
              <input
                required
                value={form.firstName}
                onChange={(e) => update('firstName', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </Field>
            <Field label="Last name">
              <input
                required
                value={form.lastName}
                onChange={(e) => update('lastName', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Degree">
              <select
                value={form.degree}
                onChange={(e) => update('degree', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              >
                {degreeOptions
                  .filter((option) => option.value)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
              >
                {statusOptions
                  .filter((option) => option.value)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
            </Field>
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
              {mutation.isPending ? 'Saving...' : 'Save member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">{label}</span>
      {children}
    </label>
  );
}

function RosterPulse({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 font-display text-3xl text-white">{value}</p>
    </div>
  );
}

function MemberMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
      <p className="text-sm text-[var(--ink-muted)]">{label}</p>
      <p className="mt-2 font-display text-4xl text-[var(--ink-strong)]">{value}</p>
    </div>
  );
}
