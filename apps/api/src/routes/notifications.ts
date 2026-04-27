import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';

export async function notificationRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // GET /notifications — List notifications for current user
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20', isRead } = request.query as {
      page?: string;
      limit?: string;
      isRead?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = { userId: request.user.userId };
    if (isRead === 'true') where.isRead = true;
    if (isRead === 'false') where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
    ]);

    return reply.send({
      notifications,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  });

  // PUT /notifications/:id/read — Mark notification as read
  fastify.put('/:id/read', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const notification = await prisma.notification.findFirst({
      where: { id, userId: request.user.userId },
    });

    if (!notification) {
      return reply.status(404).send({ error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return reply.send(updated);
  });

  // PUT /notifications/read-all — Mark all as read
  fastify.put('/read-all', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await prisma.notification.updateMany({
      where: { userId: request.user.userId, isRead: false },
      data: { isRead: true },
    });

    return reply.send({ updated: result.count });
  });

  // GET /notifications/unread-count — Count of unread notifications
  fastify.get('/unread-count', async (request: FastifyRequest, reply: FastifyReply) => {
    const count = await prisma.notification.count({
      where: { userId: request.user.userId, isRead: false },
    });

    return reply.send({ count });
  });
}
