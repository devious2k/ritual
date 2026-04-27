import type { PrismaClient } from '@prisma/client';

export async function runAttendanceFlags(prisma: PrismaClient) {
  const lodges = await prisma.lodge.findMany({
    include: {
      members: {
        where: { status: 'ACTIVE' },
        include: {
          attendance: {
            orderBy: { meeting: { date: 'desc' } },
            take: 6,
            include: { meeting: true },
          },
        },
      },
    },
  });

  for (const lodge of lodges) {
    for (const member of lodge.members) {
      const recentAttendance = member.attendance.filter(
        (a) => a.meeting.type === 'REGULAR',
      );

      if (recentAttendance.length < 3) continue;

      const presentCount = recentAttendance.filter(
        (a) => a.status === 'PRESENT',
      ).length;

      const attendanceRate = presentCount / recentAttendance.length;

      // Flag if attendance below 33% over last 6 regular meetings
      if (attendanceRate < 0.33) {
        // Find the almoner user for this lodge
        const almoner = await prisma.userLodgeAccess.findFirst({
          where: { lodgeId: lodge.id, role: 'ALMONER' },
        });

        if (almoner) {
          // Create notification for almoner
          await prisma.notification.upsert({
            where: {
              id: `attendance-flag-${member.id}-${new Date().getFullYear()}`,
            },
            create: {
              id: `attendance-flag-${member.id}-${new Date().getFullYear()}`,
              type: 'attendance_flag',
              title: 'Low Attendance Alert',
              body: `${member.firstName} ${member.lastName} has attended ${presentCount} of the last ${recentAttendance.length} regular meetings (${Math.round(attendanceRate * 100)}%).`,
              link: `/members/${member.id}`,
              userId: almoner.userId,
              lodgeId: lodge.id,
            },
            update: {},
          });
        }
      }
    }
  }
}
