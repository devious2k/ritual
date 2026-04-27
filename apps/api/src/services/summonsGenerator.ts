import type { PrismaClient } from '@prisma/client';

export async function generateSummons(
  prisma: PrismaClient,
  meetingId: string,
): Promise<any> {
  const meeting = await prisma.meeting.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      lodge: {
        include: {
          province: true,
        },
      },
      attendance: {
        include: {
          member: true,
        },
      },
      visitors: true,
      ceremonyPlan: {
        include: {
          roles: {
            include: {
              member: true,
            },
          },
        },
      },
    },
  });

  const lodge = meeting.lodge;

  // Fetch current officers for the lodge
  const currentYear = new Date().getFullYear();
  const officers = await prisma.officer.findMany({
    where: {
      lodgeId: lodge.id,
      year: currentYear,
      isActive: true,
    },
    include: {
      member: true,
    },
    orderBy: {
      office: 'asc',
    },
  });

  // Fetch active members for attendance list
  const activeMembers = await prisma.member.findMany({
    where: {
      lodgeId: lodge.id,
      status: { in: ['ACTIVE', 'COUNTRY_MEMBER', 'HONORARY'] },
    },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
  });

  // Build structured summons content
  const summonsContent = {
    header: {
      provinceName: lodge.province.name,
      lodgeName: lodge.name,
      lodgeNumber: lodge.number,
      venue: meeting.venue || lodge.venue || '',
      venueAddress: lodge.venueAddress || '',
    },
    meeting: {
      type: meeting.type,
      date: meeting.date.toISOString(),
      startTime: meeting.startTime || '',
      diningTime: meeting.diningTime || '',
      diningCost: meeting.diningCost ?? lodge.diningCost ?? null,
      diningMenu: meeting.diningMenu || null,
    },
    officers: officers.map((o) => ({
      office: o.office,
      name: `${o.member.firstName} ${o.member.lastName}`,
      memberId: o.member.id,
    })),
    agenda: meeting.agendaItems || [],
    ceremony: meeting.ceremonyPlan
      ? {
          type: meeting.ceremonyPlan.ceremonyType,
          candidateName: meeting.candidateName || null,
          roles: meeting.ceremonyPlan.roles.map((r) => ({
            role: r.role,
            name: `${r.member.firstName} ${r.member.lastName}`,
            confirmed: r.confirmed,
          })),
        }
      : null,
    members: activeMembers.map((m) => ({
      id: m.id,
      name: `${m.firstName} ${m.lastName}`,
      degree: m.degree,
      status: m.status,
    })),
    rsvp: {
      responses: meeting.attendance.map((a) => ({
        memberId: a.memberId,
        name: `${a.member.firstName} ${a.member.lastName}`,
        status: a.status,
        diningChoice: a.diningChoice || null,
        guestCount: a.guestCount,
      })),
      visitors: meeting.visitors.map((v) => ({
        name: `${v.firstName} ${v.lastName}`,
        rank: v.rank || '',
        lodge: v.lodgeName,
        lodgeNumber: v.lodgeNumber || '',
        dining: v.dining,
      })),
    },
    generatedAt: new Date().toISOString(),
  };

  // Upsert the summons record
  const summons = await prisma.summons.upsert({
    where: { meetingId },
    create: {
      meetingId,
      lodgeId: lodge.id,
      content: summonsContent,
      generatedAt: new Date(),
      recipientCount: activeMembers.length,
    },
    update: {
      content: summonsContent,
      generatedAt: new Date(),
      recipientCount: activeMembers.length,
    },
  });

  return {
    summonsId: summons.id,
    content: summonsContent,
    recipientCount: activeMembers.length,
  };
}
