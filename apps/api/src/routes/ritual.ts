import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth.js';
import { tenantContext, requireLodge } from '../middleware/tenant.js';

/**
 * Builds the per-ceremony position seed from a lodge's current Officer rows.
 * Stewards (which can have multiple holders simultaneously) fan out into
 * STEWARD_1 / STEWARD_2 / STEWARD_3 slots in installation order.
 * Other offices stay 1:1 — first match wins.
 */
async function buildOfficerSeed(
  prisma: PrismaClient,
  lodgeId: string,
): Promise<Array<{ role: string; memberId: string }>> {
  const year = new Date().getFullYear();
  const officers = await prisma.officer.findMany({
    where: { lodgeId, isActive: true, year: { lte: year } },
    orderBy: [{ year: 'desc' }, { createdAt: 'asc' }],
  });
  const used = new Set<string>();
  const result: Array<{ role: string; memberId: string }> = [];
  let stewardSlot = 0;
  for (const o of officers) {
    const office = String(o.office);
    if (office === 'STEWARD') {
      stewardSlot += 1;
      if (stewardSlot > 3) continue;
      result.push({ role: `STEWARD_${stewardSlot}`, memberId: o.memberId });
      continue;
    }
    if (used.has(office)) continue;
    used.add(office);
    result.push({ role: office, memberId: o.memberId });
  }
  return result;
}

/**
 * Ceremony planning routes — ritual block library, position assignments,
 * block assignments. Uses the X-Lodge-Id header for tenant scoping.
 */
export async function ritualRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);

  // ── Library ──────────────────────────────────────────────────────────────

  // GET /ritual/blocks?degree=FIRST|... — returns platform-default + lodge overrides
  fastify.get('/blocks', async (request) => {
    const degree = (request.query as any)?.degree as string | undefined;
    const lodgeId = request.lodgeId ?? null;

    const blocks = await prisma.ritualBlock.findMany({
      where: {
        ...(degree && { degree: degree as any }),
        OR: [
          { lodgeId: null },
          ...(lodgeId ? [{ lodgeId }] : []),
        ],
      },
      orderBy: [{ degree: 'asc' }, { orderHint: 'asc' }, { title: 'asc' }],
    });

    return { blocks };
  });

  // ── Ceremony plans ───────────────────────────────────────────────────────

  // GET /ritual/ceremonies — list ceremony plans for the active lodge
  fastify.get('/ceremonies', { preHandler: [requireLodge] }, async (request) => {
    const lodgeId = request.lodgeId!;
    const plans = await prisma.ceremonyPlan.findMany({
      where: { meeting: { lodgeId } },
      include: {
        meeting: { select: { id: true, date: true, type: true } },
        roles: {
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { blockAssignments: true, rehearsals: true } },
      },
      orderBy: { meeting: { date: 'desc' } },
    });
    return { ceremonies: plans };
  });

  // GET /ritual/ceremonies/:id — full plan with block assignments
  fastify.get('/ceremonies/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await prisma.ceremonyPlan.findUnique({
      where: { id },
      include: {
        meeting: { select: { id: true, date: true, type: true, lodgeId: true } },
        roles: {
          include: { member: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
        },
        blockAssignments: {
          include: {
            ritualBlock: true,
            assignedMember: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!plan) return reply.status(404).send({ error: 'Ceremony not found' });
    if (!request.isSuperAdmin && plan.meeting.lodgeId !== request.lodgeId) {
      return reply.status(403).send({ error: 'No access to this lodge' });
    }
    return plan;
  });

  // POST /ritual/ceremonies — create a new plan tied to a meeting
  fastify.post('/ceremonies', { preHandler: [requireLodge] }, async (request, reply) => {
    const body = request.body as {
      meetingId: string;
      ceremonyType: string;
      degree?: 'FIRST' | 'SECOND' | 'THIRD' | 'INSTALLATION' | 'MARK' | 'HOLY_ROYAL_ARCH' | 'OTHER';
      candidateId?: string;
      notes?: string;
    };
    if (!body.meetingId || !body.ceremonyType) {
      return reply.status(400).send({ error: 'meetingId and ceremonyType are required' });
    }
    const meeting = await prisma.meeting.findUnique({ where: { id: body.meetingId } });
    if (!meeting || meeting.lodgeId !== request.lodgeId) {
      return reply.status(403).send({ error: 'Meeting not in this lodge' });
    }

    const plan = await prisma.ceremonyPlan.create({
      data: {
        meetingId: body.meetingId,
        ceremonyType: body.ceremonyType,
        degree: body.degree as any,
        candidateId: body.candidateId,
        notes: body.notes,
        allocations: {},
      },
    });

    // Stamp the meeting itself so MeetingDetail's badge + summons subject
    // pick up the ceremony without a second round-trip.
    let candidateName: string | undefined;
    if (body.candidateId) {
      const cand = await prisma.candidate.findUnique({
        where: { id: body.candidateId },
        select: { firstName: true, lastName: true },
      });
      if (cand) candidateName = `Bro. ${cand.firstName} ${cand.lastName}`.trim();
    }
    await prisma.meeting.update({
      where: { id: body.meetingId },
      data: {
        ceremonyType: body.ceremonyType,
        ...(candidateName ? { candidateName } : {}),
      },
    });

    // Seed CeremonyRole rows from the lodge's current officers so the wizard
    // opens with sensible defaults.
    const seed = await buildOfficerSeed(prisma, meeting.lodgeId);
    if (seed.length) {
      await prisma.ceremonyRole.createMany({
        data: seed.map((s) => ({ ...s, ceremonyPlanId: plan.id })),
        skipDuplicates: true,
      });
    }

    return reply.status(201).send(plan);
  });

  // POST /ritual/ceremonies/:id/seed-from-officers — top up CeremonyRole rows
  // from the lodge's current officer table without disturbing existing slots.
  fastify.post('/ceremonies/:id/seed-from-officers', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await prisma.ceremonyPlan.findUnique({
      where: { id },
      include: { meeting: { select: { lodgeId: true } } },
    });
    if (!plan) return reply.status(404).send({ error: 'Ceremony not found' });

    const existing = await prisma.ceremonyRole.findMany({ where: { ceremonyPlanId: id } });
    const taken = new Set(existing.map((r) => r.role));

    const seed = await buildOfficerSeed(prisma, plan.meeting.lodgeId);
    const toAdd = seed.filter((s) => !taken.has(s.role));
    if (toAdd.length) {
      await prisma.ceremonyRole.createMany({
        data: toAdd.map((s) => ({ ...s, ceremonyPlanId: id })),
        skipDuplicates: true,
      });
    }

    const result = await prisma.ceremonyRole.findMany({
      where: { ceremonyPlanId: id },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    });
    return { positions: result, added: toAdd.length };
  });

  // PUT /ritual/ceremonies/:id — update header fields
  fastify.put('/ceremonies/:id', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      ceremonyType: string; degree: string; candidateId: string | null;
      notes: string; isConfirmed: boolean;
    }>;
    const updated = await prisma.ceremonyPlan.update({
      where: { id },
      data: {
        ...(body.ceremonyType !== undefined && { ceremonyType: body.ceremonyType }),
        ...(body.degree !== undefined && { degree: body.degree as any }),
        ...(body.candidateId !== undefined && { candidateId: body.candidateId }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.isConfirmed !== undefined && { isConfirmed: body.isConfirmed }),
      },
    });
    return updated;
  });

  // ── Officer position assignments (existing CeremonyRole) ─────────────────

  // PUT /ritual/ceremonies/:id/positions — bulk replace position → member map
  fastify.put('/ceremonies/:id/positions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { positions: Array<{ role: string; memberId: string }> };
    if (!Array.isArray(body?.positions)) {
      return reply.status(400).send({ error: 'positions array required' });
    }
    await prisma.$transaction([
      prisma.ceremonyRole.deleteMany({ where: { ceremonyPlanId: id } }),
      ...body.positions.map((p) =>
        prisma.ceremonyRole.create({
          data: { ceremonyPlanId: id, role: p.role, memberId: p.memberId },
        }),
      ),
    ]);
    const positions = await prisma.ceremonyRole.findMany({
      where: { ceremonyPlanId: id },
      include: { member: { select: { id: true, firstName: true, lastName: true } } },
    });
    return { positions };
  });

  // ── Block assignments ────────────────────────────────────────────────────

  /**
   * POST /ritual/ceremonies/:id/auto-fill — reset block assignments by mapping
   * each ritual block's defaultOffice to the member currently in that
   * position on the ceremony. Idempotent; existing isOverride=true assignments
   * are preserved.
   */
  fastify.post('/ceremonies/:id/auto-fill', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await prisma.ceremonyPlan.findUnique({
      where: { id },
      include: { meeting: { select: { lodgeId: true } } },
    });
    if (!plan) return reply.status(404).send({ error: 'Ceremony not found' });
    const lodgeId = plan.meeting.lodgeId;

    if (!plan.degree) return reply.status(400).send({ error: 'Set the degree before auto-fill' });

    const blocks = await prisma.ritualBlock.findMany({
      where: {
        degree: plan.degree,
        OR: [{ lodgeId: null }, { lodgeId }],
      },
      orderBy: { orderHint: 'asc' },
    });

    const positions = await prisma.ceremonyRole.findMany({
      where: { ceremonyPlanId: id },
    });
    const officeToMember = new Map(positions.map((p) => [p.role, p.memberId]));

    const existing = await prisma.ceremonyBlockAssignment.findMany({
      where: { ceremonyPlanId: id },
    });
    const existingByBlock = new Map(existing.map((a) => [a.ritualBlockId, a]));

    const ops = blocks.map((block, idx) => {
      const prior = existingByBlock.get(block.id);
      // Preserve user overrides — never trample them.
      if (prior?.isOverride) return null;
      const candidateMemberId = block.defaultOffice
        ? officeToMember.get(String(block.defaultOffice)) ?? null
        : null;
      return prisma.ceremonyBlockAssignment.upsert({
        where: { ceremonyPlanId_ritualBlockId: { ceremonyPlanId: id, ritualBlockId: block.id } },
        update: {
          assignedMemberId: candidateMemberId,
          orderIndex: idx,
          isOverride: false,
        },
        create: {
          ceremonyPlanId: id,
          ritualBlockId: block.id,
          assignedMemberId: candidateMemberId,
          orderIndex: idx,
          isOverride: false,
        },
      });
    });
    await prisma.$transaction(ops.filter((o): o is NonNullable<typeof o> => o !== null));

    const result = await prisma.ceremonyBlockAssignment.findMany({
      where: { ceremonyPlanId: id },
      include: {
        ritualBlock: true,
        assignedMember: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });
    return { blockAssignments: result };
  });

  // PUT /ritual/ceremonies/:id/blocks/:blockId — override a single assignment
  fastify.put('/ceremonies/:id/blocks/:blockId', async (request) => {
    const { id, blockId } = request.params as { id: string; blockId: string };
    const body = request.body as { assignedMemberId: string | null; notes?: string; orderIndex?: number };
    const upserted = await prisma.ceremonyBlockAssignment.upsert({
      where: { ceremonyPlanId_ritualBlockId: { ceremonyPlanId: id, ritualBlockId: blockId } },
      update: {
        assignedMemberId: body.assignedMemberId,
        notes: body.notes,
        ...(body.orderIndex !== undefined && { orderIndex: body.orderIndex }),
        isOverride: true,
      },
      create: {
        ceremonyPlanId: id,
        ritualBlockId: blockId,
        assignedMemberId: body.assignedMemberId,
        notes: body.notes,
        orderIndex: body.orderIndex ?? 0,
        isOverride: true,
      },
      include: {
        ritualBlock: true,
        assignedMember: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return upserted;
  });

  // PUT /ritual/ceremonies/:id/blocks — bulk reorder
  fastify.put('/ceremonies/:id/blocks', async (request) => {
    const { id } = request.params as { id: string };
    const body = request.body as { order: Array<{ blockId: string; orderIndex: number }> };
    await prisma.$transaction(
      body.order.map((o) =>
        prisma.ceremonyBlockAssignment.update({
          where: { ceremonyPlanId_ritualBlockId: { ceremonyPlanId: id, ritualBlockId: o.blockId } },
          data: { orderIndex: o.orderIndex },
        }),
      ),
    );
    return { ok: true };
  });
}
