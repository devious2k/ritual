import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function publicRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  // Streams a lodge crest from the inline data URL stored on Lodge.crestUrl.
  // Used by transactional emails (Gmail, Outlook etc. strip data: URIs from
  // <img src>, so emails reference this real HTTPS URL instead).
  fastify.get('/_lodges/:lodgeId/crest', async (request, reply) => {
    const { lodgeId } = request.params as { lodgeId: string };
    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId }, select: { crestUrl: true } });
    if (!lodge?.crestUrl) return reply.status(404).send({ error: 'No crest set' });
    const m = lodge.crestUrl.match(/^data:image\/(png|jpe?g);base64,(.*)$/);
    if (!m) return reply.status(404).send({ error: 'Crest not in expected format' });
    const buf = Buffer.from(m[2], 'base64');
    return reply
      .header('Content-Type', m[1].startsWith('jp') ? 'image/jpeg' : 'image/png')
      .header('Cache-Control', 'public, max-age=86400')
      .send(buf);
  });

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
