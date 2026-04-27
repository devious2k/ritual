import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function provinceRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // GET /provinces — List provinces
  fastify.get('/', {
    preHandler: [requireRole('PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const provinces = await prisma.province.findMany({
      include: {
        _count: { select: { lodges: true } },
      },
      orderBy: { name: 'asc' },
    });

    return reply.send({ provinces });
  });

  // GET /provinces/:id — Single province with lodge count
  fastify.get('/:id', {
    preHandler: [requireRole('PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const province = await prisma.province.findUnique({
      where: { id },
      include: {
        lodges: {
          select: {
            id: true,
            name: true,
            number: true,
            venue: true,
            meetingDay: true,
            stripeOnboardingComplete: true,
            _count: { select: { members: true } },
          },
          orderBy: { number: 'asc' },
        },
        _count: { select: { lodges: true, users: true } },
      },
    });

    if (!province) {
      return reply.status(404).send({ error: 'Province not found' });
    }

    return reply.send(province);
  });

  // PUT /provinces/:id — Update province
  fastify.put('/:id', {
    preHandler: [requireRole('PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      number?: string;
      district?: string;
      settings?: any;
    };

    const province = await prisma.province.findUnique({ where: { id } });
    if (!province) {
      return reply.status(404).send({ error: 'Province not found' });
    }

    const data: Record<string, any> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.number !== undefined) data.number = body.number;
    if (body.district !== undefined) data.district = body.district;
    if (body.settings !== undefined) data.settings = body.settings;

    const updated = await prisma.province.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Province',
        entityId: id,
        details: data,
        userId: request.user.userId,
      },
    });

    return reply.send(updated);
  });
}
