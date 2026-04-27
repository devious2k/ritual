/**
 * Maps the local-part of a role-addressed lodge email (e.g. `secretary` in
 * `secretary@vulcan.freemasons.app`) to the Office it represents. The Office
 * value is then used to look up whichever Member currently holds that office
 * in the lodge.
 *
 * Aliases that point at the same Office are intentional — masters can be
 * reached as `master@`, `wm@`, or `worshipfulmaster@`, etc.
 *
 * Stays in shared so the API (Node) and the Cloudflare Email Worker (Workers
 * runtime) both consume the same canonical mapping.
 */
export type OfficeKey =
  | 'WORSHIPFUL_MASTER'
  | 'IMMEDIATE_PAST_MASTER'
  | 'SENIOR_WARDEN'
  | 'JUNIOR_WARDEN'
  | 'CHAPLAIN'
  | 'TREASURER'
  | 'SECRETARY'
  | 'DIRECTOR_OF_CEREMONIES'
  | 'ASSISTANT_DIRECTOR_OF_CEREMONIES'
  | 'SENIOR_DEACON'
  | 'JUNIOR_DEACON'
  | 'ASSISTANT_SECRETARY'
  | 'ALMONER'
  | 'CHARITY_STEWARD'
  | 'INNER_GUARD'
  | 'TYLER'
  | 'ORGANIST'
  | 'STEWARD'
  | 'MENTOR';

export const OFFICE_ADDRESS_MAP: Record<string, OfficeKey> = {
  // Worshipful Master
  'wm': 'WORSHIPFUL_MASTER',
  'master': 'WORSHIPFUL_MASTER',
  'worshipfulmaster': 'WORSHIPFUL_MASTER',
  'worshipful-master': 'WORSHIPFUL_MASTER',
  // IPM
  'ipm': 'IMMEDIATE_PAST_MASTER',
  'pastmaster': 'IMMEDIATE_PAST_MASTER',
  // Wardens
  'sw': 'SENIOR_WARDEN',
  'seniorwarden': 'SENIOR_WARDEN',
  'jw': 'JUNIOR_WARDEN',
  'juniorwarden': 'JUNIOR_WARDEN',
  // Chaplain
  'chaplain': 'CHAPLAIN',
  // Treasurer
  'treasurer': 'TREASURER',
  // Secretary
  'secretary': 'SECRETARY',
  'sec': 'SECRETARY',
  // Asst Sec
  'assistantsecretary': 'ASSISTANT_SECRETARY',
  'asec': 'ASSISTANT_SECRETARY',
  // DC
  'dc': 'DIRECTOR_OF_CEREMONIES',
  'directorofceremonies': 'DIRECTOR_OF_CEREMONIES',
  'adc': 'ASSISTANT_DIRECTOR_OF_CEREMONIES',
  // Deacons
  'sd': 'SENIOR_DEACON',
  'jd': 'JUNIOR_DEACON',
  // Almoner
  'almoner': 'ALMONER',
  // Charity Steward
  'charitysteward': 'CHARITY_STEWARD',
  'charity': 'CHARITY_STEWARD',
  // IG / Tyler / Organist
  'ig': 'INNER_GUARD',
  'innerguard': 'INNER_GUARD',
  'tyler': 'TYLER',
  'organist': 'ORGANIST',
  // Steward
  'steward': 'STEWARD',
  // Mentor
  'mentor': 'MENTOR',
};

/** Reverse lookup: given an Office, return its canonical (first/preferred) local-part. */
export const CANONICAL_LOCAL_PART: Record<OfficeKey, string> = {
  WORSHIPFUL_MASTER: 'wm',
  IMMEDIATE_PAST_MASTER: 'ipm',
  SENIOR_WARDEN: 'sw',
  JUNIOR_WARDEN: 'jw',
  CHAPLAIN: 'chaplain',
  TREASURER: 'treasurer',
  SECRETARY: 'secretary',
  DIRECTOR_OF_CEREMONIES: 'dc',
  ASSISTANT_DIRECTOR_OF_CEREMONIES: 'adc',
  SENIOR_DEACON: 'sd',
  JUNIOR_DEACON: 'jd',
  ASSISTANT_SECRETARY: 'asec',
  ALMONER: 'almoner',
  CHARITY_STEWARD: 'charitysteward',
  INNER_GUARD: 'ig',
  TYLER: 'tyler',
  ORGANIST: 'organist',
  STEWARD: 'steward',
  MENTOR: 'mentor',
};

export function resolveOfficeFromLocalPart(localPart: string): OfficeKey | null {
  const normalised = localPart.toLowerCase().replace(/[._]/g, '-');
  return (
    OFFICE_ADDRESS_MAP[normalised] ||
    OFFICE_ADDRESS_MAP[normalised.replace(/-/g, '')] ||
    null
  );
}

export const OFFICE_LABELS: Record<OfficeKey, string> = {
  WORSHIPFUL_MASTER: 'Worshipful Master',
  IMMEDIATE_PAST_MASTER: 'Immediate Past Master',
  SENIOR_WARDEN: 'Senior Warden',
  JUNIOR_WARDEN: 'Junior Warden',
  CHAPLAIN: 'Chaplain',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  DIRECTOR_OF_CEREMONIES: 'Director of Ceremonies',
  ASSISTANT_DIRECTOR_OF_CEREMONIES: 'Assistant DC',
  SENIOR_DEACON: 'Senior Deacon',
  JUNIOR_DEACON: 'Junior Deacon',
  ASSISTANT_SECRETARY: 'Assistant Secretary',
  ALMONER: 'Almoner',
  CHARITY_STEWARD: 'Charity Steward',
  INNER_GUARD: 'Inner Guard',
  TYLER: 'Tyler',
  ORGANIST: 'Organist',
  STEWARD: 'Steward',
  MENTOR: 'Mentor',
};
