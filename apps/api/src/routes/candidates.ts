import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';
import { createAuditLog } from '../services/auditService.js';
import { encrypt } from '../services/encryptionService.js';

export async function candidateRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // GET /candidates — List candidates for lodge
  fastify.get('/', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { status } = request.query as { status?: string };

    const where: any = { lodgeId };
    if (status) {
      where.status = status;
    }

    const candidates = await prisma.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        occupation: true,
        status: true,
        proposalFormDate: true,
        committeeDate: true,
        ballotDate: true,
        initiationDate: true,
        createdAt: true,
      },
    });

    return reply.send({ data: candidates });
  });

  // GET /candidates/:id — Single candidate
  fastify.get('/:id', {
    preHandler: [authenticate, lodgeScope],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const candidate = await prisma.candidate.findFirst({
      where: { id, lodgeId },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    // Redact ballot result unless user is WM or Secretary
    const userRole = (request as any).lodgeRole || request.user.role;
    const canSeeBallot = ['WORSHIPFUL_MASTER', 'SECRETARY', 'PROVINCE_ADMIN'].includes(userRole);

    return reply.send({
      ...candidate,
      ballotResult: canSeeBallot ? candidate.ballotResult : undefined,
    });
  });

  // POST /candidates — Create candidate
  fastify.post('/', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'MENTOR', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      address?: string;
      dateOfBirth?: string;
      occupation?: string;
      status?: string;
      proposerId?: string;
      seconderId?: string;
      proposalFormDate?: string;
      notes?: string;
    };

    if (!body.firstName || !body.lastName) {
      return reply.status(400).send({ error: 'firstName and lastName are required' });
    }

    const candidate = await prisma.candidate.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        address: body.address,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
        occupation: body.occupation,
        status: (body.status as any) || 'ENQUIRY',
        proposerId: body.proposerId,
        seconderId: body.seconderId,
        proposalFormDate: body.proposalFormDate ? new Date(body.proposalFormDate) : undefined,
        notes: body.notes,
        lodgeId,
      },
    });

    await createAuditLog(prisma, {
      action: 'CREATE',
      entity: 'Candidate',
      entityId: candidate.id,
      details: { firstName: body.firstName, lastName: body.lastName, status: candidate.status },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.status(201).send(candidate);
  });

  // PUT /candidates/:id — Update candidate (status transitions)
  fastify.put('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'MENTOR', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await prisma.candidate.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    const dateFields = ['dateOfBirth', 'proposalFormDate', 'committeeDate', 'ballotDate', 'initiationDate'];
    const updateData: Record<string, any> = {};

    const allowedFields = [
      'firstName', 'lastName', 'email', 'phone', 'address', 'dateOfBirth',
      'occupation', 'status', 'proposerId', 'seconderId', 'proposalFormDate',
      'committeeDate', 'ballotDate', 'initiationDate', 'memberId', 'notes',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (dateFields.includes(field) && body[field]) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const candidate = await prisma.candidate.update({
      where: { id },
      data: updateData,
    });

    await createAuditLog(prisma, {
      action: 'UPDATE',
      entity: 'Candidate',
      entityId: id,
      details: { previousStatus: existing.status, ...updateData },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send(candidate);
  });

  // PUT /candidates/:id/ballot — Record ballot result (WM only, encrypted)
  fastify.put('/:id/ballot', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as {
      result: 'APPROVED' | 'REJECTED';
      ballotDate?: string;
    };

    if (!body.result || !['APPROVED', 'REJECTED'].includes(body.result)) {
      return reply.status(400).send({ error: 'result must be APPROVED or REJECTED' });
    }

    const existing = await prisma.candidate.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    const encryptedResult = encrypt(body.result);

    const newStatus = body.result === 'APPROVED' ? 'BALLOT_APPROVED' : 'BALLOT_REJECTED';

    const candidate = await prisma.candidate.update({
      where: { id },
      data: {
        ballotResult: encryptedResult,
        ballotDate: body.ballotDate ? new Date(body.ballotDate) : new Date(),
        status: newStatus as any,
      },
    });

    await createAuditLog(prisma, {
      action: 'UPDATE',
      entity: 'Candidate',
      entityId: id,
      details: { action: 'ballot_recorded', status: newStatus },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send({
      ...candidate,
      ballotResult: body.result, // Return plaintext to WM
    });
  });

  // DELETE /candidates/:id — Remove candidate
  fastify.delete('/:id', {
    preHandler: [
      authenticate,
      lodgeScope,
      requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'),
    ],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await prisma.candidate.findFirst({ where: { id, lodgeId } });
    if (!existing) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    await prisma.candidate.delete({ where: { id } });

    await createAuditLog(prisma, {
      action: 'DELETE',
      entity: 'Candidate',
      entityId: id,
      details: { firstName: existing.firstName, lastName: existing.lastName },
      userId: request.user.userId,
      lodgeId,
      ipAddress: request.ip,
    });

    return reply.send({ message: 'Candidate removed' });
  });
}
