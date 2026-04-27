import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Edit2,
  Mail,
  Phone,
  PoundSterling,
  Shield,
  UserCheck,
} from 'lucide-react';
import api from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  degreeLabel,
  initials,
} from '@/lib/utils';
import Badge from '@/components/shared/Badge';
import StatusPill from '@/components/shared/StatusPill';

interface MemberDetail {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  occupation?: string;
  photoUrl?: string;
  degree: string;
  status: string;
  dateInitiated?: string;
  datePassed?: string;
  dateRaised?: string;
  dateJoined?: string;
  previousLodge?: string;
  previousLodgeNumber?: string;
  proposer?: { id: string; firstName: string; lastName: string };
  seconder?: { id: string; firstName: string; lastName: string };
  officers?: Array<{ office: string; year: number; isActive: boolean }>;
}

interface AttendanceRecord {
  id: string;
  status: string;
  meeting: { id: string; date: string; type: string };
}

interface DuesRecord {
  id: string;
  year: number;
  amount: number;
  status: string;
  paidDate?: string;
  paidAmount?: number;
}

interface Honour {
  id: string;
  rank: string;
  fullTitle: string;
  level: string;
  dateConferred?: string;
}

interface DegreeProgression {
  id: string;
  degree: string;
  ceremonyDate: string;
  conductedBy?: string;
  proficiencyPassed: boolean;
  proficiencyDate?: string;
}

const tabs = [
  { key: 'attendance', label: 'Attendance', icon: UserCheck },
  { key: 'dues', label: 'Dues', icon: PoundSterling },
  { key: 'honours', label: 'Honours', icon: Award },
  { key: 'progression', label: 'Progression', icon: BookOpen },
] as const;

type TabKey = (typeof tabs)[number]['key'];

function officeLabel(office: string): string {
  return office
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

function meetingTypeLabel(type: string): string {
  return type
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('attendance');

  const { data: member, isLoading } = useQuery<MemberDetail>({
    queryKey: ['member', id],
    queryFn: () => api.get(`/members/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['member', id, 'attendance'],
    queryFn: () => api.get(`/members/${id}/attendance`).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!id && activeTab === 'attendance',
  });

  const { data: dues = [] } = useQuery<DuesRecord[]>({
    queryKey: ['member', id, 'dues'],
    queryFn: () => api.get(`/members/${id}/dues`).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!id && activeTab === 'dues',
  });

  const { data: honours = [] } = useQuery<Honour[]>({
    queryKey: ['member', id, 'honours'],
    queryFn: () => api.get(`/members/${id}/honours`).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!id && activeTab === 'honours',
  });

  const { data: progression = [] } = useQuery<DegreeProgression[]>({
    queryKey: ['member', id, 'progression'],
    queryFn: () => api.get(`/members/${id}/progression`).then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!id && activeTab === 'progression',
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-[var(--ink-muted)]">
        Loading member profile...
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--ink-muted)]">
        <p className="text-sm">Member not found.</p>
        <button
          onClick={() => navigate('/members')}
          className="mt-3 text-sm text-[var(--gold-deep)] hover:underline"
        >
          Back to members
        </button>
      </div>
    );
  }

  const activeOffices = member.officers?.filter((office) => office.isActive) ?? [];
  const attendancePresent = attendance.filter((entry) => entry.status === 'PRESENT').length;
  const duesOutstanding = dues
    .filter((entry) => entry.status !== 'CURRENT')
    .reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="space-y-8">
      <button
        onClick={() => navigate('/members')}
        className="inline-flex items-center gap-2 text-sm text-[var(--ink-muted)] transition hover:text-[var(--ink-strong)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to members
      </button>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.85fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            {member.photoUrl ? (
              <img src={member.photoUrl} alt="" className="h-24 w-24 rounded-[24px] object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-[24px] border border-[var(--border-strong)] bg-[rgba(201,168,76,0.12)] text-3xl font-semibold text-[var(--gold-deep)]">
                {initials(member.firstName, member.lastName)}
              </div>
            )}

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl text-[var(--ink-strong)]">
                  {member.firstName} {member.lastName}
                </h1>
                <Badge variant="info">{degreeLabel(member.degree)}</Badge>
                <StatusPill status={member.status} />
              </div>

              {activeOffices.length > 0 ? (
                <div className="mt-3 inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[var(--gold-deep)]">
                  <Shield className="h-3.5 w-3.5" />
                  {activeOffices.map((office) => officeLabel(office.office)).join(', ')}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--ink-muted)]">
                {member.email ? (
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-[var(--gold-deep)]" />
                    {member.email}
                  </span>
                ) : null}
                {member.phone ? (
                  <span className="inline-flex items-center gap-2">
                    <Phone className="h-4 w-4 text-[var(--gold-deep)]" />
                    {member.phone}
                  </span>
                ) : null}
                {member.occupation ? (
                  <span className="inline-flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-[var(--gold-deep)]" />
                    {member.occupation}
                  </span>
                ) : null}
              </div>
            </div>

            <button className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-muted)] transition hover:border-brass-gold/40 hover:bg-deep-blue hover:text-[var(--ink-strong)]">
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          </div>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Member pulse</p>
          <div className="mt-6 grid gap-3">
            <ProfilePulse label="Attendance present" value={attendancePresent} />
            <ProfilePulse label="Outstanding dues" value={formatCurrency(duesOutstanding)} />
            <ProfilePulse label="Honours" value={honours.length} />
            <ProfilePulse label="Progress steps" value={progression.length} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <ProfileCard
          title="Personal details"
          lines={[
            member.dateOfBirth ? `Date of birth: ${formatDate(member.dateOfBirth)}` : null,
            member.address ? `Address: ${member.address}` : null,
            member.occupation ? `Occupation: ${member.occupation}` : null,
          ]}
        />
        <ProfileCard
          title="Masonic details"
          lines={[
            `Degree: ${degreeLabel(member.degree)}`,
            member.dateInitiated ? `Initiated: ${formatDate(member.dateInitiated)}` : null,
            member.datePassed ? `Passed: ${formatDate(member.datePassed)}` : null,
            member.dateRaised ? `Raised: ${formatDate(member.dateRaised)}` : null,
            member.previousLodge
              ? `Previous lodge: ${member.previousLodge}${member.previousLodgeNumber ? ` No. ${member.previousLodgeNumber}` : ''}`
              : null,
          ]}
        />
        <ProfileCard
          title="Sponsorship"
          lines={[
            member.proposer
              ? `Proposer: ${member.proposer.firstName} ${member.proposer.lastName}`
              : 'Proposer: -',
            member.seconder
              ? `Seconder: ${member.seconder.firstName} ${member.seconder.lastName}`
              : 'Seconder: -',
            member.dateJoined ? `Joined lodge: ${formatDate(member.dateJoined)}` : null,
          ]}
        />
      </section>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div className="border-b border-[var(--border-subtle)] px-3 pt-3">
          <nav className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
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
          {activeTab === 'attendance' ? (
            attendance.length > 0 ? (
              <div className="grid gap-3">
                {attendance.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">
                          {meetingTypeLabel(entry.meeting.type)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                          {formatDate(entry.meeting.date)}
                        </p>
                      </div>
                      <StatusPill status={entry.status} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No attendance history available." />
            )
          ) : null}

          {activeTab === 'dues' ? (
            dues.length > 0 ? (
              <div className="grid gap-3">
                {dues.map((entry) => (
                  <article
                    key={entry.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">{entry.year}</p>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                          {formatCurrency(entry.amount)}
                          {entry.paidDate ? ` paid on ${formatDate(entry.paidDate)}` : ''}
                        </p>
                      </div>
                      <StatusPill status={entry.status} />
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No dues records available." />
            )
          ) : null}

          {activeTab === 'honours' ? (
            honours.length > 0 ? (
              <div className="grid gap-3">
                {honours.map((honour) => (
                  <article
                    key={honour.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                  >
                    <p className="text-sm font-medium text-[var(--ink-strong)]">{honour.fullTitle}</p>
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">
                      {honour.level}
                      {honour.dateConferred ? `, conferred ${formatDate(honour.dateConferred)}` : ''}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No honours recorded." />
            )
          ) : null}

          {activeTab === 'progression' ? (
            progression.length > 0 ? (
              <div className="grid gap-3">
                {progression.map((step) => (
                  <article
                    key={step.id}
                    className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-strong)] p-4"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">
                          {degreeLabel(step.degree)}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                          {formatDate(step.ceremonyDate)}
                          {step.conductedBy ? `, conducted by ${step.conductedBy}` : ''}
                        </p>
                      </div>
                      <Badge variant={step.proficiencyPassed ? 'success' : 'warning'}>
                        {step.proficiencyPassed ? 'Proficiency passed' : 'Proficiency pending'}
                      </Badge>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyBlock message="No degree progression recorded." />
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ProfilePulse({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 font-display text-3xl text-white">{value}</p>
    </div>
  );
}

function ProfileCard({ title, lines }: { title: string; lines: Array<string | null> }) {
  const visibleLines = lines.filter(Boolean) as string[];

  return (
    <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
      <p className="text-sm font-medium text-[var(--ink-strong)]">{title}</p>
      <div className="mt-3 grid gap-2 text-sm text-[var(--ink-muted)]">
        {visibleLines.length > 0 ? visibleLines.map((line) => <p key={line}>{line}</p>) : <p>No details recorded.</p>}
      </div>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-6 text-sm text-[var(--ink-muted)]">
      {message}
    </div>
  );
}
