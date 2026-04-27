import type { PrismaClient } from '@prisma/client';

/**
 * Payment plan logic for first-year initiates.
 *
 * Year-1 ask = joining fee + year-1 subscription, where year-1 subscription
 * is the lodge's annual subs pro-rated to the months remaining until the
 * next Masonic year-start (typically April). After year-1 the brother sets
 * up a standing order at lodge.annualDues / 12 per month.
 *
 * The schedule generator is deterministic — Incus only chooses the cadence
 * and number of months to spread over, given the candidate's circumstances.
 */

interface InstalmentDraft {
  sequence: number;
  label: string;
  dueDate: Date;
  amount: number;
  isJoiningFee: boolean;
}

export function computeYear1Subs(initiationDate: Date, annualDues: number, masonicYearStartMonth = 4): number {
  // Months remaining from initiation up to (but not including) the next
  // Masonic year-start. April-initiated brother covers a full 12 months;
  // a January initiate only covers 3 (Jan-Mar) of the current cycle.
  const initMonth = initiationDate.getUTCMonth() + 1;
  let monthsRemaining = ((masonicYearStartMonth - initMonth + 12) % 12);
  if (monthsRemaining === 0) monthsRemaining = 12;
  const prorated = (annualDues * monthsRemaining) / 12;
  return Math.round(prorated * 100) / 100;
}

export function buildInstalments(opts: {
  initiationDate: Date;
  joiningFeeAmount: number;
  year1SubsAmount: number;
  monthsToSpread: number;
  cadence: 'MONTHLY' | 'QUARTERLY' | 'LUMP';
  lumpSumPortion?: number;
}): InstalmentDraft[] {
  const { initiationDate, joiningFeeAmount, year1SubsAmount, monthsToSpread, cadence } = opts;
  const lumpSumPortion = Math.max(0, Math.min(opts.lumpSumPortion ?? 0, year1SubsAmount));

  const instalments: InstalmentDraft[] = [];

  // 1. Joining fee — required ≥ 3 weeks before initiation
  const joiningDue = new Date(initiationDate);
  joiningDue.setUTCDate(joiningDue.getUTCDate() - 21);
  instalments.push({
    sequence: 1,
    label: 'Joining fee',
    dueDate: joiningDue,
    amount: round2(joiningFeeAmount),
    isJoiningFee: true,
  });

  // 2. Optional lump sum towards year-1 subs, alongside the joining fee
  let remainingSubs = year1SubsAmount;
  let nextSeq = 2;
  if (lumpSumPortion > 0) {
    instalments.push({
      sequence: nextSeq++,
      label: 'Year 1 lump sum',
      dueDate: joiningDue,
      amount: round2(lumpSumPortion),
      isJoiningFee: false,
    });
    remainingSubs -= lumpSumPortion;
  }

  if (remainingSubs <= 0) return instalments;

  if (cadence === 'LUMP') {
    instalments.push({
      sequence: nextSeq++,
      label: 'Year 1 subscription',
      dueDate: initiationDate,
      amount: round2(remainingSubs),
      isJoiningFee: false,
    });
    return instalments;
  }

  if (cadence === 'QUARTERLY') {
    const quarters = Math.max(1, Math.min(4, Math.ceil(monthsToSpread / 3)));
    const perQuarter = round2(remainingSubs / quarters);
    let acc = 0;
    for (let i = 0; i < quarters; i++) {
      const due = new Date(initiationDate);
      due.setUTCMonth(due.getUTCMonth() + i * 3);
      const amount = i === quarters - 1 ? round2(remainingSubs - acc) : perQuarter;
      acc += amount;
      instalments.push({
        sequence: nextSeq++,
        label: `Quarter ${i + 1} of ${quarters}`,
        dueDate: due,
        amount,
        isJoiningFee: false,
      });
    }
    return instalments;
  }

  // MONTHLY (default)
  const months = Math.max(1, Math.min(12, monthsToSpread));
  const perMonth = round2(remainingSubs / months);
  let acc = 0;
  for (let i = 0; i < months; i++) {
    const due = new Date(initiationDate);
    due.setUTCMonth(due.getUTCMonth() + i);
    const amount = i === months - 1 ? round2(remainingSubs - acc) : perMonth;
    acc += amount;
    instalments.push({
      sequence: nextSeq++,
      label: `Month ${i + 1} of ${months}`,
      dueDate: due,
      amount,
      isJoiningFee: false,
    });
  }
  return instalments;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

interface ProposeInput {
  candidateId: string;
  monthsToSpread: number;
  cadence: 'MONTHLY' | 'QUARTERLY' | 'LUMP';
  lumpSumPortion?: number;
  candidateCircumstances?: string;
  notes?: string;
  proposedById: string;
}

export async function proposePaymentPlan(prisma: PrismaClient, lodgeId: string, input: ProposeInput) {
  const candidate = await prisma.candidate.findFirst({
    where: { id: input.candidateId, lodgeId },
  });
  if (!candidate) throw new Error('Candidate not found in this lodge');
  if (!candidate.initiationDate) throw new Error('Candidate has no initiation date set yet — schedule it first');

  const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
  if (!lodge) throw new Error('Lodge not found');
  if (!lodge.annualDues) throw new Error('Lodge annualDues not configured');
  if (!lodge.joiningFee) throw new Error('Lodge joiningFee not configured');

  const year1Subs = computeYear1Subs(candidate.initiationDate, lodge.annualDues, lodge.masonicYearStartMonth ?? 4);
  const total = round2(lodge.joiningFee + year1Subs);

  const instalments = buildInstalments({
    initiationDate: candidate.initiationDate,
    joiningFeeAmount: lodge.joiningFee,
    year1SubsAmount: year1Subs,
    monthsToSpread: input.monthsToSpread,
    cadence: input.cadence,
    lumpSumPortion: input.lumpSumPortion,
  });

  return prisma.paymentPlan.create({
    data: {
      candidateId: input.candidateId,
      lodgeId,
      joiningFeeAmount: lodge.joiningFee,
      year1SubsAmount: year1Subs,
      totalAmount: total,
      monthsToSpread: input.monthsToSpread,
      cadence: input.cadence,
      lumpSumPortion: input.lumpSumPortion,
      candidateCircumstances: input.candidateCircumstances,
      notes: input.notes,
      status: 'PROPOSED',
      proposedById: input.proposedById,
      instalments: { create: instalments },
    },
    include: { instalments: { orderBy: { sequence: 'asc' } }, candidate: true },
  });
}

export async function approvePaymentPlan(prisma: PrismaClient, lodgeId: string, planId: string, approverUserId: string) {
  const plan = await prisma.paymentPlan.findFirst({ where: { id: planId, lodgeId } });
  if (!plan) throw new Error('Plan not found');
  if (plan.status !== 'PROPOSED') throw new Error(`Plan is ${plan.status}, expected PROPOSED`);
  return prisma.paymentPlan.update({
    where: { id: planId },
    data: { status: 'APPROVED', approvedById: approverUserId, approvedAt: new Date() },
    include: { instalments: { orderBy: { sequence: 'asc' } }, candidate: true },
  });
}
