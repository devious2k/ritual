import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function xeroRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // GET /xero/status — Xero connection status for lodge
  fastify.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const lodge = await prisma.lodge.findUnique({
      where: { id: lodgeId },
      select: {
        xeroTenantId: true,
        xeroLastSyncAt: true,
        settings: true,
      },
    });

    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    return reply.send({
      connected: !!lodge.xeroTenantId,
      tenantId: lodge.xeroTenantId,
      lastSyncAt: lodge.xeroLastSyncAt,
    });
  });

  // POST /xero/connect — Store Xero tenant ID
  fastify.post('/connect', {
    preHandler: [requireRole('TREASURER', 'SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { tenantId } = request.body as { tenantId: string };

    if (!tenantId) {
      return reply.status(400).send({ error: 'tenantId is required' });
    }

    await prisma.lodge.update({
      where: { id: lodgeId },
      data: { xeroTenantId: tenantId },
    });

    return reply.send({ message: 'Xero connected', tenantId });
  });

  // POST /xero/sync — Trigger manual sync
  fastify.post('/sync', {
    preHandler: [requireRole('TREASURER', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const lodge = await prisma.lodge.findUnique({
      where: { id: lodgeId },
      select: { xeroTenantId: true },
    });

    if (!lodge?.xeroTenantId) {
      return reply.status(400).send({ error: 'Xero not connected for this lodge' });
    }

    // Retrieve unsynced transactions since last sync
    const lastSync = await prisma.lodge.findUnique({
      where: { id: lodgeId },
      select: { xeroLastSyncAt: true },
    });

    const unsyncedTransactions = await prisma.transaction.findMany({
      where: {
        account: { lodgeId },
        xeroInvoiceId: null,
        createdAt: lastSync?.xeroLastSyncAt
          ? { gt: lastSync.xeroLastSyncAt }
          : undefined,
      },
      include: {
        account: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Update last sync timestamp
    await prisma.lodge.update({
      where: { id: lodgeId },
      data: { xeroLastSyncAt: new Date() },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'XERO_SYNC',
        entity: 'Lodge',
        entityId: lodgeId,
        details: { transactionsProcessed: unsyncedTransactions.length, manual: true },
        userId: request.user.userId,
        lodgeId,
      },
    });

    return reply.send({
      message: 'Sync triggered',
      transactionsProcessed: unsyncedTransactions.length,
      syncedAt: new Date().toISOString(),
    });
  });

  // GET /xero/sync/history — Recent sync activity
  fastify.get('/sync/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { limit = '10' } = request.query as { limit?: string };

    const history = await prisma.auditLog.findMany({
      where: {
        lodgeId,
        action: 'XERO_SYNC',
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      include: {
        user: { select: { email: true } },
      },
    });

    return reply.send({ history });
  });
}
