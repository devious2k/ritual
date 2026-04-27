import { FastifyRequest, FastifyReply } from 'fastify';

export async function lodgeScope(request: FastifyRequest, reply: FastifyReply) {
  if (request.user.role === 'SUPER_ADMIN' || request.user.role === 'PROVINCE_ADMIN') return;

  const headerVal = request.headers['x-lodge-id'];
  const headerLodgeId = Array.isArray(headerVal) ? headerVal[0] : headerVal;

  const lodgeId = (request.params as Record<string, string>).lodgeId
    || (request.query as Record<string, string>).lodgeId
    || headerLodgeId
    || request.user.lodgeId;

  if (!lodgeId) {
    return reply.status(400).send({ error: 'No lodge context. Specify lodgeId.' });
  }

  // Verify user has access to this lodge
  const access = await request.server.prisma.userLodgeAccess.findFirst({
    where: { userId: request.user.userId, lodgeId },
  });

  if (!access) {
    return reply.status(403).send({ error: 'No access to this lodge' });
  }

  // Attach lodgeId and lodge role to request
  (request as any).lodgeId = lodgeId;
  (request as any).lodgeRole = access.role;
}
