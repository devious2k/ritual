import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function diningRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET /meeting/:meetingId — dining fees for a meeting
  fastify.get('/meeting/:meetingId', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { meetingId } = request.params as { meetingId: string };

    // Verify meeting belongs to this lodge
    const meeting = await fastify.prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
      select: { id: true, date: true, diningCost: true, diningMenu: true },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    const fees = await fastify.prisma.diningFee.findMany({
      where: { meetingId },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { member: { lastName: 'asc' } },
    });

    const totalCollected = fees.filter((f) => f.status === 'SUCCEEDED').reduce((sum, f) => sum + f.amount + (f.guestAmount ?? 0), 0);
    const totalOutstanding = fees.filter((f) => f.status === 'PENDING').reduce((sum, f) => sum + f.amount + (f.guestAmount ?? 0), 0);

    return reply.send({
      meeting,
      fees,
      summary: {
        total: fees.length,
        paid: fees.filter((f) => f.status === 'SUCCEEDED').length,
        pending: fees.filter((f) => f.status === 'PENDING').length,
        totalCollected,
        totalOutstanding,
      },
    });
  });

  // POST / — create dining fee
  fastify.post('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId, meetingId, amount, guestCount, guestAmount } = request.body as {
      memberId: string;
      meetingId: string;
      amount: number;
      guestCount?: number;
      guestAmount?: number;
    };

    // Verify meeting belongs to lodge
    const meeting = await fastify.prisma.meeting.findFirst({
      where: { id: meetingId, lodgeId },
    });
    if (!meeting) {
      return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    // Verify member belongs to lodge
    const member = await fastify.prisma.member.findFirst({
      where: { id: memberId, lodgeId },
    });
    if (!member) {
      return reply.status(404).send({ error: 'Member not found in this lodge' });
    }

    const fee = await fastify.prisma.diningFee.create({
      data: {
        memberId,
        meetingId,
        amount,
        guestCount: guestCount ?? 0,
        guestAmount: guestAmount ?? null,
        status: 'PENDING',
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        meeting: { select: { id: true, date: true } },
      },
    });

    return reply.status(201).send(fee);
  });

  // PUT /:id — update dining fee
  fastify.put('/:id', {
    preHandler: [...preHandler, requireRole('TREASURER', 'SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.diningFee.findFirst({
      where: { id, meeting: { lodgeId } },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Dining fee not found' });
    }

    const data: any = {};
    if (body.amount !== undefined) data.amount = body.amount;
    if (body.guestCount !== undefined) data.guestCount = body.guestCount;
    if (body.guestAmount !== undefined) data.guestAmount = body.guestAmount;
    if (body.status !== undefined) data.status = body.status;
    if (body.paidDate !== undefined) data.paidDate = body.paidDate ? new Date(body.paidDate) : null;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod;

    const fee = await fastify.prisma.diningFee.update({
      where: { id },
      data,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        meeting: { select: { id: true, date: true } },
      },
    });

    return reply.send(fee);
  });

  // GET /outstanding — list unpaid dining fees
  fastify.get('/outstanding', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const fees = await fastify.prisma.diningFee.findMany({
      where: {
        status: 'PENDING',
        meeting: { lodgeId },
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        meeting: { select: { id: true, date: true, type: true } },
      },
      orderBy: { meeting: { date: 'desc' } },
    });

    const totalOutstanding = fees.reduce((sum, f) => sum + f.amount + (f.guestAmount ?? 0), 0);

    return reply.send({
      fees,
      totalOutstanding,
      count: fees.length,
    });
  });
}
