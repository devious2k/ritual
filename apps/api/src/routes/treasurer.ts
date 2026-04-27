import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext, requireLodge } from '../middleware/tenant.js';

/**
 * Treasurer endpoints — dashboard payload + actions for dues and joining fees.
 *
 * The Masonic year on a lodge starts on Lodge.masonicYearStartMonth (April for
 * Vulcan). currentMasonicYear() picks the current cycle's start year so dues
 * for "2026/27" appear under year=2026 from 1 April 2026 → 31 March 2027.
 */

function currentMasonicYearStart(now: Date, startMonth: number): Date {
  // startMonth is 1-based. Apr=4 → cycle start = 1 Apr {year}.
  const year = now.getMonth() + 1 >= startMonth ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(Date.UTC(year, startMonth - 1, 1));
}

// Idempotently create 12 SubsInstalment rows (one per month) for a
// STANDING_ORDER member. Each row carries the expected monthly amount
// (annualDues / 12) and a due date stepping forward from the cycle start.
async function ensureInstalmentsForRecord(
  prisma: import('@prisma/client').PrismaClient,
  duesRecordId: string,
  cycleStart: Date,
  annualDues: number,
) {
  const monthly = Math.round((annualDues / 12) * 100) / 100;
  const rows: Array<{ duesRecordId: string; monthIndex: number; dueDate: Date; expectedAmount: number }> = [];
  for (let m = 1; m <= 12; m++) {
    const due = new Date(cycleStart);
    due.setUTCMonth(due.getUTCMonth() + (m - 1));
    rows.push({ duesRecordId, monthIndex: m, dueDate: due, expectedAmount: monthly });
  }
  await prisma.subsInstalment.createMany({ data: rows, skipDuplicates: true });
}

export async function treasurerRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);
  fastify.addHook('preHandler', requireLodge);

  // GET /treasurer/dashboard — single payload for the dashboard view.
  fastify.get('/dashboard', async (request) => {
    const lodgeId = request.lodgeId!;
    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) return { error: 'Lodge not found' };

    const startMonth = lodge.masonicYearStartMonth ?? 4;
    const cycleStart = currentMasonicYearStart(new Date(), startMonth);
    const cycleYear = cycleStart.getUTCFullYear(); // e.g. 2026 means 2026/27 cycle

    const members = await prisma.member.findMany({
      where: { lodgeId, status: { in: ['ACTIVE', 'HONORARY', 'COUNTRY_MEMBER'] } as any },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: { id: true, firstName: true, lastName: true, status: true, subscriptionMode: true },
    });

    const dues = await prisma.duesRecord.findMany({
      where: { lodgeId, year: cycleYear },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        instalments: { orderBy: { monthIndex: 'asc' } },
      },
    });
    const duesByMember = new Map(dues.map((d) => [d.memberId, d]));

    const joiningFees = await prisma.joiningFeeRecord.findMany({
      where: { lodgeId },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ paidDate: 'asc' }, { dueDate: 'asc' }],
    });

    // Per-member dues row (synthesised if no record yet, so the UI can show
    // every active brother's current status without first running roll.)
    const dueRows = members.map((m) => {
      const rec = duesByMember.get(m.id);
      const mode = (m.subscriptionMode ?? 'LUMP_SUM') as 'LUMP_SUM' | 'STANDING_ORDER';
      const instalments = rec?.instalments ?? [];
      const instalmentsPaidCount = instalments.filter((i) => i.paidDate).length;
      const instalmentsTotal = instalments.length;
      const instalmentsCollectedAmount = instalments.reduce((s, i) => s + (i.paidAmount ?? 0), 0);

      // For STANDING_ORDER: collected = sum of instalments. For LUMP_SUM:
      // collected = paidAmount on the parent record.
      const collected = mode === 'STANDING_ORDER' ? instalmentsCollectedAmount : (rec?.paidAmount ?? 0);
      const isFullyPaid = mode === 'STANDING_ORDER'
        ? instalmentsTotal > 0 && instalmentsPaidCount === instalmentsTotal
        : !!rec?.paidDate;

      return {
        memberId: m.id,
        memberName: `${m.firstName} ${m.lastName}`,
        recordId: rec?.id ?? null,
        amount: rec?.amount ?? lodge.annualDues ?? null,
        status: rec?.status ?? 'CURRENT',
        dueDate: rec?.dueDate ?? cycleStart,
        paidDate: rec?.paidDate ?? null,
        paidAmount: rec?.paidAmount ?? null,
        subscriptionMode: mode,
        instalments: instalments.map((i) => ({
          id: i.id,
          monthIndex: i.monthIndex,
          dueDate: i.dueDate,
          expectedAmount: i.expectedAmount,
          paidDate: i.paidDate,
          paidAmount: i.paidAmount,
        })),
        instalmentsPaidCount,
        instalmentsTotal,
        collected,
        isFullyPaid,
      };
    });

    const subsCharged = dueRows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const subsCollected = dueRows.reduce((s, r) => s + r.collected, 0);
    const subsOutstanding = subsCharged - subsCollected;
    const subsCollectedCount = dueRows.filter((r) => r.isFullyPaid).length;

    const joiningCharged = joiningFees.reduce((s, j) => s + j.amount, 0);
    const joiningCollected = joiningFees.reduce((s, j) => s + (j.paidAmount ?? 0), 0);
    const joiningOutstanding = joiningCharged - joiningCollected;

    return {
      lodge: {
        id: lodge.id,
        name: lodge.name,
        number: lodge.number,
        annualDues: lodge.annualDues,
        joiningFee: lodge.joiningFee,
        masonicYearStartMonth: startMonth,
        bankSortCode: lodge.bankSortCode,
        bankAccount: lodge.bankAccount,
        bankAccountName: lodge.bankAccountName,
      },
      cycle: {
        startYear: cycleYear,
        endYear: cycleYear + 1,
        startDate: cycleStart,
        label: `${cycleYear}/${(cycleYear + 1).toString().slice(2)}`,
      },
      totals: {
        memberCount: members.length,
        subsCharged,
        subsCollected,
        subsOutstanding,
        subsCollectedCount,
        joiningCharged,
        joiningCollected,
        joiningOutstanding,
      },
      dues: dueRows,
      joiningFees: joiningFees.map((j) => ({
        id: j.id,
        memberId: j.memberId,
        memberName: `${j.member.firstName} ${j.member.lastName}`,
        amount: j.amount,
        dueDate: j.dueDate,
        paidDate: j.paidDate,
        paidAmount: j.paidAmount,
        notes: j.notes,
      })),
    };
  });

  // POST /treasurer/dues/roll — generate DuesRecord rows for the current Masonic
  // year for every active member at the lodge's standard rate. Idempotent:
  // existing records are left alone (skipDuplicates).
  fastify.post('/dues/roll', async (request, reply) => {
    const lodgeId = request.lodgeId!;
    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });
    if (!lodge.annualDues) return reply.status(400).send({ error: 'Set annualDues on the lodge first' });

    const startMonth = lodge.masonicYearStartMonth ?? 4;
    const cycleStart = currentMasonicYearStart(new Date(), startMonth);
    const cycleYear = cycleStart.getUTCFullYear();

    const members = await prisma.member.findMany({
      where: { lodgeId, status: { in: ['ACTIVE', 'HONORARY', 'COUNTRY_MEMBER'] } as any },
      select: { id: true },
    });

    const created = await prisma.duesRecord.createMany({
      data: members.map((m) => ({
        memberId: m.id,
        lodgeId,
        year: cycleYear,
        amount: lodge.annualDues!,
        grandLodgePortion: lodge.grandLodgeDues ?? 0,
        provincialPortion: lodge.provincialDues ?? 0,
        lodgePortion: (lodge.annualDues ?? 0) - (lodge.grandLodgeDues ?? 0) - (lodge.provincialDues ?? 0),
        dueDate: cycleStart,
      })),
      skipDuplicates: true,
    });

    // Seed monthly instalments for any STANDING_ORDER members. £204/12 = £17.
    const standingOrderMembers = await prisma.member.findMany({
      where: { lodgeId, subscriptionMode: 'STANDING_ORDER', status: { in: ['ACTIVE', 'HONORARY', 'COUNTRY_MEMBER'] } as any },
      select: { id: true },
    });
    for (const m of standingOrderMembers) {
      const rec = await prisma.duesRecord.findUnique({
        where: { memberId_lodgeId_year: { memberId: m.id, lodgeId, year: cycleYear } },
      });
      if (rec) await ensureInstalmentsForRecord(prisma, rec.id, cycleStart, lodge.annualDues!);
    }

    return { rolled: created.count, year: cycleYear };
  });

  // PUT /treasurer/members/:memberId/subscription-mode
  // Body { mode: 'LUMP_SUM' | 'STANDING_ORDER' }
  // Switching to STANDING_ORDER also generates the 12 instalment rows for
  // the current Masonic year if a DuesRecord exists.
  fastify.put('/members/:memberId/subscription-mode', async (request, reply) => {
    const { memberId } = request.params as { memberId: string };
    const body = request.body as { mode: 'LUMP_SUM' | 'STANDING_ORDER' };
    if (!['LUMP_SUM', 'STANDING_ORDER'].includes(body.mode)) {
      return reply.status(400).send({ error: 'Invalid mode' });
    }
    const member = await prisma.member.findFirst({ where: { id: memberId, lodgeId: request.lodgeId! } });
    if (!member) return reply.status(404).send({ error: 'Member not found' });

    const updated = await prisma.member.update({
      where: { id: memberId },
      data: { subscriptionMode: body.mode },
    });

    // If switching to STANDING_ORDER, seed instalments for the current cycle.
    if (body.mode === 'STANDING_ORDER') {
      const lodge = await prisma.lodge.findUnique({ where: { id: request.lodgeId! } });
      if (lodge?.annualDues) {
        const startMonth = lodge.masonicYearStartMonth ?? 4;
        const cycleStart = currentMasonicYearStart(new Date(), startMonth);
        const cycleYear = cycleStart.getUTCFullYear();
        const rec = await prisma.duesRecord.findUnique({
          where: { memberId_lodgeId_year: { memberId, lodgeId: request.lodgeId!, year: cycleYear } },
        });
        if (rec) await ensureInstalmentsForRecord(prisma, rec.id, cycleStart, lodge.annualDues);
      }
    }

    return updated;
  });

  // POST /treasurer/dues/:id/instalments/:instalmentId/mark-paid
  fastify.post('/dues/:id/instalments/:instalmentId/mark-paid', async (request, reply) => {
    const { id, instalmentId } = request.params as { id: string; instalmentId: string };
    const body = request.body as { amount?: number; method?: string };
    const rec = await prisma.duesRecord.findUnique({ where: { id }, include: { instalments: true } });
    if (!rec || rec.lodgeId !== request.lodgeId) return reply.status(404).send({ error: 'Not found' });
    const inst = rec.instalments.find((i) => i.id === instalmentId);
    if (!inst) return reply.status(404).send({ error: 'Instalment not found' });

    const updated = await prisma.subsInstalment.update({
      where: { id: instalmentId },
      data: { paidDate: new Date(), paidAmount: body.amount ?? inst.expectedAmount, paymentMethod: body.method },
    });

    // If all 12 are now paid, stamp the parent record as fully paid too.
    const all = await prisma.subsInstalment.findMany({ where: { duesRecordId: id } });
    if (all.length > 0 && all.every((i) => i.paidDate)) {
      const total = all.reduce((s, i) => s + (i.paidAmount ?? 0), 0);
      await prisma.duesRecord.update({ where: { id }, data: { paidDate: new Date(), paidAmount: total } });
    }
    return updated;
  });

  // POST /treasurer/dues/:id/mark-paid — record a payment. amount defaults to
  // the full charged amount.
  fastify.post('/dues/:id/mark-paid', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { amount?: number; method?: string };
    const rec = await prisma.duesRecord.findUnique({ where: { id } });
    if (!rec || rec.lodgeId !== request.lodgeId) return reply.status(404).send({ error: 'Not found' });
    const updated = await prisma.duesRecord.update({
      where: { id },
      data: {
        paidDate: new Date(),
        paidAmount: body.amount ?? rec.amount,
        paymentMethod: body.method,
        status: 'CURRENT' as any,
      },
    });
    return updated;
  });

  // POST /treasurer/joining-fees — create a joining fee for an existing member.
  // Auto-uses the lodge's joiningFee unless overridden.
  fastify.post('/joining-fees', async (request, reply) => {
    const body = request.body as { memberId: string; amount?: number; dueDate?: string; notes?: string };
    if (!body.memberId) return reply.status(400).send({ error: 'memberId required' });
    const lodgeId = request.lodgeId!;
    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    const fee = body.amount ?? lodge?.joiningFee;
    if (!fee) return reply.status(400).send({ error: 'No joining fee configured on the lodge' });

    const created = await prisma.joiningFeeRecord.upsert({
      where: { memberId_lodgeId: { memberId: body.memberId, lodgeId } },
      update: { amount: fee, ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}), ...(body.notes !== undefined ? { notes: body.notes } : {}) },
      create: {
        memberId: body.memberId,
        lodgeId,
        amount: fee,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes,
      },
    });
    return created;
  });

  // POST /treasurer/joining-fees/:id/mark-paid
  fastify.post('/joining-fees/:id/mark-paid', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { amount?: number; method?: string };
    const rec = await prisma.joiningFeeRecord.findUnique({ where: { id } });
    if (!rec || rec.lodgeId !== request.lodgeId) return reply.status(404).send({ error: 'Not found' });
    const updated = await prisma.joiningFeeRecord.update({
      where: { id },
      data: { paidDate: new Date(), paidAmount: body.amount ?? rec.amount, paymentMethod: body.method },
    });
    return updated;
  });

  // PUT /treasurer/lodge — update fee config / bank details.
  fastify.put('/lodge', async (request, reply) => {
    const body = request.body as Partial<{
      annualDues: number; joiningFee: number; masonicYearStartMonth: number;
      bankSortCode: string; bankAccount: string; bankAccountName: string;
      diningCost: number; grandLodgeDues: number; provincialDues: number;
    }>;
    const lodgeId = request.lodgeId!;
    if (!request.isSuperAdmin) {
      // Anyone with treasurer/secretary/WM access can edit; for now gate on
      // any UserLodgeAccess role.
      const access = await prisma.userLodgeAccess.findUnique({ where: { userId_lodgeId: { userId: request.user.userId, lodgeId } } });
      if (!access) return reply.status(403).send({ error: 'No access' });
    }
    const updated = await prisma.lodge.update({ where: { id: lodgeId }, data: body });
    return updated;
  });
}
