import { FastifyRequest, FastifyReply } from 'fastify';
import { Role } from '@prisma/client';

export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // SUPER_ADMIN is always allowed.
    if (request.user.role === 'SUPER_ADMIN') return;
    const userRole = (request as any).lodgeRole || request.user.role;
    if (!roles.includes(userRole as Role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }
  };
}
