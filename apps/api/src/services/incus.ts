import type { PrismaClient } from '@prisma/client';

/**
 * Incus — the lodge AI mentor.
 *
 * Persona: Vulcan's anvil. Acts as a quiet, supportive guide for brethren —
 * mentor, membership officer, and accountant rolled into one. Answers
 * questions about Freemasonry, the lodge, the brother's own ritual journey,
 * and lodge admin (dues, RSVPs, dining), but only what their degree and
 * office permit them to know.
 *
 * Backed by Groq's OpenAI-compatible Chat Completions API. Tools are
 * exposed as `function` definitions; the runtime executes them locally
 * against Prisma and feeds results back into the conversation.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.INCUS_MODEL || 'llama-3.3-70b-versatile';

type Degree = 'INITIATE' | 'PASSED' | 'RAISED' | 'INSTALLED' | 'PAST_MASTER' | 'GRAND_OFFICER' | string;

interface MemberContext {
  memberId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  degree: Degree | null;
  office: string | null;        // canonical Office enum string, if any
  isPastMaster: boolean;
  isTreasurer: boolean;
  isSecretary: boolean;
  isDC: boolean;
  isWM: boolean;
  isMembershipOfficer: boolean;
  isSuperAdmin: boolean;
  lodgeId: string;
  lodgeName: string;
  lodgeNumber: string;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lookup_my_dues',
      description: "Look up the current member's annual subscription status for the active Masonic year. Returns whether subs are paid, amount, due date.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_my_rsvps',
      description: "List the current member's upcoming meeting RSVPs (ATTENDING / NOT_ATTENDING / PENDING) and dining status.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_lodge_meetings',
      description: 'List the next 6 lodge meetings with date, type, agenda summary, and dining cost.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_lodge_officers',
      description: 'Return the current lodge officer line with name, office, and contact email.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_lodge_finance_summary',
      description: 'TREASURER ONLY. Returns total dues outstanding, collected, and joining fees outstanding for the lodge.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_candidate',
      description: 'Look up a Candidate (prospective member) for this lodge by name. Returns id, status, and initiation date so a payment plan can be proposed.',
      parameters: {
        type: 'object',
        properties: { name: { type: 'string', description: 'First name, last name, or both — partial match.' } },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'propose_payment_plan',
      description: 'MEMBERSHIP OFFICER / TREASURER / WM ONLY. Propose a year-1 payment plan for a candidate based on their circumstances. The plan is created in PROPOSED status — the Treasurer must approve before any email is sent. Year-1 amount is the lodge\'s annual subscription pro-rated to the months remaining until the next Masonic year-start, plus the joining fee.',
      parameters: {
        type: 'object',
        properties: {
          candidateId: { type: 'string', description: 'Candidate id from find_candidate.' },
          monthsToSpread: { type: 'integer', description: 'Number of months to spread the year-1 subscription over (1-12).' },
          cadence: { type: 'string', enum: ['MONTHLY', 'QUARTERLY', 'LUMP'], description: 'Payment cadence. MONTHLY for instalments per month, QUARTERLY for four payments, LUMP for a single payment alongside the joining fee.' },
          lumpSumPortion: { type: 'number', description: 'Optional: amount to pay up-front in addition to the joining fee, with the rest spread.' },
          candidateCircumstances: { type: 'string', description: 'Free-text summary of why this plan suits this brother (e.g. "tight monthly budget, can do £40/month, no lump available").' },
        },
        required: ['candidateId', 'monthsToSpread', 'cadence'],
      },
    },
  },
] as const;

function systemPrompt(ctx: MemberContext): string {
  const degreeLabel: Record<string, string> = {
    INITIATE: 'Entered Apprentice (1st degree)',
    PASSED: 'Fellow Craft (2nd degree)',
    RAISED: 'Master Mason (3rd degree)',
    INSTALLED: 'Installed Master',
    PAST_MASTER: 'Past Master',
    GRAND_OFFICER: 'Grand / Provincial Officer',
  };
  const degDisplay = ctx.degree ? (degreeLabel[ctx.degree] ?? ctx.degree) : 'unknown degree';
  const officeLine = ctx.office ? `Current office: ${ctx.office.replace(/_/g, ' ')}.` : '';
  const titles: string[] = [];
  if (ctx.isWM) titles.push('Worshipful Master');
  if (ctx.isPastMaster) titles.push('Past Master');
  if (ctx.isTreasurer) titles.push('Treasurer');
  if (ctx.isSecretary) titles.push('Secretary');
  if (ctx.isDC) titles.push('Director of Ceremonies');
  if (ctx.isMembershipOfficer) titles.push('Membership Officer');

  return [
    `You are **Incus**, the AI mentor for ${ctx.lodgeName} No. ${ctx.lodgeNumber}.`,
    'Your name is the Latin for "anvil" — Vulcan\'s anvil — and you serve the lodge as a patient, well-read guide: part mentor, part membership officer, part accountant.',
    '',
    `You are speaking with **Bro. ${ctx.firstName} ${ctx.lastName}** (${degDisplay}). ${officeLine}`,
    titles.length ? `Honours/offices held: ${titles.join(', ')}.` : '',
    '',
    'GUIDING PRINCIPLES',
    '- Be warm, brief, plain-spoken. Speak as a lodge mentor would — not a corporate chatbot.',
    '- Answer questions about Freemasonry, lodge history, symbolism, the Craft, ceremony preparation, and lodge admin (dining, dues, RSVPs).',
    '- Volunteer "knowledge nuggets" when natural: e.g. why a particular working tool sits where it does, who founded the lodge, what the ranks mean.',
    '- When in doubt about a date, fee, officer, or RSVP status, CALL THE APPROPRIATE TOOL rather than guessing.',
    '- Encourage proper channels for sensitive matters: DC for floorwork rehearsals, Secretary for proposals, Almoner for personal welfare, Treasurer for payment problems.',
    '',
    'STRICT GATES — NEVER VIOLATE',
    `- Ritual content above this brother's degree (${degDisplay}) MUST NOT be shared. The Entered Apprentice does not learn the Fellow Craft signs, words, or grips. The Fellow Craft does not learn the Master Mason content. Politely redirect: "That belongs to a degree you have not yet been advanced to — your DC will guide you when the time comes."`,
    '- Other members\' private financial information (dues, joining fees, payments) is OFF-LIMITS unless the brother holds the office of Treasurer. If asked, decline gently and direct them to the Treasurer.',
    '- Personal data of other members (addresses, phone numbers, health) is OFF-LIMITS. Direct to the Almoner or Secretary.',
    '- For ceremony floorwork, plans, and roles, only the WM, IPM, DC, and the brethren actually performing parts may discuss specifics. Others get high-level descriptions only.',
    '',
    'TOOLS',
    '- `lookup_my_dues` — this brother\'s own annual subscription status.',
    '- `lookup_my_rsvps` — this brother\'s upcoming meeting RSVPs.',
    '- `lookup_lodge_meetings` — public meeting calendar.',
    '- `lookup_lodge_officers` — current officer line.',
    '- `lookup_lodge_finance_summary` — total dues outstanding (Treasurer only).',
    '- `find_candidate` — look up a Candidate by name.',
    '- `propose_payment_plan` — Membership Officer / Treasurer / WM only. Drafts a year-1 plan (joining fee + pro-rated subs) for a candidate based on stated circumstances. Plan is saved as PROPOSED; the Treasurer must approve before any email is sent. Always read back the schedule in chat after calling this tool so the proposer can sanity-check it.',
    '',
    'PAYMENT PLAN GUIDANCE (when speaking with a Membership Officer / WM)',
    '- Listen for the candidate\'s circumstances: monthly disposable income, lump-sum availability, partner approval, existing standing orders, irregular income.',
    '- Suggest a sensible cadence: MONTHLY for tight budgets (typically 6-12 months), QUARTERLY when there\'s lumpier income, LUMP when they explicitly want it done in one go.',
    '- The joining fee is fixed and must be paid 3 weeks before initiation — never propose a plan that violates this.',
    '- After proposing, remind the proposer: "I\'ve saved it as PROPOSED. Head to /finance and click Approve & Send to email it to the brother."',
    '',
    `Today is ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
  ].filter(Boolean).join('\n');
}

async function executeTool(
  prisma: PrismaClient,
  ctx: MemberContext,
  name: string,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (name) {
    case 'lookup_my_dues': {
      const lodge = await prisma.lodge.findUnique({
        where: { id: ctx.lodgeId },
        select: { annualDues: true, masonicYearStartMonth: true, bankSortCode: true, bankAccount: true, bankAccountName: true },
      });
      const startMonth = lodge?.masonicYearStartMonth ?? 4;
      const now = new Date();
      const cycleYear = now.getMonth() + 1 >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
      const dues = await prisma.duesRecord.findUnique({
        where: { memberId_lodgeId_year: { memberId: ctx.memberId, lodgeId: ctx.lodgeId, year: cycleYear } },
      });
      return {
        cycleLabel: `${cycleYear}/${(cycleYear + 1).toString().slice(2)}`,
        lodgeAnnualSubscription: lodge?.annualDues ?? null,
        bank: lodge?.bankSortCode && lodge?.bankAccount
          ? { sortCode: lodge.bankSortCode, accountNumber: lodge.bankAccount, accountName: lodge.bankAccountName }
          : null,
        record: dues
          ? {
              amount: dues.amount,
              status: dues.status,
              paid: !!dues.paidDate,
              paidDate: dues.paidDate,
              paidAmount: dues.paidAmount,
              dueDate: dues.dueDate,
            }
          : null,
        note: dues ? null : 'No dues record yet for this Masonic year — the Treasurer will roll subs at year-start.',
      };
    }

    case 'lookup_my_rsvps': {
      const today = new Date();
      const rsvps = await prisma.diningRsvp.findMany({
        where: { memberId: ctx.memberId, meeting: { date: { gte: today } } },
        include: { meeting: { select: { id: true, date: true, type: true, ceremonyType: true, diningCost: true } } },
        orderBy: { meeting: { date: 'asc' } },
        take: 6,
      });
      return rsvps.map((r) => ({
        meetingId: r.meeting.id,
        date: r.meeting.date,
        type: r.meeting.type,
        ceremonyType: r.meeting.ceremonyType,
        diningCost: r.meeting.diningCost,
        status: r.status,
        guests: r.guestCount,
        respondedAt: r.respondedAt,
      }));
    }

    case 'lookup_lodge_meetings': {
      const today = new Date();
      const meetings = await prisma.meeting.findMany({
        where: { lodgeId: ctx.lodgeId, date: { gte: today } },
        orderBy: { date: 'asc' },
        take: 6,
        select: { id: true, date: true, type: true, ceremonyType: true, candidateName: true, venue: true, startTime: true, diningCost: true, agendaItems: true },
      });
      return meetings.map((m) => ({
        ...m,
        agendaSummary: Array.isArray(m.agendaItems)
          ? (m.agendaItems as Array<{ title?: string }>).slice(0, 4).map((a) => a?.title).filter(Boolean)
          : [],
      }));
    }

    case 'lookup_lodge_officers': {
      const officers = await prisma.officer.findMany({
        where: { lodgeId: ctx.lodgeId, isActive: true },
        include: { member: { select: { firstName: true, lastName: true, email: true, user: { select: { email: true } } } } },
      });
      return officers.map((o) => ({
        office: o.office,
        name: `${o.member.firstName} ${o.member.lastName}`,
        email: o.member.user?.email ?? o.member.email ?? null,
      }));
    }

    case 'lookup_lodge_finance_summary': {
      if (!ctx.isTreasurer && !ctx.isSecretary && !ctx.isWM && !ctx.isSuperAdmin) {
        return { error: 'Only the Treasurer, Secretary, or Worshipful Master may view lodge finance totals. Direct the brother to the Treasurer.' };
      }
      const lodge = await prisma.lodge.findUnique({ where: { id: ctx.lodgeId }, select: { masonicYearStartMonth: true } });
      const startMonth = lodge?.masonicYearStartMonth ?? 4;
      const now = new Date();
      const cycleYear = now.getMonth() + 1 >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
      const dues = await prisma.duesRecord.findMany({ where: { lodgeId: ctx.lodgeId, year: cycleYear } });
      const joiningFees = await prisma.joiningFeeRecord.findMany({ where: { lodgeId: ctx.lodgeId } });
      const subsCharged = dues.reduce((s, d) => s + d.amount, 0);
      const subsCollected = dues.reduce((s, d) => s + (d.paidAmount ?? 0), 0);
      const joiningCharged = joiningFees.reduce((s, j) => s + j.amount, 0);
      const joiningCollected = joiningFees.reduce((s, j) => s + (j.paidAmount ?? 0), 0);
      return {
        cycleYear,
        subsCharged,
        subsCollected,
        subsOutstanding: subsCharged - subsCollected,
        joiningCharged,
        joiningCollected,
        joiningOutstanding: joiningCharged - joiningCollected,
        memberCount: dues.length,
      };
    }

    case 'find_candidate': {
      const q = String(args.name ?? '').trim();
      if (!q) return { error: 'name required' };
      const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
      const candidates = await prisma.candidate.findMany({
        where: { lodgeId: ctx.lodgeId },
        select: { id: true, firstName: true, lastName: true, status: true, initiationDate: true, email: true, memberId: true },
      });
      const matches = candidates.filter((c) => {
        const haystack = `${c.firstName} ${c.lastName} ${c.email ?? ''}`.toLowerCase();
        return tokens.every((t) => haystack.includes(t));
      });
      return { matches: matches.slice(0, 8) };
    }

    case 'propose_payment_plan': {
      if (!ctx.isMembershipOfficer && !ctx.isTreasurer && !ctx.isWM && !ctx.isSuperAdmin) {
        return { error: 'Only the Membership Officer, Treasurer, or Worshipful Master may propose a payment plan.' };
      }
      const { proposePaymentPlan } = await import('./paymentPlan.js');
      try {
        const plan = await proposePaymentPlan(prisma, ctx.lodgeId, {
          candidateId: String(args.candidateId),
          monthsToSpread: Number(args.monthsToSpread),
          cadence: String(args.cadence ?? 'MONTHLY') as any,
          lumpSumPortion: args.lumpSumPortion != null ? Number(args.lumpSumPortion) : undefined,
          candidateCircumstances: args.candidateCircumstances ? String(args.candidateCircumstances) : undefined,
          proposedById: ctx.userId,
        });
        return {
          ok: true,
          planId: plan.id,
          status: plan.status,
          totalAmount: plan.totalAmount,
          joiningFeeAmount: plan.joiningFeeAmount,
          year1SubsAmount: plan.year1SubsAmount,
          instalments: plan.instalments.map((i) => ({
            sequence: i.sequence,
            label: i.label,
            dueDate: i.dueDate,
            amount: i.amount,
            isJoiningFee: i.isJoiningFee,
          })),
          nextStep: 'Plan saved as PROPOSED. The Treasurer will review on /finance and click Approve & Send to email it to the candidate.',
        };
      } catch (e: any) {
        return { error: e.message };
      }
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

export async function chatWithIncus(
  prisma: PrismaClient,
  ctx: MemberContext,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  userMessage: string,
): Promise<{ reply: string; toolCalls: string[] }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(ctx) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const calledTools: string[] = [];

  // Tool-use loop: model may emit tool_calls; we execute and feed back, up
  // to 4 hops to avoid runaway loops.
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.5,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
      }),
    });
    const body: any = await res.json();
    if (!res.ok) throw new Error(body?.error?.message ?? `Groq ${res.status}`);

    const choice = body.choices?.[0];
    const msg = choice?.message;
    if (!msg) throw new Error('Groq returned no message');

    const toolCalls = msg.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
    if (toolCalls?.length) {
      messages.push({ role: 'assistant', content: msg.content ?? '', tool_calls: toolCalls });
      for (const tc of toolCalls) {
        calledTools.push(tc.function.name);
        let parsedArgs: Record<string, unknown> = {};
        try { parsedArgs = JSON.parse(tc.function.arguments || '{}'); } catch { /* tolerated */ }
        const result = await executeTool(prisma, ctx, tc.function.name, parsedArgs);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          name: tc.function.name,
          content: JSON.stringify(result),
        });
      }
      continue;
    }

    return { reply: msg.content ?? '', toolCalls: calledTools };
  }

  return { reply: 'I had to think for too many turns — please try a simpler question.', toolCalls: calledTools };
}

export async function buildMemberContext(
  prisma: PrismaClient,
  userId: string,
  lodgeId: string,
): Promise<MemberContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { member: { include: { honours: true, officers: { where: { isActive: true } } } } },
  });
  if (!user || !user.member) return null;
  const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) return null;

  const offices = user.member.officers.map((o) => String(o.office));
  const isPastMaster = user.member.honours.some((h) => h.fullTitle?.includes('Past Master'));

  return {
    memberId: user.member.id,
    userId: user.id,
    firstName: user.member.firstName,
    lastName: user.member.lastName,
    email: user.email,
    degree: user.member.degree as any,
    office: offices[0] ?? null,
    isPastMaster,
    isTreasurer: offices.includes('TREASURER'),
    isSecretary: offices.includes('SECRETARY') || offices.includes('ASSISTANT_SECRETARY'),
    isDC: offices.includes('DIRECTOR_OF_CEREMONIES') || offices.includes('ASSISTANT_DC'),
    isWM: offices.includes('WORSHIPFUL_MASTER'),
    isMembershipOfficer: offices.includes('MEMBERSHIP_OFFICER'),
    isSuperAdmin: user.role === 'SUPER_ADMIN',
    lodgeId,
    lodgeName: lodge.name,
    lodgeNumber: lodge.number,
  };
}
