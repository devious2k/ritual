import { z } from 'zod';

// ─── Auth ───────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

// ─── Members ────────────────────────────────────────────

export const memberSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  occupation: z.string().optional(),
  degree: z.enum(['ENTERED_APPRENTICE', 'FELLOW_CRAFT', 'MASTER_MASON']),
  status: z.enum([
    'ACTIVE',
    'SUSPENDED',
    'EXCLUDED',
    'RESIGNED',
    'DECEASED',
    'HONORARY',
    'COUNTRY_MEMBER',
  ]),
  dateInitiated: z.string().optional(),
  datePassed: z.string().optional(),
  dateRaised: z.string().optional(),
  dateJoined: z.string().optional(),
  previousLodge: z.string().optional(),
  previousLodgeNumber: z.string().optional(),
  proposerId: z.string().optional(),
  seconderId: z.string().optional(),
});

// ─── Meetings ───────────────────────────────────────────

export const meetingSchema = z.object({
  type: z.enum([
    'REGULAR',
    'EMERGENCY',
    'INSTALLATION',
    'REHEARSAL',
    'LODGE_OF_INSTRUCTION',
    'COMMITTEE',
    'SOCIAL',
  ]),
  date: z.string(),
  startTime: z.string().optional(),
  venue: z.string().optional(),
  diningTime: z.string().optional(),
  diningCost: z.number().min(0).optional(),
  diningMenu: z.array(z.unknown()).optional(),
  agendaItems: z.array(z.unknown()).optional(),
  ceremonyType: z.string().optional(),
  candidateName: z.string().optional(),
});

// ─── Candidates ─────────────────────────────────────────

export const candidateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().optional(),
  occupation: z.string().optional(),
  status: z.enum([
    'ENQUIRY',
    'INTERVIEW',
    'PROPOSED',
    'BALLOT_PENDING',
    'BALLOT_APPROVED',
    'BALLOT_REJECTED',
    'INITIATED',
    'WITHDRAWN',
  ]),
  proposerId: z.string().optional(),
  seconderId: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Payments ───────────────────────────────────────────

export const paymentSchema = z.object({
  type: z.enum(['DUES', 'DINING', 'DONATION', 'EVENT', 'MERCHANDISE', 'OTHER']),
  amount: z.number().positive(),
  currency: z.string().default('gbp'),
  description: z.string().optional(),
  memberId: z.string().optional(),
});

// ─── Dues Records ───────────────────────────────────────

export const duesRecordSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  amount: z.number().positive(),
  grandLodgePortion: z.number().min(0).optional(),
  provincialPortion: z.number().min(0).optional(),
  lodgePortion: z.number().min(0).optional(),
  status: z.enum(['CURRENT', 'OVERDUE', 'ARREARS', 'WAIVED', 'HONORARY_EXEMPT']),
  dueDate: z.string().optional(),
  memberId: z.string(),
  instalmentPlan: z.boolean().default(false),
  notes: z.string().optional(),
});

// ─── Correspondence ─────────────────────────────────────

export const correspondenceSchema = z.object({
  type: z.enum(['INCOMING', 'OUTGOING', 'PROVINCIAL', 'GRAND_LODGE', 'INTER_LODGE']),
  from: z.string().min(1),
  to: z.string().min(1),
  subject: z.string().min(1).max(500),
  body: z.string().optional(),
  date: z.string().optional(),
});

// ─── Pagination ─────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// ─── Inferred Types ─────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type MemberInput = z.infer<typeof memberSchema>;
export type MeetingInput = z.infer<typeof meetingSchema>;
export type CandidateInput = z.infer<typeof candidateSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type DuesRecordInput = z.infer<typeof duesRecordSchema>;
export type CorrespondenceInput = z.infer<typeof correspondenceSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
