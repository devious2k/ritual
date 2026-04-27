// ─── Degrees ────────────────────────────────────────────

export const DEGREES = [
  { value: 'ENTERED_APPRENTICE', label: 'Entered Apprentice' },
  { value: 'FELLOW_CRAFT', label: 'Fellow Craft' },
  { value: 'MASTER_MASON', label: 'Master Mason' },
] as const;

// ─── Offices ────────────────────────────────────────────

export const OFFICES = [
  { value: 'WORSHIPFUL_MASTER', label: 'Worshipful Master', abbreviation: 'WM' },
  { value: 'IMMEDIATE_PAST_MASTER', label: 'Immediate Past Master', abbreviation: 'IPM' },
  { value: 'SENIOR_WARDEN', label: 'Senior Warden', abbreviation: 'SW' },
  { value: 'JUNIOR_WARDEN', label: 'Junior Warden', abbreviation: 'JW' },
  { value: 'CHAPLAIN', label: 'Chaplain', abbreviation: 'Chap' },
  { value: 'TREASURER', label: 'Treasurer', abbreviation: 'Treas' },
  { value: 'SECRETARY', label: 'Secretary', abbreviation: 'Sec' },
  { value: 'DIRECTOR_OF_CEREMONIES', label: 'Director of Ceremonies', abbreviation: 'DC' },
  { value: 'ASSISTANT_DIRECTOR_OF_CEREMONIES', label: 'Assistant Director of Ceremonies', abbreviation: 'ADC' },
  { value: 'SENIOR_DEACON', label: 'Senior Deacon', abbreviation: 'SD' },
  { value: 'JUNIOR_DEACON', label: 'Junior Deacon', abbreviation: 'JD' },
  { value: 'ASSISTANT_SECRETARY', label: 'Assistant Secretary', abbreviation: 'AsstSec' },
  { value: 'ALMONER', label: 'Almoner', abbreviation: 'Alm' },
  { value: 'CHARITY_STEWARD', label: 'Charity Steward', abbreviation: 'CS' },
  { value: 'INNER_GUARD', label: 'Inner Guard', abbreviation: 'IG' },
  { value: 'TYLER', label: 'Tyler', abbreviation: 'Tyler' },
  { value: 'ORGANIST', label: 'Organist', abbreviation: 'Org' },
  { value: 'STEWARD', label: 'Steward', abbreviation: 'Stwd' },
  { value: 'MENTOR', label: 'Mentor', abbreviation: 'Mentor' },
] as const;

// ─── Meeting Types ──────────────────────────────────────

export const MEETING_TYPES = [
  { value: 'REGULAR', label: 'Regular Meeting' },
  { value: 'EMERGENCY', label: 'Emergency Meeting' },
  { value: 'INSTALLATION', label: 'Installation Meeting' },
  { value: 'REHEARSAL', label: 'Rehearsal' },
  { value: 'LODGE_OF_INSTRUCTION', label: 'Lodge of Instruction' },
  { value: 'COMMITTEE', label: 'Committee Meeting' },
  { value: 'SOCIAL', label: 'Social Event' },
] as const;

// ─── Member Statuses ────────────────────────────────────

export const MEMBER_STATUSES = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'EXCLUDED', label: 'Excluded' },
  { value: 'RESIGNED', label: 'Resigned' },
  { value: 'DECEASED', label: 'Deceased' },
  { value: 'HONORARY', label: 'Honorary' },
  { value: 'COUNTRY_MEMBER', label: 'Country Member' },
] as const;

// ─── Payment Types ──────────────────────────────────────

export const PAYMENT_TYPES = [
  { value: 'DUES', label: 'Dues' },
  { value: 'DINING', label: 'Dining' },
  { value: 'DONATION', label: 'Donation' },
  { value: 'EVENT', label: 'Event' },
  { value: 'MERCHANDISE', label: 'Merchandise' },
  { value: 'OTHER', label: 'Other' },
] as const;

// ─── Payment Statuses ───────────────────────────────────

export const PAYMENT_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUCCEEDED', label: 'Succeeded' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially Refunded' },
] as const;

// ─── Dues Statuses ──────────────────────────────────────

export const DUES_STATUSES = [
  { value: 'CURRENT', label: 'Current' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'ARREARS', label: 'In Arrears' },
  { value: 'WAIVED', label: 'Waived' },
  { value: 'HONORARY_EXEMPT', label: 'Honorary Exempt' },
] as const;

// ─── Roles ──────────────────────────────────────────────

export const ROLES = [
  { value: 'PROVINCE_ADMIN', label: 'Province Admin', description: 'Full access to all lodges in province' },
  { value: 'WORSHIPFUL_MASTER', label: 'Worshipful Master', description: 'Lodge leader with full lodge access' },
  { value: 'SECRETARY', label: 'Secretary', description: 'Power user for lodge administration' },
  { value: 'TREASURER', label: 'Treasurer', description: 'Financial management and reporting' },
  { value: 'DIRECTOR_OF_CEREMONIES', label: 'Director of Ceremonies', description: 'Ritual planning and ceremony management' },
  { value: 'ALMONER', label: 'Almoner', description: 'Member welfare and confidential cases' },
  { value: 'MENTOR', label: 'Mentor', description: 'Candidate mentoring and progression' },
  { value: 'MEMBER', label: 'Member', description: 'View calendar, RSVP, own profile, dues status' },
] as const;

// ─── Masonic Ranks ──────────────────────────────────────

export const MASONIC_RANKS: Record<string, string> = {
  Bro: 'Brother',
  WBro: 'Worshipful Brother',
  VWBro: 'Very Worshipful Brother',
  RWBro: 'Right Worshipful Brother',
  MWBro: 'Most Worshipful Brother',
} as const;
