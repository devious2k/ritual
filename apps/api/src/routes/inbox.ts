import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

export async function inboxRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);

  // GET /inbox/lodge/:lodgeId — full inbox for the lodge (officers + admins)
  fastify.get('/lodge/:lodgeId', async (request, reply) => {
    const { lodgeId } = request.params as { lodgeId: string };
    if (!request.isSuperAdmin && request.lodgeId !== lodgeId) {
      return reply.status(403).send({ error: 'No access to this lodge' });
    }
    const limit = Math.min(parseInt((request.query as any)?.limit ?? '50', 10) || 50, 200);
    const messages = await prisma.inboundMessage.findMany({
      where: { lodgeId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    return { messages };
  });

  // GET /inbox/me — messages routed to the calling user
  fastify.get('/me', async (request) => {
    const limit = Math.min(parseInt((request.query as any)?.limit ?? '50', 10) || 50, 200);
    const messages = await prisma.inboundMessage.findMany({
      where: { deliveredToUserId: request.user.userId },
      orderBy: { receivedAt: 'desc' },
      take: limit,
    });
    return { messages };
  });
}
