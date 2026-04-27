import { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    lodgeId?: string;
    isSuperAdmin: boolean;
  }
}

const TENANT_HEADER = 'x-lodge-id';

/**
 * Reads X-Lodge-Id from the request, validates the user has access to that
 * lodge, and stamps `request.lodgeId` for downstream queries.
 *
 * - SUPER_ADMIN may set any lodge id (or omit the header for cross-tenant ops).
 * - Other roles must have a UserLodgeAccess row matching the requested lodge.
 * - The header is optional on routes that genuinely don't need a tenant
 *   (the tenant middleware doesn't reject when missing — individual routes
 *   call requireLodge() if they need it).
 */
export async function tenantContext(request: FastifyRequest, reply: FastifyReply) {
  const { user } = request;
  if (!user) return; // tenantContext should run after authenticate

  request.isSuperAdmin = user.role === 'SUPER_ADMIN';

  const headerVal = request.headers[TENANT_HEADER];
  const requested = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (!requested) {
    request.lodgeId = user.lodgeId;
    return;
  }

  if (request.isSuperAdmin) {
    request.lodgeId = requested;
    return;
  }

  const access = await request.server.prisma.userLodgeAccess.findUnique({
    where: { userId_lodgeId: { userId: user.userId, lodgeId: requested } },
  });
  if (!access) {
    return reply.status(403).send({ error: 'No access to the requested lodge' });
  }
  request.lodgeId = requested;
}

export async function requireLodge(request: FastifyRequest, reply: FastifyReply) {
  if (!request.lodgeId) {
    return reply.status(400).send({ error: 'X-Lodge-Id header required for this endpoint' });
  }
}

export async function requireSuperAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.isSuperAdmin) {
    return reply.status(403).send({ error: 'Super admin access required' });
  }
}
