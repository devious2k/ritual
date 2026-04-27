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
      select: { id: true, firstName: true, lastName: true, status: true },
    });

    const dues = await prisma.duesRecord.findMany({
      where: { lodgeId, year: cycleYear },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
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
      return {
        memberId: m.id,
        memberName: `${m.firstName} ${m.lastName}`,
        recordId: rec?.id ?? null,
        amount: rec?.amount ?? lodge.annualDues ?? null,
        status: rec?.status ?? 'CURRENT',
        dueDate: rec?.dueDate ?? cycleStart,
        paidDate: rec?.paidDate ?? null,
        paidAmount: rec?.paidAmount ?? null,
      };
    });

    const subsCharged = dueRows.reduce((s, r) => s + (r.amount ?? 0), 0);
    const subsCollected = dueRows.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
    const subsOutstanding = subsCharged - subsCollected;
    const subsCollectedCount = dueRows.filter((r) => r.paidDate).length;

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

    return { rolled: created.count, year: cycleYear };
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
