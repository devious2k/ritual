import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function lodgeRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // GET /lodges — List lodges
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20', search } = request.query as {
      page?: string;
      limit?: string;
      search?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    let where: any = {};

    if (request.user.role === 'PROVINCE_ADMIN') {
      // Province admin sees all lodges in their province
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { provinceId: true },
      });
      if (user?.provinceId) {
        where.provinceId = user.provinceId;
      }
    } else {
      // Other users see only lodges they have access to
      const access = await prisma.userLodgeAccess.findMany({
        where: { userId: request.user.userId },
        select: { lodgeId: true },
      });
      where.id = { in: access.map((a) => a.lodgeId) };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { number: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [lodges, total] = await Promise.all([
      prisma.lodge.findMany({
        where,
        include: {
          province: { select: { name: true } },
          _count: { select: { members: true } },
        },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.lodge.count({ where }),
    ]);

    return reply.send({
      lodges,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  });

  // GET /lodges/:id — Single lodge details
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const lodge = await prisma.lodge.findUnique({
      where: { id },
      include: {
        province: { select: { id: true, name: true } },
        officers: {
          where: { isActive: true },
          include: { member: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { office: 'asc' },
        },
        _count: {
          select: {
            members: true,
            meetings: true,
          },
        },
      },
    });

    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    // Non-province-admin must have access
    if (request.user.role !== 'PROVINCE_ADMIN') {
      const access = await prisma.userLodgeAccess.findFirst({
        where: { userId: request.user.userId, lodgeId: id },
      });
      if (!access) {
        return reply.status(403).send({ error: 'No access to this lodge' });
      }
    }

    return reply.send(lodge);
  });

  // POST /lodges — Create lodge (PROVINCE_ADMIN only)
  fastify.post('/', {
    preHandler: [requireRole('PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      number: string;
      provinceId: string;
      meetingDay?: string;
      meetingMonths?: string;
      venue?: string;
      venueAddress?: string;
      diningCost?: number;
      annualDues?: number;
      consecrationDate?: string;
    };

    if (!body.name || !body.number || !body.provinceId) {
      return reply.status(400).send({ error: 'name, number, and provinceId are required' });
    }

    // Verify province exists
    const province = await prisma.province.findUnique({ where: { id: body.provinceId } });
    if (!province) {
      return reply.status(404).send({ error: 'Province not found' });
    }

    // Check uniqueness within province
    const existing = await prisma.lodge.findFirst({
      where: { number: body.number, provinceId: body.provinceId },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Lodge number already exists in this province' });
    }

    const lodge = await prisma.lodge.create({
      data: {
        name: body.name,
        number: body.number,
        provinceId: body.provinceId,
        meetingDay: body.meetingDay,
        meetingMonths: body.meetingMonths,
        venue: body.venue,
        venueAddress: body.venueAddress,
        diningCost: body.diningCost,
        annualDues: body.annualDues,
        consecrationDate: body.consecrationDate ? new Date(body.consecrationDate) : undefined,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'Lodge',
        entityId: lodge.id,
        details: { name: lodge.name, number: lodge.number },
        userId: request.user.userId,
        lodgeId: lodge.id,
      },
    });

    return reply.status(201).send(lodge);
  });

  // PUT /lodges/:id — Update lodge settings
  fastify.put('/:id', {
    preHandler: [requireRole('PROVINCE_ADMIN', 'WORSHIPFUL_MASTER', 'SECRETARY')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, any>;

    const lodge = await prisma.lodge.findUnique({ where: { id } });
    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    // Prevent changing critical fields unless province admin
    const allowedFields = [
      'name', 'meetingDay', 'meetingMonths', 'venue', 'venueAddress',
      'tylerPhone', 'diningCost', 'annualDues', 'grandLodgeDues',
      'provincialDues', 'bylawsUrl', 'crestUrl', 'settings',
    ];

    if (request.user.role === 'PROVINCE_ADMIN') {
      allowedFields.push('number', 'provinceId', 'consecrationDate');
    }

    const data: Record<string, any> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        if (key === 'consecrationDate' && typeof body[key] === 'string') {
          data[key] = new Date(body[key]);
        } else {
          data[key] = body[key];
        }
      }
    }

    const updated = await prisma.lodge.update({
      where: { id },
      data,
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'Lodge',
        entityId: id,
        details: data,
        userId: request.user.userId,
        lodgeId: id,
      },
    });

    return reply.send(updated);
  });
}
