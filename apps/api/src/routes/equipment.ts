import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function equipmentRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list equipment for lodge
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { category, condition } = request.query as { category?: string; condition?: string };

    const where: any = { lodgeId };
    if (category) where.category = category;
    if (condition) where.condition = condition;

    const equipment = await fastify.prisma.lodgeEquipment.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return reply.send(equipment);
  });

  // POST / — add equipment (DC, SECRETARY)
  fastify.post('/', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { name, category, condition, location, notes, photoUrl } = request.body as {
      name: string;
      category: string;
      condition?: string;
      location?: string;
      notes?: string;
      photoUrl?: string;
    };

    const item = await fastify.prisma.lodgeEquipment.create({
      data: {
        name,
        category,
        condition,
        location,
        notes,
        photoUrl,
        lodgeId,
      },
    });

    return reply.status(201).send(item);
  });

  // PUT /:id — update equipment
  fastify.put('/:id', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, any>;

    const existing = await fastify.prisma.lodgeEquipment.findFirst({
      where: { id, lodgeId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Equipment not found' });
    }

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.category !== undefined) data.category = body.category;
    if (body.condition !== undefined) data.condition = body.condition;
    if (body.location !== undefined) data.location = body.location;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.photoUrl !== undefined) data.photoUrl = body.photoUrl;
    if (body.lastCheckedDate !== undefined) data.lastCheckedDate = body.lastCheckedDate ? new Date(body.lastCheckedDate) : null;

    const item = await fastify.prisma.lodgeEquipment.update({
      where: { id },
      data,
    });

    return reply.send(item);
  });

  // DELETE /:id — remove equipment
  fastify.delete('/:id', {
    preHandler: [...preHandler, requireRole('DIRECTOR_OF_CEREMONIES', 'SECRETARY', 'WORSHIPFUL_MASTER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await fastify.prisma.lodgeEquipment.findFirst({
      where: { id, lodgeId },
    });
    if (!existing) {
      return reply.status(404).send({ error: 'Equipment not found' });
    }

    await fastify.prisma.lodgeEquipment.delete({ where: { id } });

    return reply.status(204).send();
  });
}
