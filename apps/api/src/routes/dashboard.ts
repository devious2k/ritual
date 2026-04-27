import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { lodgeScope } from '../middleware/lodgeScope.js';

export async function dashboardRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', lodgeScope);

  // GET /dashboard/stats — Aggregated KPIs for lodge
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const now = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Run all queries in parallel
    const [
      totalMembers,
      activeMembers,
      upcomingMeetingsCount,
      outstandingDues,
      totalDuesThisYear,
      paidDuesThisYear,
      recentMeetings,
      recentAttendance,
    ] = await Promise.all([
      prisma.member.count({ where: { lodgeId } }),
      prisma.member.count({ where: { lodgeId, status: 'ACTIVE' } }),
      prisma.meeting.count({ where: { lodgeId, date: { gte: now } } }),
      prisma.duesRecord.aggregate({
        where: { lodgeId, status: { in: ['OVERDUE', 'ARREARS'] } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.duesRecord.count({
        where: { lodgeId, year: now.getFullYear() },
      }),
      prisma.duesRecord.count({
        where: { lodgeId, year: now.getFullYear(), status: 'CURRENT' },
      }),
      prisma.meeting.findMany({
        where: { lodgeId, date: { gte: sixMonthsAgo, lt: now }, type: 'REGULAR' },
        select: { id: true },
      }),
      prisma.attendance.groupBy({
        by: ['meetingId'],
        where: {
          meeting: { lodgeId, date: { gte: sixMonthsAgo, lt: now }, type: 'REGULAR' },
          status: 'PRESENT',
        },
        _count: true,
      }),
    ]);

    // Calculate attendance rate
    let attendanceRate = 0;
    if (recentMeetings.length > 0 && activeMembers > 0) {
      const totalPresent = recentAttendance.reduce((sum, g) => sum + g._count, 0);
      const totalPossible = recentMeetings.length * activeMembers;
      attendanceRate = Math.round((totalPresent / totalPossible) * 100);
    }

    // Dues collection rate
    const duesCollectionRate = totalDuesThisYear > 0
      ? Math.round((paidDuesThisYear / totalDuesThisYear) * 100)
      : 0;

    return reply.send({
      totalMembers,
      activeMembers,
      upcomingMeetings: upcomingMeetingsCount,
      outstandingDues: {
        total: outstandingDues._sum.amount || 0,
        count: outstandingDues._count,
      },
      attendanceRate,
      duesCollectionRate,
    });
  });

  // GET /dashboard/upcoming — Next 5 upcoming meetings
  fastify.get('/upcoming', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const meetings = await prisma.meeting.findMany({
      where: { lodgeId, date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 5,
      include: {
        _count: {
          select: {
            attendance: { where: { status: 'PRESENT' } },
            visitors: true,
          },
        },
        ceremonyPlan: {
          select: { ceremonyType: true, isConfirmed: true },
        },
      },
    });

    return reply.send({ meetings });
  });

  // GET /dashboard/action-items — Pending items
  fastify.get('/action-items', async (request: FastifyRequest, reply: FastifyReply) => {
    const lodgeId = (request as any).lodgeId;

    const [
      outstandingDues,
      unapprovedMinutes,
      pendingCandidates,
      pendingBallots,
      unconfirmedCeremonies,
      unsentSummonses,
    ] = await Promise.all([
      // Outstanding dues
      prisma.duesRecord.findMany({
        where: { lodgeId, status: { in: ['OVERDUE', 'ARREARS'] } },
        include: { member: { select: { firstName: true, lastName: true } } },
        take: 10,
      }),

      // Unapproved minutes
      prisma.meeting.findMany({
        where: { lodgeId, date: { lt: new Date() }, minutesApproved: false, minutesContent: { not: null } },
        select: { id: true, type: true, date: true },
        orderBy: { date: 'desc' },
        take: 5,
      }),

      // Pending candidates
      prisma.candidate.findMany({
        where: { lodgeId, status: { in: ['ENQUIRY', 'INTERVIEW', 'PROPOSED'] } },
        select: { id: true, firstName: true, lastName: true, status: true },
      }),

      // Pending ballots
      prisma.candidate.findMany({
        where: { lodgeId, status: 'BALLOT_PENDING' },
        select: { id: true, firstName: true, lastName: true, ballotDate: true },
      }),

      // Unconfirmed ceremony plans
      prisma.ceremonyPlan.findMany({
        where: {
          isConfirmed: false,
          meeting: { lodgeId, date: { gte: new Date() } },
        },
        include: {
          meeting: { select: { date: true, type: true } },
        },
      }),

      // Unsent summonses for upcoming meetings
      prisma.summons.findMany({
        where: {
          lodgeId,
          sentAt: null,
          meeting: { date: { gte: new Date() } },
        },
        include: {
          meeting: { select: { date: true, type: true } },
        },
      }),
    ]);

    return reply.send({
      actionItems: {
        outstandingDues: outstandingDues.map((d) => ({
          type: 'outstanding_dues',
          memberId: d.memberId,
          memberName: `${d.member.firstName} ${d.member.lastName}`,
          year: d.year,
          amount: d.amount,
          status: d.status,
        })),
        unapprovedMinutes: unapprovedMinutes.map((m) => ({
          type: 'unapproved_minutes',
          meetingId: m.id,
          meetingType: m.type,
          date: m.date,
        })),
        pendingCandidates: pendingCandidates.map((c) => ({
          type: 'pending_candidate',
          candidateId: c.id,
          name: `${c.firstName} ${c.lastName}`,
          status: c.status,
        })),
        pendingBallots: pendingBallots.map((c) => ({
          type: 'pending_ballot',
          candidateId: c.id,
          name: `${c.firstName} ${c.lastName}`,
          ballotDate: c.ballotDate,
        })),
        unconfirmedCeremonies: unconfirmedCeremonies.map((cp) => ({
          type: 'unconfirmed_ceremony',
          ceremonyPlanId: cp.id,
          ceremonyType: cp.ceremonyType,
          meetingDate: cp.meeting.date,
        })),
        unsentSummonses: unsentSummonses.map((s) => ({
          type: 'unsent_summons',
          summonsId: s.id,
          meetingDate: s.meeting.date,
          meetingType: s.meeting.type,
        })),
      },
    });
  });
}
