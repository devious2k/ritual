# CLAUDE.md — LodgeKey

> Masonic lodge management platform. Sixth vertical in the MasterCopy Key Platform family.
> Domain: **freemasons.app**
> Developer: Jamie @ Game On Solutions Ltd, Ferryhill, County Durham
> Client: Game On Solutions (own product), potential white-label for MasterCopy

---

## Project identity

| Field | Value |
|---|---|
| Product name | LodgeKey |
| npm scope | `@lodgekey/*` |
| Domain | freemasons.app |
| API subdomain | api.freemasons.app |
| GitHub repo | TBC (private, Game On Solutions org) |
| License | Proprietary |

---

## Tech stack (Key Platform standard)

| Layer | Choice | Notes |
|---|---|---|
| API | Fastify 4 + TypeScript (NodeNext modules) | `tsx` for dev & prod — NO tsc build step |
| ORM | Prisma 5 | `db push` only, no migrations |
| DB | PostgreSQL 16 | Single database, multi-tenant via `lodgeId` scoping |
| Cache | Redis 7 | Sessions, rate limiting, job queues |
| Frontend | React 18 + Vite + Tailwind CSS | Single-page app |
| Charts | Recharts | Dashboard KPIs |
| State | Zustand (auth, persisted) + TanStack Query v5 (server) | |
| Auth | JWT — 8h access + 30d refresh tokens, bcrypt | Queue pattern for concurrent 401 refresh |
| Validation | Zod (API) + shared TypeScript interfaces | |
| AI | Groq (Llama 3.3 70B) for triage + Anthropic Claude (optional) | Aida secretary assistant |
| Documents | DocFlow Next integration (REST, separate system) | Minutes, summons, correspondence storage |
| Payments | Stripe Connect Standard + Checkout + Invoicing | Each lodge = connected account |
| Accounting | Xero Custom Connection (client_credentials, £5/month) | Dues, fees, donations sync |
| Email | Nodemailer — Mailhog (dev :8025) / SendGrid (prod) | |
| Monorepo | pnpm workspaces + Turborepo | |
| Hosting API | Railway | |
| Hosting Web | Vercel | |
| DNS/CDN | Cloudflare | freemasons.app |

---

## Monorepo structure

```
lodgekey/
├── apps/
│   ├── api/                          # Fastify 4 REST API
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── auth.ts           # Login, register, refresh, logout
│   │       │   ├── members.ts        # CRUD, search, filter, photo upload
│   │       │   ├── officers.ts       # Appointments, progressive line, history
│   │       │   ├── meetings.ts       # CRUD, agenda, minutes approval
│   │       │   ├── attendance.ts     # Register, apologies, visitors, dining choices
│   │       │   ├── candidates.ts     # Pipeline: enquiry → proposal → ballot → initiation
│   │       │   ├── degrees.ts        # Progression tracking, proficiency, mentoring
│   │       │   ├── ceremonies.ts     # Ritual planning, allocations, rehearsals
│   │       │   ├── summons.ts        # Generate, preview, send, RSVP tracking
│   │       │   ├── finance.ts        # Accounts, transactions, treasurer reports
│   │       │   ├── dues.ts           # Annual dues management, instalment plans
│   │       │   ├── dining.ts         # Per-meeting dining fees, guest management
│   │       │   ├── charity.ts        # Donations, festival giving, Gift Aid
│   │       │   ├── honours.ts        # Provincial/Grand rank tracking
│   │       │   ├── correspondence.ts # Lodge correspondence log
│   │       │   ├── almoner.ts        # Confidential welfare cases (encrypted)
│   │       │   ├── equipment.ts      # Lodge equipment inventory
│   │       │   ├── visitors.ts       # Visiting brethren register
│   │       │   ├── stripe.ts         # Checkout sessions, invoicing, connect onboarding
│   │       │   ├── stripeWebhook.ts  # Raw body webhook handler (NO auth middleware)
│   │       │   ├── xero.ts           # Xero OAuth, sync status, manual trigger
│   │       │   ├── ai.ts             # Aida chat, secretary assistant
│   │       │   ├── notifications.ts  # In-app + email notifications
│   │       │   ├── dashboard.ts      # KPI aggregation endpoints
│   │       │   ├── lodges.ts         # Lodge CRUD (province admin)
│   │       │   ├── provinces.ts      # Province management
│   │       │   └── users.ts          # User management, role assignment
│   │       ├── services/
│   │       │   ├── stripeService.ts   # Stripe SDK wrapper: accounts, sessions, invoices, refunds
│   │       │   ├── paymentSync.ts     # Stripe event → Transaction + DuesRecord + DiningFee
│   │       │   ├── xeroService.ts     # Direct REST (no xero-node SDK — deprecated Apr 2026)
│   │       │   ├── docflow.ts         # DocFlow Next REST client (typed)
│   │       │   ├── summonsGenerator.ts # PDF generation for summons documents
│   │       │   ├── emailService.ts    # Nodemailer wrapper, HTML templates
│   │       │   ├── aiService.ts       # Groq/Claude provider resolution, streaming SSE
│   │       │   ├── auditService.ts    # Audit log helper
│   │       │   └── encryptionService.ts # AES-256-CBC for almoner notes, ballot results
│   │       ├── jobs/
│   │       │   ├── duesInvoicing.ts   # Cron: generate annual Stripe invoices per lodge schedule
│   │       │   ├── paymentReminders.ts # Cron: email reminders for unpaid dues/dining
│   │       │   ├── xeroSync.ts        # Cron: every 15 min Mon-Fri sync to Xero
│   │       │   ├── attendanceFlags.ts # Cron: weekly flag low-attendance members for Almoner
│   │       │   └── summonsDistribution.ts # Cron: send summons emails at scheduled time
│   │       ├── middleware/
│   │       │   ├── auth.ts            # JWT verification, role extraction
│   │       │   ├── lodgeScope.ts      # Enforce lodgeId on all queries (bypass for PROVINCE_ADMIN)
│   │       │   ├── roleGuard.ts       # Role-based route protection
│   │       │   └── errorHandler.ts    # Centralised error handling
│   │       └── index.ts               # Entry point, plugin registration
│   └── web/                           # React 18 SPA
│       └── src/
│           ├── pages/
│           │   ├── Dashboard.tsx       # KPI cards, upcoming meetings, action items
│           │   ├── Members.tsx         # Directory with search, filter, degree badges
│           │   ├── MemberProfile.tsx   # Individual member view with history
│           │   ├── Meetings.tsx        # Calendar view + list view
│           │   ├── MeetingDetail.tsx   # Agenda, attendance register, minutes
│           │   ├── Summons.tsx         # Generate, preview, send workflow
│           │   ├── Candidates.tsx      # Pipeline board (kanban-style)
│           │   ├── Degrees.tsx         # Progression tracker
│           │   ├── Ceremonies.tsx      # Ritual planning with role allocation
│           │   ├── Officers.tsx        # Current officers + progressive line
│           │   ├── Finance.tsx         # Account overview, transactions
│           │   ├── Dues.tsx            # Dues status grid, payment links
│           │   ├── Dining.tsx          # Per-meeting dining management
│           │   ├── Charity.tsx         # Donations, festival progress
│           │   ├── Almoner.tsx         # Confidential welfare dashboard
│           │   ├── Visitors.tsx        # Visiting brethren register
│           │   ├── Correspondence.tsx  # Lodge correspondence log
│           │   ├── Equipment.tsx       # Lodge equipment inventory
│           │   ├── Honours.tsx         # Provincial/Grand rank register
│           │   ├── Settings.tsx        # Lodge settings, Stripe connect, Xero, AI keys
│           │   ├── StripeOnboarding.tsx # Connect onboarding flow
│           │   ├── PaymentSuccess.tsx  # Post-checkout redirect
│           │   ├── Login.tsx
│           │   ├── ForgotPassword.tsx
│           │   └── NotFound.tsx
│           ├── components/
│           │   ├── layout/            # Sidebar, header, breadcrumbs
│           │   ├── members/           # MemberCard, MemberForm, DegreeProgressBar
│           │   ├── meetings/          # MeetingCard, AgendaBuilder, AttendanceGrid
│           │   ├── finance/           # TransactionTable, DuesStatusBadge, AccountCard
│           │   ├── ceremonies/        # RoleAllocationBoard, RehearsalSchedule
│           │   ├── summons/           # SummonsPreview, RSVPTracker
│           │   ├── charts/            # AttendanceChart, DuesCollectionChart, MembershipTrend
│           │   ├── ai/                # AidaChat sidebar panel
│           │   └── shared/            # Button, Modal, Badge, DataTable, StatusPill, EmptyState
│           ├── lib/
│           │   ├── api.ts             # Axios instance with JWT refresh queue
│           │   ├── utils.ts           # Date formatting, currency, degree labels
│           │   └── constants.ts       # Masonic degrees, offices, meeting types
│           └── stores/
│               ├── authStore.ts       # Zustand: user, tokens, login/logout
│               └── uiStore.ts         # Sidebar state, theme
├── packages/
│   ├── database/
│   │   ├── prisma/schema.prisma       # Full schema (see below)
│   │   └── seed.ts                    # Demo lodge with realistic Masonic data
│   └── shared/
│       ├── types.ts                   # Shared TypeScript interfaces
│       ├── constants.ts               # Degrees, offices, meeting types, payment types
│       └── validation.ts              # Zod schemas shared between API and web
├── docker-compose.yml                 # PostgreSQL (5433), Redis, pgAdmin, Mailhog
├── turbo.json
├── pnpm-workspace.yaml
├── .env.example
├── CLAUDE.md                          # This file
└── README.md
```

---

## Multi-tenancy hierarchy

```
Province (= Key Platform "Group")
  └── Lodge (= Key Platform "Property")
       ├── Members
       ├── Officers (per year)
       ├── Meetings
       ├── Accounts
       └── ... all domain data scoped to lodgeId
```

- Every query MUST be scoped by `lodgeId` (enforced via `lodgeScope` middleware)
- `PROVINCE_ADMIN` bypasses lodge scoping (can see all lodges in province)
- `WORSHIPFUL_MASTER` and `SECRETARY` have full access within their lodge
- Users can belong to multiple lodges via `UserLodgeAccess` junction table

---

## Role hierarchy

| Role | Scope | Capabilities |
|---|---|---|
| `PROVINCE_ADMIN` | All lodges in province | Everything. Bypasses lodge checks. Provincial reports, aggregate stats. |
| `WORSHIPFUL_MASTER` | Assigned lodge(s) | Approve minutes, ballot results, ceremony sign-off, full lodge view |
| `SECRETARY` | Assigned lodge(s) | **Power user.** Members, summons, minutes, correspondence, returns, full CRUD |
| `TREASURER` | Assigned lodge(s) | Financial management, dues, dining fees, charity, Xero sync, Stripe dashboard |
| `DIRECTOR_OF_CEREMONIES` | Assigned lodge(s) | Ritual planning, ceremony allocation, rehearsals, equipment |
| `ALMONER` | Assigned lodge(s) | Welfare cases (encrypted), attendance flags, member wellbeing, benevolence |
| `MENTOR` | Assigned lodge(s) | Candidate mentoring, progression tracking, proficiency records |
| `MEMBER` | Assigned lodge(s) | View calendar, RSVP, own profile, own dues status, lodge info, pay online |

Access control: `UserLodgeAccess` junction table grants users access to specific lodges. `PROVINCE_ADMIN` bypasses this check.

---

## Prisma schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── ENUMS ──────────────────────────────────────────────

enum Role {
  PROVINCE_ADMIN
  WORSHIPFUL_MASTER
  SECRETARY
  TREASURER
  DIRECTOR_OF_CEREMONIES
  ALMONER
  MENTOR
  MEMBER
}

enum Degree {
  ENTERED_APPRENTICE    // First degree
  FELLOW_CRAFT          // Second degree
  MASTER_MASON          // Third degree
}

enum MemberStatus {
  ACTIVE
  SUSPENDED
  EXCLUDED
  RESIGNED
  DECEASED
  HONORARY
  COUNTRY_MEMBER        // Lives >15 miles from lodge
}

enum MeetingType {
  REGULAR               // Ordinary stated meeting
  EMERGENCY             // Called by WM for specific business
  INSTALLATION          // Annual installation of officers
  REHEARSAL             // Practice meeting
  LODGE_OF_INSTRUCTION  // Educational/practice
  COMMITTEE             // General purposes committee
  SOCIAL                // Ladies festival, social event
}

enum CandidateStatus {
  ENQUIRY               // Initial interest
  INTERVIEW             // Met with members
  PROPOSED              // Form signed, proposer + seconder
  BALLOT_PENDING        // On agenda for ballot
  BALLOT_APPROVED       // Approved by ballot
  BALLOT_REJECTED       // Rejected (confidential)
  INITIATED             // EA degree conferred
  WITHDRAWN             // Candidate withdrew
}

enum Office {
  WORSHIPFUL_MASTER
  IMMEDIATE_PAST_MASTER
  SENIOR_WARDEN
  JUNIOR_WARDEN
  CHAPLAIN
  TREASURER
  SECRETARY
  DIRECTOR_OF_CEREMONIES
  ASSISTANT_DIRECTOR_OF_CEREMONIES
  SENIOR_DEACON
  JUNIOR_DEACON
  ASSISTANT_SECRETARY
  ALMONER
  CHARITY_STEWARD
  INNER_GUARD
  TYLER
  ORGANIST
  STEWARD
  MENTOR
}

enum PaymentType {
  DUES
  DINING
  DONATION
  EVENT
  MERCHANDISE
  OTHER
}

enum PaymentStatus {
  PENDING
  SUCCEEDED
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum DuesStatus {
  CURRENT
  OVERDUE
  ARREARS
  WAIVED
  HONORARY_EXEMPT
}

enum AccountType {
  GENERAL             // Main lodge account
  BENEVOLENT           // Benevolent fund
  SOCIAL               // Social/ladies festival fund
  CHARITY              // Charity account
  BUILDING             // Building/premises fund
}

enum TransactionType {
  INCOME
  EXPENSE
  TRANSFER
}

enum CorrespondenceType {
  INCOMING
  OUTGOING
  PROVINCIAL
  GRAND_LODGE
  INTER_LODGE
}

enum HonourLevel {
  PROVINCIAL            // Provincial Grand rank
  GRAND                 // United Grand Lodge rank
}

enum AttendanceStatus {
  PRESENT
  APOLOGY
  ABSENT
  VISITOR
}

enum AlmonerCaseStatus {
  OPEN
  MONITORING
  CLOSED
  REFERRED
}

// ─── CORE MODELS ────────────────────────────────────────

model Province {
  id                    String    @id @default(cuid())
  name                  String    // e.g. "Yorkshire North and East Ridings"
  number                String?   // Province number if applicable
  district              String?   // Metropolitan or Provincial
  settings              Json?     // Province-level settings (AI keys, etc.)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  lodges                Lodge[]
  users                 User[]    // Province-level admins
}

model Lodge {
  id                    String    @id @default(cuid())
  name                  String    // e.g. "Vulcan Lodge"
  number                String    // e.g. "4510"
  consecrationDate      DateTime? // Date lodge was consecrated
  meetingDay             String?   // e.g. "Third Thursday"
  meetingMonths          String?   // e.g. "Sep,Oct,Nov,Jan,Feb,Mar,Apr"
  venue                 String?   // Meeting place name
  venueAddress           String?   // Full address
  tylerPhone             String?   // Tyler contact for visitors
  diningCost             Float?    // Default dining fee in pounds
  annualDues             Float?    // Annual subscription amount
  grandLodgeDues         Float?    // GL portion of dues
  provincialDues         Float?    // Provincial portion of dues
  bylawsUrl              String?   // Link to lodge bylaws document
  crestUrl               String?   // Lodge crest/badge image URL
  settings               Json?     // Lodge-level settings (AI keys, DocFlow site ID, etc.)

  // Stripe Connect
  stripeAccountId        String?   // Stripe connected account ID
  stripeOnboardingComplete Boolean @default(false)

  // Xero
  xeroTenantId           String?   // Xero organisation tenant ID
  xeroLastSyncAt         DateTime?

  provinceId             String
  province               Province  @relation(fields: [provinceId], references: [id])

  createdAt              DateTime  @default(now())
  updatedAt              DateTime  @updatedAt

  members                Member[]
  officers               Officer[]
  meetings               Meeting[]
  candidates             Candidate[]
  accounts               Account[]
  payments               Payment[]
  duesRecords            DuesRecord[]
  equipment              LodgeEquipment[]
  correspondence         Correspondence[]
  userAccess             UserLodgeAccess[]
  summonses              Summons[]
  charityDonations       CharityDonation[]
  notifications          Notification[]
  auditLogs              AuditLog[]

  @@unique([number, provinceId])
}

model User {
  id                    String    @id @default(cuid())
  email                 String    @unique
  password              String    // bcrypt hashed
  role                  Role      @default(MEMBER)
  isActive              Boolean   @default(true)
  lastLoginAt           DateTime?

  // Link to member record (a user IS a member in the lodge context)
  memberId              String?   @unique
  member                Member?   @relation(fields: [memberId], references: [id])

  // Province-level admin (optional — most users belong to a lodge via UserLodgeAccess)
  provinceId            String?
  province              Province? @relation(fields: [provinceId], references: [id])

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  lodgeAccess           UserLodgeAccess[]
  refreshTokens         RefreshToken[]
  notifications         Notification[]
  auditLogs             AuditLog[]
}

model UserLodgeAccess {
  id                    String    @id @default(cuid())
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lodgeId               String
  lodge                 Lodge     @relation(fields: [lodgeId], references: [id], onDelete: Cascade)
  role                  Role      @default(MEMBER)  // Role within THIS lodge
  createdAt             DateTime  @default(now())

  @@unique([userId, lodgeId])
}

model RefreshToken {
  id                    String    @id @default(cuid())
  token                 String    @unique
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt             DateTime
  createdAt             DateTime  @default(now())
}

// ─── MEMBERS & OFFICERS ─────────────────────────────────

model Member {
  id                    String       @id @default(cuid())
  firstName             String
  lastName              String
  email                 String?
  phone                 String?
  address               String?
  dateOfBirth           DateTime?
  occupation            String?
  photoUrl              String?

  // Masonic details
  degree                Degree       @default(ENTERED_APPRENTICE)
  status                MemberStatus @default(ACTIVE)
  dateInitiated         DateTime?    // EA ceremony date
  datePassed            DateTime?    // FC ceremony date
  dateRaised            DateTime?    // MM ceremony date
  dateJoined            DateTime?    // Joining date (may differ from initiation for joining members)
  dateResigned          DateTime?
  dateExcluded          DateTime?
  previousLodge         String?      // For joining members
  previousLodgeNumber   String?

  // Proposer and seconder
  proposerId            String?
  proposer              Member?      @relation("ProposerSeconder", fields: [proposerId], references: [id])
  seconderId            String?
  seconder              Member?      @relation("SeconderRelation", fields: [seconderId], references: [id])
  proposed              Member[]     @relation("ProposerSeconder")
  seconded              Member[]     @relation("SeconderRelation")

  // Stripe
  stripeCustomerId      String?      // Created on first payment

  lodgeId               String
  lodge                 Lodge        @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime     @default(now())
  updatedAt             DateTime     @updatedAt

  user                  User?
  officers              Officer[]
  attendance            Attendance[]
  degreeProgressions    DegreeProgression[]
  duesRecords           DuesRecord[]
  diningFees            DiningFee[]
  charityDonations      CharityDonation[]
  honours               Honour[]
  payments              Payment[]
  almonerCases          AlmonerCase[]
  mentorAssignments     MentorAssignment[] @relation("MentorRelation")
  menteeAssignments     MentorAssignment[] @relation("MenteeRelation")
  ceremonyRoles         CeremonyRole[]

  @@index([lodgeId])
  @@index([status])
  @@index([degree])
}

model Officer {
  id                    String    @id @default(cuid())
  office                Office
  year                  Int       // Masonic year (e.g. 2024 = 2024-2025 season)
  installedDate         DateTime?
  investedDate          DateTime? // For non-installed officers
  isActive              Boolean   @default(true)

  memberId              String
  member                Member    @relation(fields: [memberId], references: [id])
  lodgeId               String
  lodge                 Lodge     @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime  @default(now())

  @@unique([lodgeId, office, year])
  @@index([lodgeId, year])
}

model Honour {
  id                    String      @id @default(cuid())
  rank                  String      // e.g. "PPrGW", "PAGDC"
  fullTitle             String      // e.g. "Past Provincial Grand Warden"
  level                 HonourLevel
  dateConferred         DateTime?
  dateGazetted          DateTime?   // Date announced

  memberId              String
  member                Member      @relation(fields: [memberId], references: [id])

  createdAt             DateTime    @default(now())
}

// ─── MEETINGS & ATTENDANCE ──────────────────────────────

model Meeting {
  id                    String      @id @default(cuid())
  type                  MeetingType
  date                  DateTime
  startTime             String?     // e.g. "18:30"
  venue                 String?     // Override lodge default
  diningTime            String?     // e.g. "20:00"
  diningCost            Float?      // Override lodge default for this meeting
  diningMenu            Json?       // Menu options array
  agendaItems           Json?       // Structured agenda
  minutesContent        String?     // Rich text / markdown
  minutesApproved       Boolean     @default(false)
  minutesApprovedDate   DateTime?
  minutesDocFlowId      String?     // DocFlow document ID for stored minutes

  // Ceremony details (if degree work)
  ceremonyType          String?     // e.g. "First Degree", "Installation"
  candidateName         String?     // For degree ceremonies

  lodgeId               String
  lodge                 Lodge       @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  attendance            Attendance[]
  visitors              Visitor[]
  diningFees            DiningFee[]
  summons               Summons?
  ceremonyPlan          CeremonyPlan?

  @@index([lodgeId, date])
}

model Attendance {
  id                    String           @id @default(cuid())
  status                AttendanceStatus
  diningChoice          String?          // Selected menu option
  guestCount            Int              @default(0)
  guestNames            String?          // Comma-separated guest names
  apologyReason         String?
  respondedAt           DateTime?        // When member RSVP'd

  memberId              String
  member                Member           @relation(fields: [memberId], references: [id])
  meetingId             String
  meeting               Meeting          @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@unique([memberId, meetingId])
}

model Visitor {
  id                    String    @id @default(cuid())
  firstName             String
  lastName              String
  rank                  String?   // e.g. "WBro", "Bro"
  degree                Degree    @default(MASTER_MASON)
  lodgeName             String    // Visitor's mother lodge
  lodgeNumber           String?
  provinceName          String?
  dining                Boolean   @default(false)
  diningChoice          String?
  guestOf               String?   // Name of host member

  meetingId             String
  meeting               Meeting   @relation(fields: [meetingId], references: [id], onDelete: Cascade)

  createdAt             DateTime  @default(now())

  @@index([meetingId])
}

// ─── CANDIDATES & DEGREES ───────────────────────────────

model Candidate {
  id                    String          @id @default(cuid())
  firstName             String
  lastName              String
  email                 String?
  phone                 String?
  address               String?
  dateOfBirth           DateTime?
  occupation            String?
  status                CandidateStatus @default(ENQUIRY)

  // Proposal details
  proposerId            String?         // Member ID of proposer
  seconderId            String?         // Member ID of seconder
  proposalFormDate      DateTime?       // When Form A signed
  committeeDate         DateTime?       // General purposes committee review
  ballotDate            DateTime?       // Meeting at which ballot held
  ballotResult          String?         // Encrypted: "APPROVED" or "REJECTED"
  initiationDate        DateTime?       // Date initiated (becomes Member)

  // Resulting member record
  memberId              String?         // Link to Member once initiated

  notes                 String?         // Private notes on candidate

  lodgeId               String
  lodge                 Lodge           @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  @@index([lodgeId, status])
}

model DegreeProgression {
  id                    String    @id @default(cuid())
  degree                Degree
  ceremonyDate          DateTime
  conductedBy           String?   // Who performed the ceremony (WM or PM name)
  lodgeOfCeremony       String?   // If not in own lodge
  proficiencyPassed     Boolean   @default(false)
  proficiencyDate       DateTime?
  notes                 String?

  memberId              String
  member                Member    @relation(fields: [memberId], references: [id])

  createdAt             DateTime  @default(now())

  @@unique([memberId, degree])
}

model MentorAssignment {
  id                    String    @id @default(cuid())
  mentorId              String
  mentor                Member    @relation("MentorRelation", fields: [mentorId], references: [id])
  menteeId              String
  mentee                Member    @relation("MenteeRelation", fields: [menteeId], references: [id])
  assignedDate          DateTime  @default(now())
  completedDate         DateTime?
  isActive              Boolean   @default(true)
  notes                 String?

  @@unique([mentorId, menteeId])
}

// ─── CEREMONIES & RITUAL ────────────────────────────────

model CeremonyPlan {
  id                    String    @id @default(cuid())
  ceremonyType          String    // e.g. "First Degree", "Installation", "Third Degree"
  allocations           Json      // { "WM": memberId, "SW": memberId, "Charge": memberId, ... }
  equipmentChecklist    Json?     // Required lodge equipment for this ceremony
  notes                 String?
  isConfirmed           Boolean   @default(false)

  meetingId             String    @unique
  meeting               Meeting   @relation(fields: [meetingId], references: [id])

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  roles                 CeremonyRole[]
  rehearsals            Rehearsal[]
}

model CeremonyRole {
  id                    String       @id @default(cuid())
  role                  String       // e.g. "Worshipful Master", "Senior Deacon", "First Degree Charge"
  confirmed             Boolean      @default(false)

  memberId              String
  member                Member       @relation(fields: [memberId], references: [id])
  ceremonyPlanId        String
  ceremonyPlan          CeremonyPlan @relation(fields: [ceremonyPlanId], references: [id], onDelete: Cascade)

  @@unique([ceremonyPlanId, role])
}

model Rehearsal {
  id                    String       @id @default(cuid())
  date                  DateTime
  time                  String?
  venue                 String?
  notes                 String?
  attendees             Json?        // Array of member IDs who attended

  ceremonyPlanId        String
  ceremonyPlan          CeremonyPlan @relation(fields: [ceremonyPlanId], references: [id], onDelete: Cascade)

  createdAt             DateTime     @default(now())
}

// ─── FINANCE ────────────────────────────────────────────

model Account {
  id                    String        @id @default(cuid())
  name                  String        // e.g. "General Fund", "Benevolent Fund"
  type                  AccountType
  balance               Float         @default(0)
  xeroAccountCode       String?       // Mapped Xero account code

  lodgeId               String
  lodge                 Lodge         @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  transactions          Transaction[]

  @@unique([lodgeId, name])
}

model Transaction {
  id                    String          @id @default(cuid())
  type                  TransactionType
  amount                Float
  description           String
  date                  DateTime        @default(now())
  reference             String?         // Cheque number, transfer ref, etc.
  xeroInvoiceId         String?         // Linked Xero invoice ID
  category              String?         // e.g. "Dues", "Dining", "Charity", "Regalia"

  accountId             String
  account               Account         @relation(fields: [accountId], references: [id])
  memberId              String?         // Optional: which member this relates to
  paymentId             String?         // Link to Stripe Payment record

  createdAt             DateTime        @default(now())
}

model Payment {
  id                    String        @id @default(cuid())
  type                  PaymentType
  status                PaymentStatus @default(PENDING)
  amount                Float         // Amount in pounds
  currency              String        @default("gbp")
  description           String?

  // Stripe references
  stripePaymentIntentId String?       @unique
  stripeCheckoutSessionId String?
  stripeInvoiceId       String?
  stripeRefundId        String?

  // Relations
  memberId              String?
  member                Member?       @relation(fields: [memberId], references: [id])
  lodgeId               String
  lodge                 Lodge         @relation(fields: [lodgeId], references: [id])

  paidAt                DateTime?
  refundedAt            DateTime?
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@index([lodgeId, type])
  @@index([stripePaymentIntentId])
}

model DuesRecord {
  id                    String     @id @default(cuid())
  year                  Int        // Masonic year
  amount                Float      // Total amount due
  grandLodgePortion     Float?     // GL dues portion
  provincialPortion     Float?     // Provincial portion
  lodgePortion          Float?     // Lodge portion
  status                DuesStatus @default(CURRENT)
  dueDate               DateTime?
  paidDate              DateTime?
  paidAmount            Float?
  paymentMethod         String?    // "stripe", "cheque", "cash", "bank_transfer"
  stripeInvoiceId       String?    // Stripe invoice for this dues record
  instalmentPlan        Boolean    @default(false)
  notes                 String?

  memberId              String
  member                Member     @relation(fields: [memberId], references: [id])
  lodgeId               String
  lodge                 Lodge      @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime   @default(now())
  updatedAt             DateTime   @updatedAt

  @@unique([memberId, lodgeId, year])
  @@index([lodgeId, year])
}

model DiningFee {
  id                    String        @id @default(cuid())
  amount                Float
  guestAmount           Float?        // Additional for guests
  guestCount            Int           @default(0)
  status                PaymentStatus @default(PENDING)
  paidDate              DateTime?
  paymentMethod         String?
  stripeCheckoutSessionId String?

  memberId              String
  member                Member        @relation(fields: [memberId], references: [id])
  meetingId             String
  meeting               Meeting       @relation(fields: [meetingId], references: [id])

  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  @@unique([memberId, meetingId])
}

model CharityDonation {
  id                    String    @id @default(cuid())
  amount                Float
  fund                  String    // e.g. "MCF 2029 Festival", "Relief Chest", "Lodge Benevolent"
  isFestival            Boolean   @default(false)
  festivalTarget        Float?    // Individual target amount
  giftAid               Boolean   @default(false)
  giftAidDeclarationDate DateTime?
  date                  DateTime  @default(now())
  paymentMethod         String?
  stripeCheckoutSessionId String?
  notes                 String?

  memberId              String?   // Null for anonymous lodge donations
  member                Member?   @relation(fields: [memberId], references: [id])
  lodgeId               String
  lodge                 Lodge     @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime  @default(now())

  @@index([lodgeId, fund])
}

// ─── COMMUNICATIONS ─────────────────────────────────────

model Summons {
  id                    String    @id @default(cuid())
  content               Json?     // Structured summons content
  pdfUrl                String?   // Generated PDF URL (DocFlow or R2)
  docFlowId             String?   // DocFlow document ID
  generatedAt           DateTime?
  sentAt                DateTime?
  recipientCount        Int?
  rsvpDeadline          DateTime?

  meetingId             String    @unique
  meeting               Meeting   @relation(fields: [meetingId], references: [id])
  lodgeId               String
  lodge                 Lodge     @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

model Correspondence {
  id                    String             @id @default(cuid())
  type                  CorrespondenceType
  from                  String
  to                    String
  subject               String
  body                  String?
  date                  DateTime           @default(now())
  docFlowId             String?            // Stored document in DocFlow
  isRead                Boolean            @default(false)

  lodgeId               String
  lodge                 Lodge              @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime           @default(now())
}

// ─── WELFARE ────────────────────────────────────────────

model AlmonerCase {
  id                    String            @id @default(cuid())
  status                AlmonerCaseStatus @default(OPEN)
  encryptedNotes        String            // AES-256-CBC encrypted
  category              String?           // e.g. "Health", "Financial", "Bereavement"
  isConfidential        Boolean           @default(true)
  openedDate            DateTime          @default(now())
  closedDate            DateTime?
  lastContactDate       DateTime?
  nextActionDate        DateTime?
  nextAction            String?

  memberId              String
  member                Member            @relation(fields: [memberId], references: [id])

  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt

  @@index([memberId])
}

// ─── EQUIPMENT ──────────────────────────────────────────

model LodgeEquipment {
  id                    String    @id @default(cuid())
  name                  String    // e.g. "Volume of Sacred Law", "Square and Compasses"
  category              String    // e.g. "Regalia", "Furniture", "Working Tools", "Banners"
  condition             String?   // "Good", "Fair", "Poor", "Needs Repair"
  location              String?   // Where stored
  lastCheckedDate       DateTime?
  notes                 String?
  photoUrl              String?

  lodgeId               String
  lodge                 Lodge     @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
}

// ─── SYSTEM ─────────────────────────────────────────────

model Notification {
  id                    String    @id @default(cuid())
  type                  String    // "summons", "dues_reminder", "attendance_flag", "payment", etc.
  title                 String
  body                  String
  link                  String?   // In-app route
  isRead                Boolean   @default(false)
  emailSent             Boolean   @default(false)

  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  lodgeId               String?
  lodge                 Lodge?    @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime  @default(now())

  @@index([userId, isRead])
}

model AuditLog {
  id                    String    @id @default(cuid())
  action                String    // "CREATE", "UPDATE", "DELETE", "LOGIN", "PAYMENT"
  entity                String    // Model name
  entityId              String?
  details               Json?     // Changed fields
  ipAddress             String?

  userId                String
  user                  User      @relation(fields: [userId], references: [id])
  lodgeId               String?
  lodge                 Lodge?    @relation(fields: [lodgeId], references: [id])

  createdAt             DateTime  @default(now())

  @@index([lodgeId, createdAt])
  @@index([entity, entityId])
}
```

---

## Stripe integration

### Architecture: Connect Standard

Each lodge onboards as a **Stripe Connected Account** via Standard mode. LodgeKey is the platform.

| Concept | Implementation |
|---|---|
| Platform account | Game On Solutions Stripe account |
| Connected accounts | One per lodge (created during Treasurer onboarding) |
| Onboarding | Stripe hosted Account Links (KYC handled by Stripe) |
| Checkout | Stripe Checkout Sessions with `stripe_account` header |
| Recurring dues | Stripe Invoicing with auto-collection |
| Donations | Checkout Sessions (one-off or recurring) |
| Dining | Checkout Sessions triggered by RSVP |
| Platform fee | Optional `application_fee_amount` per transaction |
| Refunds | Full or partial via Stripe API |
| Webhooks | Single endpoint, events for all connected accounts |

### Key endpoints

```
POST   /stripe/connect/onboard          # Create connected account + account link
GET    /stripe/connect/status            # Check onboarding completion
POST   /stripe/checkout/dining           # Create dining checkout session
POST   /stripe/checkout/donation         # Create donation checkout session
POST   /stripe/invoices/dues             # Create/send dues invoice
POST   /stripe/invoices/:id/remind       # Send payment reminder
POST   /stripe/refund                    # Process refund
GET    /stripe/payments                  # List payments for lodge
GET    /stripe/dashboard-link            # Generate Stripe Express Dashboard link
POST   /stripe/webhook                   # Webhook handler (raw body, no auth)
```

### Webhook events

| Event | Action |
|---|---|
| `checkout.session.completed` | Update Payment, DiningFee/CharityDonation, create Transaction, sync Xero |
| `invoice.paid` | Update DuesRecord, create Transaction, update member standing, sync Xero |
| `invoice.payment_failed` | Flag DuesRecord, notify member + Treasurer, schedule retry |
| `charge.refunded` | Update Payment, reverse Transaction, sync credit note to Xero |
| `account.updated` | Update Lodge.stripeOnboardingComplete |
| `payment_intent.succeeded` | Fallback confirmation (idempotent) |

### Environment variables

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PLATFORM_FEE_PERCENT=2.5
STRIPE_CONNECT_RETURN_URL=https://freemasons.app/settings/payments
STRIPE_CONNECT_REFRESH_URL=https://freemasons.app/settings/payments/retry
```

### Webhook handler pattern

```typescript
// routes/stripeWebhook.ts — MUST use raw body, NO auth middleware
import Stripe from 'stripe';

export default async function stripeWebhookRoutes(fastify: FastifyInstance) {
  fastify.post('/stripe/webhook', {
    config: { rawBody: true },  // Fastify raw body plugin
    schema: { hide: true },      // Hide from Swagger
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const event = stripe.webhooks.constructEvent(
      request.rawBody!,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    // Route to handler based on event.type
    // Always return 200 quickly, process async
    await handleStripeEvent(event);
    return reply.status(200).send({ received: true });
  });
}
```

---

## Xero integration

Reuses the same pattern from Master Print Pro and DriveKey.

| Aspect | Detail |
|---|---|
| Auth | Custom Connection (`client_credentials` grant, £5/month per lodge) |
| SDK | Direct REST via axios (xero-node SDK deprecated April 28, 2026) |
| Sync frequency | Every 15 minutes, Mon-Fri |
| Synced entities | Contacts (members), invoices (dues, dining), payments, credit notes (refunds) |
| Scopes | `accounting.contacts`, `accounting.transactions` (granular, post-March 2026) |

### Xero account mapping

| LodgeKey Account | Xero Account |
|---|---|
| General Fund | Sales / General Income |
| Dining fees | Dining Income |
| Dues collected | Subscription Income |
| Charity donations | Charity / Benevolent |
| Stripe fees | Bank Charges |

---

## DocFlow Next integration

| Aspect | Detail |
|---|---|
| Client | `services/docflow.ts` — typed REST client with auth |
| Auth | Service account credentials |
| Scoping | All access scoped to configured DocFlow Site ID per lodge |
| Stored documents | Meeting minutes, summons PDFs, correspondence, bylaws |
| AI | Aida can search and query lodge documents via DocFlow |

---

## Aida AI (Secretary Assistant)

Context-aware AI assistant for lodge secretaries. Streaming SSE via Groq or Anthropic Claude.

### Context provided to Aida

- Lodge details (name, number, officers, meeting schedule)
- Member directory (names, degrees, attendance stats)
- Upcoming meetings and ceremonies
- Outstanding dues and payment status
- Recent correspondence
- DocFlow documents (minutes, summons)

### Example capabilities

- "Draft the summons for next Thursday's meeting"
- "Which members haven't attended in the last 3 meetings?"
- "Summarise the minutes from October"
- "Who is available to do the Second Degree charge?"
- "What are our outstanding dues for this year?"
- "Draft a letter to the Provincial Secretary about our Installation"

### AI Actions (rendered as buttons in chat)

```
[ACTION:generate_summons]     → Trigger summons generation
[ACTION:send_reminder]        → Send dues/dining reminder
[ACTION:flag_attendance]      → Flag low-attendance member for Almoner
[ACTION:create_ceremony_plan] → Create ceremony allocation draft
```

---

## Authentication & authorisation

### JWT tokens

- Access token: 8h expiry, contains `userId`, `role`, `lodgeId`
- Refresh token: 30d expiry, stored in `RefreshToken` table
- Bcrypt for password hashing (cost factor 12)
- Queue pattern for concurrent 401 refresh (Axios interceptor)

### Route protection

```typescript
// middleware/roleGuard.ts
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}

// Usage in routes:
fastify.get('/almoner/cases',
  { preHandler: [authenticate, requireRole('ALMONER', 'WORSHIPFUL_MASTER', 'SECRETARY')] },
  handler
);
```

### Lodge scoping

```typescript
// middleware/lodgeScope.ts — enforced on ALL queries
export async function lodgeScope(request: FastifyRequest) {
  if (request.user.role === 'PROVINCE_ADMIN') return; // bypass
  if (!request.user.lodgeId) throw new Error('No lodge context');
  // Attach lodgeId to all Prisma queries via middleware or manual filter
}
```

---

## Seed data

Demo lodge: **Vulcan Lodge No. 4510** (Middlesbrough, Province of Yorkshire North and East Ridings)

### Seed members (fictional, realistic)

| Name | Degree | Status | Office |
|---|---|---|---|
| WBro David Harrison | MM | Active | Worshipful Master |
| WBro Robert Thornton | MM | Active | Immediate Past Master |
| Bro James Mitchell | MM | Active | Senior Warden |
| Bro Alan Cooper | MM | Active | Junior Warden |
| WBro Peter Williams | MM | Active | Treasurer |
| Bro Mark Stevens | MM | Active | Secretary |
| Bro Thomas Clark | MM | Active | Senior Deacon |
| Bro Richard Moore | MM | Active | Junior Deacon |
| Bro Daniel Wright | MM | Active | Inner Guard |
| WBro Kenneth Brown | MM | Active | Director of Ceremonies |
| WBro George Taylor | MM | Active | Almoner |
| Bro Philip Jackson | MM | Active | Charity Steward |
| Bro Edward Martin | FC | Active | — |
| Bro Steven Young | EA | Active | — |
| WBro Arthur Dixon | MM | Active | Tyler |
| WBro Henry Robinson | MM | Honorary | Past Master |
| Bro Michael Anderson | MM | Country Member | — |
| Bro Ian Thompson | MM | Active | Steward |
| Bro Paul Green | MM | Active | Steward |
| WBro Charles Walker | MM | Deceased | Past Master |

### Seed credentials

| Role | Email | Password |
|---|---|---|
| Secretary | secretary@vulcan4510.co.uk | Password123! |
| Worshipful Master | wm@vulcan4510.co.uk | Password123! |
| Treasurer | treasurer@vulcan4510.co.uk | Password123! |
| Province Admin | admin@ynerprovince.co.uk | Password123! |
| Member | member@vulcan4510.co.uk | Password123! |

### Seed meetings

- Regular meetings: 3rd Thursday of Sep, Oct, Nov, Jan, Feb, Mar, Apr
- Installation meeting: April meeting
- Lodge of Instruction: 1st Thursday monthly
- Ladies Festival: February (social)

---

## Deployment

### Railway (API)

```dockerfile
FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @lodgekey/database generate
CMD ["pnpm", "--filter", "@lodgekey/api", "start:prod"]
```

Railway environment variables:
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
XERO_CLIENT_ID=...
XERO_CLIENT_SECRET=...
DOCFLOW_API_URL=...
DOCFLOW_EMAIL=...
DOCFLOW_PASSWORD=...
SENDGRID_API_KEY=...
GROQ_API_KEY=...
```

### Vercel (Web)

```bash
VITE_API_URL=https://api.freemasons.app \
  pnpm --filter @lodgekey/web build
cd apps/web/dist && vercel --yes --prod
```

### Cloudflare DNS

```
A     freemasons.app       → Vercel
CNAME api.freemasons.app   → Railway
```

---

## Development commands

```bash
# Install dependencies
pnpm install

# Start infrastructure (Postgres 5433, Redis, Mailhog, pgAdmin)
docker compose up -d

# One-time DB setup
psql "postgresql://lodgekey_user:lodgekey_password@127.0.0.1:5433/lodgekey_dev" \
  -f scripts/init-db.sql
DATABASE_URL="postgresql://lodgekey_user:lodgekey_password@127.0.0.1:5433/lodgekey_dev" \
  npx prisma db push
DATABASE_URL="..." pnpm --filter @lodgekey/database seed

# Dev servers (API :3001, Web :3000)
pnpm dev

# Stripe CLI for webhook testing
stripe listen --forward-to localhost:3001/stripe/webhook

# Build & deploy web
VITE_API_URL=https://api.freemasons.app \
  pnpm --filter @lodgekey/web build
cd apps/web/dist && vercel --yes --prod
```

---

## Local development URLs

| Service | URL |
|---|---|
| Web App | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger Docs | http://localhost:3001/docs |
| Mailhog | http://localhost:8025 |
| pgAdmin | http://localhost:5050 |
| Redis Commander | http://localhost:8081 |
| PostgreSQL | localhost:5433 |

---

## Architecture decisions

### Build & deploy
- API uses `tsx` directly — **no tsc build step**. Avoids TypeScript strict mode issues.
- Dockerfile: `CMD ["pnpm", "--filter", "@lodgekey/api", "start:prod"]`
- Web builds with `vite build` only (no tsc)
- Docker Compose maps Postgres to **port 5433** (avoids Homebrew conflict on 5432)

### Token refresh
Axios interceptor in `apps/web/src/lib/api.ts` uses a **queue pattern** for concurrent 401s — multiple simultaneous failed requests share one refresh call.

### AI provider resolution order
1. DB keys (per-lodge, set via Settings page) — highest priority
2. Falls back to `.env` variables
3. Groq for quick queries, Claude for complex document analysis
4. Keys encrypted with **AES-256-CBC** using JWT_ACCESS_SECRET as key seed

### Encryption
- Almoner case notes: AES-256-CBC encrypted at rest
- Ballot results: AES-256-CBC encrypted
- AI API keys in DB: AES-256-CBC encrypted
- Encryption key derived from JWT_ACCESS_SECRET

### Sensitive data handling
- Ballot results are NEVER exposed in API responses except to WM and Secretary
- Almoner cases only visible to ALMONER, WM, and SECRETARY roles
- Member personal details (DOB, address) restricted based on role
- Audit log captures all data access for compliance

### react-markdown v10
`className` prop removed in v10. Always use:
```jsx
<div className="prose dark:prose-invert">
  <Markdown>{content}</Markdown>
</div>
```

---

## Masonic domain glossary

| Term | Meaning |
|---|---|
| EA | Entered Apprentice — first degree |
| FC | Fellow Craft — second degree |
| MM | Master Mason — third degree |
| WM | Worshipful Master — lodge leader (elected annually) |
| IPM | Immediate Past Master — previous year's WM |
| SW / JW | Senior / Junior Warden — second and third in command |
| DC | Director of Ceremonies — manages ritual and protocol |
| SD / JD | Senior / Junior Deacon — assist in ceremonies |
| IG | Inner Guard — guards the lodge door from inside |
| Tyler | Guards the lodge door from outside |
| Almoner | Welfare officer — caring for sick and distressed brethren |
| Summons | Formal notice of meeting sent to all members |
| Festive Board | Formal dinner after a lodge meeting |
| Installation | Annual ceremony appointing new officers |
| Ballot | Secret vote on candidates (white/black balls) |
| Provincial Grand Lodge | Regional governing body |
| UGLE | United Grand Lodge of England — national governing body |
| MCF | Masonic Charitable Foundation |
| Relief Chest | Provincial charity collection mechanism |
| Grand Rank | Honours bestowed by UGLE |
| Provincial Rank | Honours bestowed by Provincial Grand Lodge |
| Lodge of Instruction | Practice/educational meetings |
| Consecration | Founding ceremony of a new lodge |
| Proposer / Seconder | Two members who sponsor a candidate |
| Form A | Application form for a candidate |
| Proficiency | Candidate demonstrates knowledge before advancing |
| Regalia | Ceremonial clothing and jewels |
| VSL | Volume of the Sacred Law (Bible or equivalent) |
| Working Tools | Symbolic tools presented in each degree |

---

## Common issues

| Symptom | Fix |
|---|---|
| Prisma client not found | `pnpm --filter @lodgekey/database generate` |
| Port 5433 in use | Another Postgres running. Check `docker compose ps` |
| 401 refresh loop | Check JWT_ACCESS_SECRET matches between API restarts |
| AI returns empty | Groq API key missing. Check Settings page or `.env` |
| Stripe webhook fails | Check `STRIPE_WEBHOOK_SECRET` matches; use `stripe listen` locally |
| Xero sync fails | Token expired — Custom Connection auto-refreshes, check logs |
| DocFlow docs not showing | DOCFLOW_SITE_ID not set in Lodge settings |
| `className` error on Markdown | v10 breaking change. Use wrapper div, not prop on component |
| Build fails with type errors | Don't run `tsc`. Use `tsx` for API and `vite build` for web |
| Stripe Connect onboarding stuck | Check `account.updated` webhook is handled; use Account Links refresh URL |

---

## Pricing model

| Tier | Price | Includes |
|---|---|---|
| **Lodge** | £25/month | Single lodge, 5 officer logins, members, meetings, attendance, summons, basic finance |
| **Lodge Pro** | £45/month | Unlimited logins, Stripe payments, Xero sync, Aida AI, DocFlow, charity, ritual planning |
| **Province** | £150/month | Multi-lodge dashboard, aggregate stats, returns automation, up to 30 lodges |
| Add-on user | £3/month | Additional login beyond tier allowance |

Platform fee: Optional 2.5% on Stripe transactions (configurable per lodge).

---

## Future roadmap

- [ ] Mobile app (Capacitor, like Finding the Joy)
- [ ] Provincial returns automation (Annual Return to UGLE)
- [ ] Inter-lodge visiting invitations
- [ ] QR code attendance check-in at meetings
- [ ] Lodge history timeline / archive
- [ ] Integration with Grand Lodge membership database
- [ ] Multi-order support (Royal Arch, Mark, etc.)
- [ ] Calendar sync (Google Calendar, Outlook)
- [ ] SMS notifications (Twilio)
- [ ] Public lodge finder page (freemasons.app/find)
