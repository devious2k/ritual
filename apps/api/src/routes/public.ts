import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function publicRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Anonymous tenant lookup for subdomain bootstrap.
  fastify.get('/tenants/by-subdomain/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const lodge = await prisma.lodge.findFirst({
      where: { slug, isActive: true },
      select: {
        id: true, name: true, number: true, slug: true, subdomain: true,
        siteMode: true, domainStatus: true, crestUrl: true, venue: true,
        venueAddress: true, meetingDay: true,
      },
    });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });
    return lodge;
  });

  fastify.get('/lodges/:id/site', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const lodge = await prisma.lodge.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        number: true,
        venue: true,
        venueAddress: true,
        meetingDay: true,
        meetingMonths: true,
        diningCost: true,
        tylerPhone: true,
        crestUrl: true,
        settings: true,
      },
    });

    if (!lodge) {
      return reply.status(404).send({ error: 'Lodge not found' });
    }

    const meetings = await prisma.meeting.findMany({
      where: {
        lodgeId: id,
        date: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
      select: {
        id: true,
        type: true,
        date: true,
        startTime: true,
        venue: true,
        ceremonyType: true,
      },
      orderBy: { date: 'asc' },
      take: 5,
    });

    return reply.send({
      lodge,
      meetings,
    });
  });
}
