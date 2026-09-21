import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

/**
 * Lectures — the lodge's library of papers for delivery in open lodge.
 *
 * Restricted throughout. The Director of Ceremonies programmes the season from
 * here, the Worshipful Master approves it, and administrators maintain the
 * platform library. No other role sees this module at all — these are papers
 * for brethren, held behind the same door as everything else.
 */
const CAN_VIEW = ['DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'] as const;
const CAN_EDIT = ['DIRECTOR_OF_CEREMONIES', 'WORSHIPFUL_MASTER', 'PROVINCE_ADMIN'] as const;

export async function lectureRoutes(fastify: FastifyInstance) {
  // SUPER_ADMIN is allowed through requireRole unconditionally.
  const view = [authenticate, lodgeScope, requireRole(...CAN_VIEW)];
  const edit = [authenticate, lodgeScope, requireRole(...CAN_EDIT)];

  // GET / — the library this lodge can see: its own papers plus the platform set
  fastify.get('/', { preHandler: view }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { category, minutes, status } = request.query as {
      category?: string;
      minutes?: string;
      status?: string;
    };

    const lectures = await fastify.prisma.lecture.findMany({
      where: {
        OR: [{ lodgeId }, { lodgeId: null }],
        ...(category ? { category: category as any } : {}),
        ...(minutes ? { minutes: Number(minutes) } : {}),
        ...(status ? { status: status as any } : {}),
      },
      include: {
        deliveries: {
          where: { lodgeId },
          orderBy: { date: 'desc' },
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            meeting: { select: { id: true, date: true, type: true } },
          },
        },
      },
      orderBy: [{ number: 'asc' }, { title: 'asc' }],
    });

    // Never ship the full script in a list response — it is large and the
    // index does not need it.
    return reply.send(lectures.map(({ scriptMd, ...rest }) => ({
      ...rest,
      hasScript: Boolean(scriptMd),
      lastDelivered: rest.deliveries[0]?.date ?? null,
      timesDelivered: rest.deliveries.length,
    })));
  });

  // GET /:id — one paper, with the script
  fastify.get('/:id', { preHandler: view }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const lecture = await fastify.prisma.lecture.findFirst({
      where: { id, OR: [{ lodgeId }, { lodgeId: null }] },
      include: {
        deliveries: {
          where: { lodgeId },
          orderBy: { date: 'desc' },
          include: {
            member: { select: { id: true, firstName: true, lastName: true } },
            meeting: { select: { id: true, date: true, type: true } },
          },
        },
      },
    });

    if (!lecture) return reply.status(404).send({ error: 'Lecture not found' });
    return reply.send(lecture);
  });

  // POST / — add a paper to this lodge's own library
  fastify.post('/', { preHandler: edit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, unknown>;

    if (!body.title || !body.summary || !body.category) {
      return reply.status(400).send({ error: 'title, summary and category are required' });
    }

    const slug =
      (body.slug as string) ||
      String(body.title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const clash = await fastify.prisma.lecture.findFirst({ where: { lodgeId, slug } });
    if (clash) return reply.status(409).send({ error: 'A paper with that slug already exists' });

    const lecture = await fastify.prisma.lecture.create({
      data: {
        lodgeId,
        slug,
        number: body.number as number | undefined,
        series: body.series as string | undefined,
        title: body.title as string,
        subtitle: body.subtitle as string | undefined,
        category: body.category as any,
        minutes: (body.minutes as number) ?? 10,
        summary: body.summary as string,
        object: body.object as string | undefined,
        takeaways: (body.takeaways as any) ?? undefined,
        spine: (body.spine as any) ?? undefined,
        sources: (body.sources as any) ?? undefined,
        scriptMd: body.scriptMd as string | undefined,
        handoutUrl: body.handoutUrl as string | undefined,
        notes: body.notes as string | undefined,
      },
    });
    return reply.status(201).send(lecture);
  });

  // PATCH /:id — edit. Platform papers (lodgeId null) are read-only here;
  // only a SUPER_ADMIN may touch those, and requireRole lets them past.
  fastify.patch('/:id', { preHandler: edit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const body = request.body as Record<string, unknown>;

    const existing = await fastify.prisma.lecture.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Lecture not found' });

    if (existing.lodgeId === null && request.user.role !== 'SUPER_ADMIN') {
      return reply
        .status(403)
        .send({ error: 'Platform papers cannot be edited. Copy it to your lodge first.' });
    }
    if (existing.lodgeId !== null && existing.lodgeId !== lodgeId) {
      return reply.status(404).send({ error: 'Lecture not found' });
    }

    const allowed = [
      'number', 'series', 'title', 'subtitle', 'category', 'minutes', 'summary',
      'object', 'takeaways', 'spine', 'sources', 'scriptMd', 'handoutUrl', 'status', 'notes',
    ];
    const data: Record<string, unknown> = {};
    for (const key of allowed) if (key in body) data[key] = body[key];

    const lecture = await fastify.prisma.lecture.update({ where: { id }, data });
    return reply.send(lecture);
  });

  // POST /:id/copy — take a platform paper into this lodge's library so it can be edited
  fastify.post('/:id/copy', { preHandler: edit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const src = await fastify.prisma.lecture.findUnique({ where: { id } });
    if (!src) return reply.status(404).send({ error: 'Lecture not found' });

    const existing = await fastify.prisma.lecture.findFirst({ where: { lodgeId, slug: src.slug } });
    if (existing) return reply.status(409).send({ error: 'Already in your library' });

    const { id: _drop, lodgeId: _drop2, createdAt: _c, updatedAt: _u, ...rest } = src as any;
    const copy = await fastify.prisma.lecture.create({ data: { ...rest, lodgeId } });
    return reply.status(201).send(copy);
  });

  // DELETE /:id — only a lodge's own papers
  fastify.delete('/:id', { preHandler: edit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await fastify.prisma.lecture.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: 'Lecture not found' });
    if (existing.lodgeId !== lodgeId) {
      return reply.status(403).send({ error: 'You can only remove your own lodge’s papers' });
    }

    await fastify.prisma.lecture.delete({ where: { id } });
    return reply.status(204).send();
  });

  // ─── delivery log ──────────────────────────────────────────────────────
  // What was given, when, and by whom — so the DC does not programme the same
  // paper to the same brethren twice.

  fastify.post('/:id/deliveries', { preHandler: edit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const lodgeId = (request as any).lodgeId;
    const { date, memberId, meetingId, notes } = request.body as {
      date?: string;
      memberId?: string;
      meetingId?: string;
      notes?: string;
    };

    const lecture = await fastify.prisma.lecture.findFirst({
      where: { id, OR: [{ lodgeId }, { lodgeId: null }] },
    });
    if (!lecture) return reply.status(404).send({ error: 'Lecture not found' });

    if (meetingId) {
      const meeting = await fastify.prisma.meeting.findFirst({ where: { id: meetingId, lodgeId } });
      if (!meeting) return reply.status(404).send({ error: 'Meeting not found in this lodge' });
    }

    const delivery = await fastify.prisma.lectureDelivery.create({
      data: {
        lectureId: id,
        lodgeId,
        meetingId: meetingId ?? null,
        memberId: memberId ?? null,
        date: date ? new Date(date) : new Date(),
        notes: notes ?? null,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
        meeting: { select: { id: true, date: true, type: true } },
      },
    });

    await fastify.prisma.lecture.update({
      where: { id },
      data: { status: lecture.lodgeId === lodgeId ? 'DELIVERED' : lecture.status },
    });

    return reply.status(201).send(delivery);
  });

  fastify.delete('/deliveries/:deliveryId', { preHandler: edit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { deliveryId } = request.params as { deliveryId: string };
    const lodgeId = (request as any).lodgeId;

    const existing = await fastify.prisma.lectureDelivery.findFirst({
      where: { id: deliveryId, lodgeId },
    });
    if (!existing) return reply.status(404).send({ error: 'Delivery not found' });

    await fastify.prisma.lectureDelivery.delete({ where: { id: deliveryId } });
    return reply.status(204).send();
  });
}
