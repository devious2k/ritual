import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';
import { requireRole } from '../middleware/roleGuard.js';

export async function charityRoutes(fastify: FastifyInstance) {
  const preHandler = [authenticate, lodgeScope];

  // GET / — list donations for lodge (filter by fund)
  fastify.get('/', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { fund, page = '1', limit = '50' } = request.query as {
      fund?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);

    const where: any = { lodgeId };
    if (fund) where.fund = fund;

    const [donations, total] = await Promise.all([
      fastify.prisma.charityDonation.findMany({
        where,
        include: {
          member: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { date: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      fastify.prisma.charityDonation.count({ where }),
    ]);

    return reply.send({
      donations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  });

  // POST / — create donation
  fastify.post('/', {
    preHandler: [...preHandler, requireRole('TREASURER', 'SECRETARY', 'WORSHIPFUL_MASTER', 'MEMBER')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const {
      amount, fund, isFestival, festivalTarget, giftAid, giftAidDeclarationDate,
      date, paymentMethod, memberId, notes,
    } = request.body as {
      amount: number;
      fund: string;
      isFestival?: boolean;
      festivalTarget?: number;
      giftAid?: boolean;
      giftAidDeclarationDate?: string;
      date?: string;
      paymentMethod?: string;
      memberId?: string;
      notes?: string;
    };

    const donation = await fastify.prisma.charityDonation.create({
      data: {
        amount,
        fund,
        isFestival: isFestival ?? false,
        festivalTarget,
        giftAid: giftAid ?? false,
        giftAidDeclarationDate: giftAidDeclarationDate ? new Date(giftAidDeclarationDate) : null,
        date: date ? new Date(date) : new Date(),
        paymentMethod,
        memberId: memberId ?? null,
        lodgeId,
        notes,
      },
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return reply.status(201).send(donation);
  });

  // GET /festival — festival giving progress
  fastify.get('/festival', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { fund } = request.query as { fund?: string };

    const where: any = { lodgeId, isFestival: true };
    if (fund) where.fund = fund;

    const donations = await fastify.prisma.charityDonation.findMany({
      where,
      include: {
        member: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Aggregate by member
    const memberTotals = new Map<string, { memberId: string; name: string; total: number; target: number | null }>();
    for (const d of donations) {
      if (!d.memberId) continue;
      const key = d.memberId;
      const existing = memberTotals.get(key);
      if (existing) {
        existing.total += d.amount;
      } else {
        memberTotals.set(key, {
          memberId: d.memberId,
          name: d.member ? `${d.member.firstName} ${d.member.lastName}` : 'Unknown',
          total: d.amount,
          target: d.festivalTarget,
        });
      }
    }

    const totalRaised = donations.reduce((sum, d) => sum + d.amount, 0);
    const totalGiftAid = donations.filter((d) => d.giftAid).reduce((sum, d) => sum + d.amount * 0.25, 0);

    return reply.send({
      totalRaised,
      totalGiftAid,
      totalWithGiftAid: totalRaised + totalGiftAid,
      donationCount: donations.length,
      memberProgress: Array.from(memberTotals.values()),
    });
  });

  // GET /member/:memberId — donations by member
  fastify.get('/member/:memberId', { preHandler }, async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;
    const { memberId } = request.params as { memberId: string };

    const donations = await fastify.prisma.charityDonation.findMany({
      where: { memberId, lodgeId },
      orderBy: { date: 'desc' },
    });

    const total = donations.reduce((sum, d) => sum + d.amount, 0);
    const giftAidTotal = donations.filter((d) => d.giftAid).reduce((sum, d) => sum + d.amount * 0.25, 0);

    return reply.send({
      donations,
      total,
      giftAidTotal,
    });
  });
}
