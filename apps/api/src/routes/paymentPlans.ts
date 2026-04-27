import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext, requireLodge } from '../middleware/tenant.js';
import { proposePaymentPlan, approvePaymentPlan } from '../services/paymentPlan.js';
import { sendPaymentPlanEmail } from '../services/paymentPlanEmail.js';

/**
 * Year-1 payment plans for initiates.
 *
 * Workflow: Membership Officer (or WM) calls /propose with circumstances
 *           → Treasurer reviews on /finance, calls /approve
 *           → /send-email dispatches the branded HTML plan to the candidate.
 */

export async function paymentPlanRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);
  fastify.addHook('preHandler', requireLodge);

  fastify.get('/', async (request) => {
    const lodgeId = request.lodgeId!;
    const status = (request.query as any)?.status as string | undefined;
    return prisma.paymentPlan.findMany({
      where: { lodgeId, ...(status ? { status: status as any } : {}) },
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, email: true, initiationDate: true } },
        instalments: { orderBy: { sequence: 'asc' } },
        proposedBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
      },
      orderBy: { proposedAt: 'desc' },
    });
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const plan = await prisma.paymentPlan.findFirst({
      where: { id, lodgeId: request.lodgeId! },
      include: {
        candidate: true,
        instalments: { orderBy: { sequence: 'asc' } },
        proposedBy: { select: { id: true, email: true } },
        approvedBy: { select: { id: true, email: true } },
      },
    });
    if (!plan) return reply.status(404).send({ error: 'Not found' });
    return plan;
  });

  fastify.post('/propose', async (request, reply) => {
    const body = request.body as {
      candidateId: string;
      monthsToSpread: number;
      cadence: 'MONTHLY' | 'QUARTERLY' | 'LUMP';
      lumpSumPortion?: number;
      candidateCircumstances?: string;
      notes?: string;
    };
    if (!body.candidateId || !body.monthsToSpread || !body.cadence) {
      return reply.status(400).send({ error: 'candidateId, monthsToSpread, cadence are required' });
    }
    try {
      const plan = await proposePaymentPlan(prisma, request.lodgeId!, {
        ...body,
        proposedById: request.user.userId,
      });
      return reply.status(201).send(plan);
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  fastify.post('/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const plan = await approvePaymentPlan(prisma, request.lodgeId!, id, request.user.userId);
      return plan;
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  fastify.post('/:id/send-email', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await sendPaymentPlanEmail(prisma, request.lodgeId!, id);
      return { ok: true };
    } catch (e: any) {
      return reply.status(400).send({ error: e.message });
    }
  });

  fastify.post('/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string };
    const plan = await prisma.paymentPlan.findFirst({ where: { id, lodgeId: request.lodgeId! } });
    if (!plan) return reply.status(404).send({ error: 'Not found' });
    return prisma.paymentPlan.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: body.reason },
    });
  });

  fastify.post('/:id/instalments/:instalmentId/mark-paid', async (request, reply) => {
    const { id, instalmentId } = request.params as { id: string; instalmentId: string };
    const body = request.body as { amount?: number; method?: string };
    const plan = await prisma.paymentPlan.findFirst({ where: { id, lodgeId: request.lodgeId! }, include: { instalments: true } });
    if (!plan) return reply.status(404).send({ error: 'Plan not found' });
    const inst = plan.instalments.find((i) => i.id === instalmentId);
    if (!inst) return reply.status(404).send({ error: 'Instalment not found' });

    const updated = await prisma.paymentPlanInstalment.update({
      where: { id: instalmentId },
      data: { paidDate: new Date(), paidAmount: body.amount ?? inst.amount, paymentMethod: body.method },
    });

    // If every instalment now has a paidDate, mark the plan complete.
    const all = await prisma.paymentPlanInstalment.findMany({ where: { planId: id } });
    if (all.every((i) => i.paidDate)) {
      await prisma.paymentPlan.update({ where: { id }, data: { status: 'COMPLETED' } });
    }
    return updated;
  });
}
