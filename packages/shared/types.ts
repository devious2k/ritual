// ─── Enums (standalone, not imported from Prisma) ───────

export type Role =
  | 'PROVINCE_ADMIN'
  | 'WORSHIPFUL_MASTER'
  | 'SECRETARY'
  | 'TREASURER'
  | 'DIRECTOR_OF_CEREMONIES'
  | 'ALMONER'
  | 'MENTOR'
  | 'MEMBER';

export type Degree =
  | 'ENTERED_APPRENTICE'
  | 'FELLOW_CRAFT'
  | 'MASTER_MASON';

export type MemberStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'EXCLUDED'
  | 'RESIGNED'
  | 'DECEASED'
  | 'HONORARY'
  | 'COUNTRY_MEMBER';

export type MeetingType =
  | 'REGULAR'
  | 'EMERGENCY'
  | 'INSTALLATION'
  | 'REHEARSAL'
  | 'LODGE_OF_INSTRUCTION'
  | 'COMMITTEE'
  | 'SOCIAL';

export type CandidateStatus =
  | 'ENQUIRY'
  | 'INTERVIEW'
  | 'PROPOSED'
  | 'BALLOT_PENDING'
  | 'BALLOT_APPROVED'
  | 'BALLOT_REJECTED'
  | 'INITIATED'
  | 'WITHDRAWN';

export type Office =
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

export type PaymentType =
  | 'DUES'
  | 'DINING'
  | 'DONATION'
  | 'EVENT'
  | 'MERCHANDISE'
  | 'OTHER';

export type PaymentStatus =
  | 'PENDING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type DuesStatus =
  | 'CURRENT'
  | 'OVERDUE'
  | 'ARREARS'
  | 'WAIVED'
  | 'HONORARY_EXEMPT';

export type AccountType =
  | 'GENERAL'
  | 'BENEVOLENT'
  | 'SOCIAL'
  | 'CHARITY'
  | 'BUILDING';

export type TransactionType =
  | 'INCOME'
  | 'EXPENSE'
  | 'TRANSFER';

export type CorrespondenceType =
  | 'INCOMING'
  | 'OUTGOING'
  | 'PROVINCIAL'
  | 'GRAND_LODGE'
  | 'INTER_LODGE';

export type HonourLevel =
  | 'PROVINCIAL'
  | 'GRAND';

export type AttendanceStatus =
  | 'PRESENT'
  | 'APOLOGY'
  | 'ABSENT'
  | 'VISITOR';

export type AlmonerCaseStatus =
  | 'OPEN'
  | 'MONITORING'
  | 'CLOSED'
  | 'REFERRED';

// ─── API Response Interfaces ────────────────────────────

export interface ProvinceResponse {
  id: string;
  name: string;
  number: string | null;
  district: string | null;
  settings: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface LodgeResponse {
  id: string;
  name: string;
  number: string;
  consecrationDate: string | null;
  meetingDay: string | null;
  meetingMonths: string | null;
  venue: string | null;
  venueAddress: string | null;
  tylerPhone: string | null;
  diningCost: number | null;
  annualDues: number | null;
  grandLodgeDues: number | null;
  provincialDues: number | null;
  bylawsUrl: string | null;
  crestUrl: string | null;
  settings: Record<string, unknown> | null;
  stripeAccountId: string | null;
  stripeOnboardingComplete: boolean;
  xeroTenantId: string | null;
  xeroLastSyncAt: string | null;
  provinceId: string;
  province?: ProvinceResponse;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  memberId: string | null;
  member?: MemberResponse;
  provinceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  occupation: string | null;
  photoUrl: string | null;
  degree: Degree;
  status: MemberStatus;
  dateInitiated: string | null;
  datePassed: string | null;
  dateRaised: string | null;
  dateJoined: string | null;
  dateResigned: string | null;
  dateExcluded: string | null;
  previousLodge: string | null;
  previousLodgeNumber: string | null;
  proposerId: string | null;
  seconderId: string | null;
  stripeCustomerId: string | null;
  lodgeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficerResponse {
  id: string;
  office: Office;
  year: number;
  installedDate: string | null;
  investedDate: string | null;
  isActive: boolean;
  memberId: string;
  member?: MemberResponse;
  lodgeId: string;
  createdAt: string;
}

export interface MeetingResponse {
  id: string;
  type: MeetingType;
  date: string;
  startTime: string | null;
  venue: string | null;
  diningTime: string | null;
  diningCost: number | null;
  diningMenu: unknown[] | null;
  agendaItems: unknown[] | null;
  minutesContent: string | null;
  minutesApproved: boolean;
  minutesApprovedDate: string | null;
  minutesDocFlowId: string | null;
  ceremonyType: string | null;
  candidateName: string | null;
  lodgeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceResponse {
  id: string;
  status: AttendanceStatus;
  diningChoice: string | null;
  guestCount: number;
  guestNames: string | null;
  apologyReason: string | null;
  respondedAt: string | null;
  memberId: string;
  member?: MemberResponse;
  meetingId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  dateOfBirth: string | null;
  occupation: string | null;
  status: CandidateStatus;
  proposerId: string | null;
  seconderId: string | null;
  proposalFormDate: string | null;
  committeeDate: string | null;
  ballotDate: string | null;
  initiationDate: string | null;
  memberId: string | null;
  notes: string | null;
  lodgeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentResponse {
  id: string;
  type: PaymentType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  description: string | null;
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId: string | null;
  stripeInvoiceId: string | null;
  stripeRefundId: string | null;
  memberId: string | null;
  member?: MemberResponse;
  lodgeId: string;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DuesRecordResponse {
  id: string;
  year: number;
  amount: number;
  grandLodgePortion: number | null;
  provincialPortion: number | null;
  lodgePortion: number | null;
  status: DuesStatus;
  dueDate: string | null;
  paidDate: string | null;
  paidAmount: number | null;
  paymentMethod: string | null;
  stripeInvoiceId: string | null;
  instalmentPlan: boolean;
  notes: string | null;
  memberId: string;
  member?: MemberResponse;
  lodgeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiningFeeResponse {
  id: string;
  amount: number;
  guestAmount: number | null;
  guestCount: number;
  status: PaymentStatus;
  paidDate: string | null;
  paymentMethod: string | null;
  stripeCheckoutSessionId: string | null;
  memberId: string;
  member?: MemberResponse;
  meetingId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CharityDonationResponse {
  id: string;
  amount: number;
  fund: string;
  isFestival: boolean;
  festivalTarget: number | null;
  giftAid: boolean;
  giftAidDeclarationDate: string | null;
  date: string;
  paymentMethod: string | null;
  stripeCheckoutSessionId: string | null;
  notes: string | null;
  memberId: string | null;
  member?: MemberResponse;
  lodgeId: string;
  createdAt: string;
}

export interface SummonsResponse {
  id: string;
  content: Record<string, unknown> | null;
  pdfUrl: string | null;
  docFlowId: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  recipientCount: number | null;
  rsvpDeadline: string | null;
  meetingId: string;
  meeting?: MeetingResponse;
  lodgeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CorrespondenceResponse {
  id: string;
  type: CorrespondenceType;
  from: string;
  to: string;
  subject: string;
  body: string | null;
  date: string;
  docFlowId: string | null;
  isRead: boolean;
  lodgeId: string;
  createdAt: string;
}

export interface AlmonerCaseResponse {
  id: string;
  status: AlmonerCaseStatus;
  category: string | null;
  isConfidential: boolean;
  openedDate: string;
  closedDate: string | null;
  lastContactDate: string | null;
  nextActionDate: string | null;
  nextAction: string | null;
  memberId: string;
  member?: MemberResponse;
  createdAt: string;
  updatedAt: string;
  // Note: encryptedNotes intentionally omitted from API response
}

export interface LodgeEquipmentResponse {
  id: string;
  name: string;
  category: string;
  condition: string | null;
  location: string | null;
  lastCheckedDate: string | null;
  notes: string | null;
  photoUrl: string | null;
  lodgeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationResponse {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  emailSent: boolean;
  userId: string;
  lodgeId: string | null;
  createdAt: string;
}

export interface HonourResponse {
  id: string;
  rank: string;
  fullTitle: string;
  level: HonourLevel;
  dateConferred: string | null;
  dateGazetted: string | null;
  memberId: string;
  member?: MemberResponse;
  createdAt: string;
}

// ─── Auth Request/Response ──────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserResponse;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

// ─── Generic Pagination ─────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Dashboard ──────────────────────────────────────────

export interface DashboardStats {
  memberCount: number;
  activeMemberCount: number;
  upcomingMeetings: number;
  outstandingDues: number;
  attendanceRate: number;
  duesCollectionRate: number;
}
