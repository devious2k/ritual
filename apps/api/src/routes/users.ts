import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function userRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // GET /users — List users
  fastify.get('/', {
    preHandler: [requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '20', search, role } = request.query as {
      page?: string;
      limit?: string;
      search?: string;
      role?: string;
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    const lodgeId = (request as any).lodgeId;

    let where: any = {};

    if (request.user.role === 'PROVINCE_ADMIN') {
      // Province admin sees all users in their province's lodges
      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: { provinceId: true },
      });
      if (user?.provinceId) {
        where.OR = [
          { provinceId: user.provinceId },
          { lodgeAccess: { some: { lodge: { provinceId: user.provinceId } } } },
        ];
      }
    } else {
      // Others see users with access to their lodge
      where.lodgeAccess = { some: { lodgeId } };
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { member: { firstName: { contains: search, mode: 'insensitive' } } },
            { member: { lastName: { contains: search, mode: 'insensitive' } } },
          ],
        },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          member: { select: { id: true, firstName: true, lastName: true } },
          lodgeAccess: {
            select: {
              lodgeId: true,
              role: true,
              lodge: { select: { name: true, number: true } },
            },
          },
        },
        orderBy: { email: 'asc' },
        skip,
        take,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.send({
      users,
      pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) },
    });
  });

  // GET /users/:id — Single user
  fastify.get('/:id', {
    preHandler: [requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            degree: true,
            status: true,
          },
        },
        lodgeAccess: {
          select: {
            id: true,
            lodgeId: true,
            role: true,
            createdAt: true,
            lodge: { select: { name: true, number: true } },
          },
        },
        province: { select: { id: true, name: true } },
      },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return reply.send(user);
  });

  // PUT /users/:id — Update user (role, isActive)
  fastify.put('/:id', {
    preHandler: [requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      role?: string;
      isActive?: boolean;
      email?: string;
    };

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    // Only PROVINCE_ADMIN can change roles to admin-level
    const adminRoles = ['PROVINCE_ADMIN', 'WORSHIPFUL_MASTER'];
    if (body.role && adminRoles.includes(body.role) && request.user.role !== 'PROVINCE_ADMIN') {
      return reply.status(403).send({ error: 'Only Province Admin can assign this role' });
    }

    // Prevent self-deactivation
    if (id === request.user.userId && body.isActive === false) {
      return reply.status(400).send({ error: 'Cannot deactivate your own account' });
    }

    const data: Record<string, any> = {};
    if (body.role !== undefined) data.role = body.role;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.email !== undefined) data.email = body.email.toLowerCase();

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        details: data,
        userId: request.user.userId,
        lodgeId: (request as any).lodgeId,
      },
    });

    return reply.send(updated);
  });

  // POST /users/:id/lodge-access — Grant lodge access
  fastify.post('/:id/lodge-access', {
    preHandler: [requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { lodgeId, role = 'MEMBER' } = request.body as { lodgeId: string; role?: string };

    if (!lodgeId) {
      return reply.status(400).send({ error: 'lodgeId is required' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    // Check if access already exists
    const existing = await prisma.userLodgeAccess.findUnique({
      where: { userId_lodgeId: { userId: id, lodgeId } },
    });

    if (existing) {
      // Update role if different
      const updated = await prisma.userLodgeAccess.update({
        where: { id: existing.id },
        data: { role: role as any },
      });
      return reply.send(updated);
    }

    const access = await prisma.userLodgeAccess.create({
      data: {
        userId: id,
        lodgeId,
        role: role as any,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        entity: 'UserLodgeAccess',
        entityId: access.id,
        details: { userId: id, lodgeId, role },
        userId: request.user.userId,
        lodgeId,
      },
    });

    return reply.status(201).send(access);
  });

  // DELETE /users/:id/lodge-access/:lodgeId — Revoke lodge access
  fastify.delete('/:id/lodge-access/:lodgeId', {
    preHandler: [requireRole('SECRETARY', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, lodgeId } = request.params as { id: string; lodgeId: string };

    // Prevent revoking own access
    if (id === request.user.userId) {
      return reply.status(400).send({ error: 'Cannot revoke your own lodge access' });
    }

    const access = await prisma.userLodgeAccess.findUnique({
      where: { userId_lodgeId: { userId: id, lodgeId } },
    });

    if (!access) {
      return reply.status(404).send({ error: 'Lodge access not found' });
    }

    await prisma.userLodgeAccess.delete({
      where: { id: access.id },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        entity: 'UserLodgeAccess',
        entityId: access.id,
        details: { userId: id, lodgeId },
        userId: request.user.userId,
        lodgeId,
      },
    });

    return reply.send({ message: 'Lodge access revoked' });
  });
}
