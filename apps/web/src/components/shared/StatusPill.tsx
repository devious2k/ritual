import { classNames } from '@/lib/utils';

interface StatusPillProps {
  status: string;
  className?: string;
}

// Re-keyed for the dark vulcan-lodge palette: muted backgrounds with a saturated foreground.
const tone = {
  good: 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  warn: 'border border-forge-orange/30 bg-forge-orange/10 text-forge-orange',
  bad: 'border border-red-400/30 bg-red-500/10 text-red-300',
  neutral: 'border border-white/10 bg-white/5 text-steel-grey',
  gold: 'border border-[var(--border-strong)] bg-[rgba(201,162,74,0.12)] text-brass-gold',
  indigo: 'border border-indigo-400/30 bg-indigo-500/10 text-indigo-300',
  purple: 'border border-purple-400/30 bg-purple-500/10 text-purple-300',
  yellow: 'border border-yellow-400/30 bg-yellow-500/10 text-yellow-300',
} as const;

const statusColors: Record<string, string> = {
  // Payment / Dues
  CURRENT: tone.good,
  SUCCEEDED: tone.good,
  PAID: tone.good,
  PENDING: tone.warn,
  OVERDUE: tone.bad,
  ARREARS: tone.bad,
  FAILED: tone.bad,
  REFUNDED: tone.neutral,
  PARTIALLY_REFUNDED: tone.warn,
  WAIVED: tone.gold,
  HONORARY_EXEMPT: tone.purple,
  // Member status
  ACTIVE: tone.good,
  SUSPENDED: tone.warn,
  EXCLUDED: tone.bad,
  RESIGNED: tone.neutral,
  DECEASED: tone.neutral,
  HONORARY: tone.purple,
  COUNTRY_MEMBER: tone.gold,
  // Candidate status
  ENQUIRY: tone.gold,
  INTERVIEW: tone.indigo,
  PROPOSED: tone.yellow,
  BALLOT_PENDING: tone.warn,
  BALLOT_APPROVED: tone.good,
  BALLOT_REJECTED: tone.bad,
  INITIATED: tone.good,
  WITHDRAWN: tone.neutral,
  // Almoner
  OPEN: tone.bad,
  MONITORING: tone.yellow,
  CLOSED: tone.neutral,
  REFERRED: tone.gold,
  // Attendance
  PRESENT: tone.good,
  APOLOGY: tone.yellow,
  ABSENT: tone.bad,
  VISITOR: tone.gold,
  // Generic
  SENT: tone.good,
  DRAFT: tone.neutral,
};

const fallback = tone.neutral;

export default function StatusPill({ status, className }: StatusPillProps) {
  const colors = statusColors[status] || fallback;
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        colors,
        className,
      )}
    >
      {label.toLowerCase()}
    </span>
  );
}
