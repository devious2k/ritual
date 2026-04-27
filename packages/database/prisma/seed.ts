import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper: get the 3rd Thursday of a given month/year
function thirdThursday(year: number, month: number): Date {
  const date = new Date(year, month, 1);
  const dayOfWeek = date.getDay();
  // Days until first Thursday
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const firstThursday = 1 + daysUntilThursday;
  const thirdThursdayDay = firstThursday + 14;
  return new Date(year, month, thirdThursdayDay, 18, 30, 0);
}

async function main() {
  console.log('Seeding LodgeKey database...');

  const hashedPassword = await bcrypt.hash('Password123!', 12);

  // ─── Clean up existing seed data ────────────────────────
  // Delete in reverse dependency order
  await prisma.attendance.deleteMany({});
  await prisma.diningFee.deleteMany({});
  await prisma.visitor.deleteMany({});
  await prisma.ceremonyRole.deleteMany({});
  await prisma.rehearsal.deleteMany({});
  await prisma.ceremonyPlan.deleteMany({});
  await prisma.summons.deleteMany({});
  await prisma.correspondence.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.userLodgeAccess.deleteMany({});
  await prisma.officer.deleteMany({});
  await prisma.degreeProgression.deleteMany({});
  await prisma.mentorAssignment.deleteMany({});
  await prisma.honour.deleteMany({});
  await prisma.almonerCase.deleteMany({});
  await prisma.charityDonation.deleteMany({});
  await prisma.duesRecord.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.candidate.deleteMany({});
  await prisma.lodgeEquipment.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.lodge.deleteMany({});
  await prisma.province.deleteMany({});

  console.log('Cleared existing data.');

  // ─── Province ───────────────────────────────────────────
  const province = await prisma.province.create({
    data: {
      name: 'Yorkshire North and East Ridings',
      district: 'Provincial',
    },
  });
  console.log(`Created province: ${province.name}`);

  // ─── Lodge ──────────────────────────────────────────────
  const lodge = await prisma.lodge.create({
    data: {
      name: 'Vulcan Lodge',
      number: '4510',
      provinceId: province.id,
      meetingDay: 'Third Thursday',
      meetingMonths: 'Sep,Oct,Nov,Jan,Feb,Mar,Apr',
      venue: 'Middlesbrough Masonic Hall',
      venueAddress: 'Middlesbrough, North Yorkshire',
      annualDues: 175.0,
      diningCost: 22.5,
      consecrationDate: new Date('1921-10-13'),
    },
  });
  console.log(`Created lodge: ${lodge.name} No. ${lodge.number}`);

  // ─── Members ────────────────────────────────────────────
  const memberData = [
    { firstName: 'David', lastName: 'Harrison', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'david.harrison@example.com', occupation: 'Engineer', dateInitiated: new Date('2005-09-15'), datePassed: new Date('2006-01-19'), dateRaised: new Date('2006-04-20'), dateJoined: new Date('2005-09-15') },
    { firstName: 'Robert', lastName: 'Thornton', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'robert.thornton@example.com', occupation: 'Solicitor', dateInitiated: new Date('2000-10-19'), datePassed: new Date('2001-01-18'), dateRaised: new Date('2001-04-19'), dateJoined: new Date('2000-10-19') },
    { firstName: 'James', lastName: 'Mitchell', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'james.mitchell@example.com', occupation: 'Accountant', dateInitiated: new Date('2010-09-16'), datePassed: new Date('2011-01-20'), dateRaised: new Date('2011-04-21'), dateJoined: new Date('2010-09-16') },
    { firstName: 'Alan', lastName: 'Cooper', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'alan.cooper@example.com', occupation: 'Teacher', dateInitiated: new Date('2012-10-18'), datePassed: new Date('2013-01-17'), dateRaised: new Date('2013-04-18'), dateJoined: new Date('2012-10-18') },
    { firstName: 'Peter', lastName: 'Williams', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'peter.williams@example.com', occupation: 'Retired Bank Manager', dateInitiated: new Date('1995-09-21'), datePassed: new Date('1996-01-18'), dateRaised: new Date('1996-04-18'), dateJoined: new Date('1995-09-21') },
    { firstName: 'Mark', lastName: 'Stevens', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'mark.stevens@example.com', occupation: 'IT Consultant', dateInitiated: new Date('2008-10-16'), datePassed: new Date('2009-01-15'), dateRaised: new Date('2009-04-16'), dateJoined: new Date('2008-10-16') },
    { firstName: 'Thomas', lastName: 'Clark', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'thomas.clark@example.com', occupation: 'Electrician', dateInitiated: new Date('2015-09-17'), datePassed: new Date('2016-01-21'), dateRaised: new Date('2016-04-21'), dateJoined: new Date('2015-09-17') },
    { firstName: 'Richard', lastName: 'Moore', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'richard.moore@example.com', occupation: 'Civil Servant', dateInitiated: new Date('2016-10-20'), datePassed: new Date('2017-01-19'), dateRaised: new Date('2017-04-20'), dateJoined: new Date('2016-10-20') },
    { firstName: 'Daniel', lastName: 'Wright', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'daniel.wright@example.com', occupation: 'Plumber', dateInitiated: new Date('2018-09-20'), datePassed: new Date('2019-01-17'), dateRaised: new Date('2019-04-18'), dateJoined: new Date('2018-09-20') },
    { firstName: 'Kenneth', lastName: 'Brown', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'kenneth.brown@example.com', occupation: 'Retired Police Officer', dateInitiated: new Date('1998-10-15'), datePassed: new Date('1999-01-21'), dateRaised: new Date('1999-04-15'), dateJoined: new Date('1998-10-15') },
    { firstName: 'George', lastName: 'Taylor', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'george.taylor@example.com', occupation: 'GP', dateInitiated: new Date('2002-09-19'), datePassed: new Date('2003-01-16'), dateRaised: new Date('2003-04-17'), dateJoined: new Date('2002-09-19') },
    { firstName: 'Philip', lastName: 'Jackson', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'philip.jackson@example.com', occupation: 'Surveyor', dateInitiated: new Date('2014-10-16'), datePassed: new Date('2015-01-15'), dateRaised: new Date('2015-04-16'), dateJoined: new Date('2014-10-16') },
    { firstName: 'Edward', lastName: 'Martin', degree: 'FELLOW_CRAFT' as const, status: 'ACTIVE' as const, email: 'edward.martin@example.com', occupation: 'Carpenter', dateInitiated: new Date('2024-09-19'), datePassed: new Date('2025-01-16'), dateJoined: new Date('2024-09-19') },
    { firstName: 'Steven', lastName: 'Young', degree: 'ENTERED_APPRENTICE' as const, status: 'ACTIVE' as const, email: 'steven.young@example.com', occupation: 'Software Developer', dateInitiated: new Date('2025-10-16'), dateJoined: new Date('2025-10-16') },
    { firstName: 'Arthur', lastName: 'Dixon', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'arthur.dixon@example.com', occupation: 'Retired Builder', dateInitiated: new Date('1990-09-20'), datePassed: new Date('1991-01-17'), dateRaised: new Date('1991-04-18'), dateJoined: new Date('1990-09-20') },
    { firstName: 'Henry', lastName: 'Robinson', degree: 'MASTER_MASON' as const, status: 'HONORARY' as const, email: 'henry.robinson@example.com', occupation: 'Retired Headmaster', dateInitiated: new Date('1975-10-16'), datePassed: new Date('1976-01-15'), dateRaised: new Date('1976-04-15'), dateJoined: new Date('1975-10-16') },
    { firstName: 'Michael', lastName: 'Anderson', degree: 'MASTER_MASON' as const, status: 'COUNTRY_MEMBER' as const, email: 'michael.anderson@example.com', occupation: 'Architect', dateInitiated: new Date('2007-09-20'), datePassed: new Date('2008-01-17'), dateRaised: new Date('2008-04-17'), dateJoined: new Date('2007-09-20') },
    { firstName: 'Ian', lastName: 'Thompson', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'ian.thompson@example.com', occupation: 'Sales Manager', dateInitiated: new Date('2019-10-17'), datePassed: new Date('2020-01-16'), dateRaised: new Date('2020-10-15'), dateJoined: new Date('2019-10-17') },
    { firstName: 'Paul', lastName: 'Green', degree: 'MASTER_MASON' as const, status: 'ACTIVE' as const, email: 'paul.green@example.com', occupation: 'Pharmacist', dateInitiated: new Date('2020-09-17'), datePassed: new Date('2021-01-21'), dateRaised: new Date('2021-04-15'), dateJoined: new Date('2020-09-17') },
    { firstName: 'Charles', lastName: 'Walker', degree: 'MASTER_MASON' as const, status: 'DECEASED' as const, email: null, occupation: 'Retired Engineer', dateInitiated: new Date('1970-09-17'), datePassed: new Date('1971-01-21'), dateRaised: new Date('1971-04-15'), dateJoined: new Date('1970-09-17') },
  ];

  const members = await prisma.$transaction(
    memberData.map((m) =>
      prisma.member.create({
        data: {
          firstName: m.firstName,
          lastName: m.lastName,
          degree: m.degree,
          status: m.status,
          email: m.email,
          occupation: m.occupation,
          dateInitiated: m.dateInitiated,
          datePassed: m.datePassed ?? null,
          dateRaised: m.dateRaised ?? null,
          dateJoined: m.dateJoined,
          lodgeId: lodge.id,
        },
      })
    )
  );
  console.log(`Created ${members.length} members.`);

  // Build a lookup by last name for convenience
  const memberByLastName: Record<string, (typeof members)[0]> = {};
  for (const m of members) {
    memberByLastName[m.lastName] = m;
  }

  // ─── Users ──────────────────────────────────────────────
  const usersData = [
    { email: 'secretary@vulcan4510.co.uk', role: 'SECRETARY' as const, memberLastName: 'Stevens' },
    { email: 'wm@vulcan4510.co.uk', role: 'WORSHIPFUL_MASTER' as const, memberLastName: 'Harrison' },
    { email: 'treasurer@vulcan4510.co.uk', role: 'TREASURER' as const, memberLastName: 'Williams' },
    { email: 'member@vulcan4510.co.uk', role: 'MEMBER' as const, memberLastName: 'Mitchell' },
  ];

  const createdUsers: Array<{ id: string; email: string; role: string; memberLastName?: string }> = [];

  // Create lodge-linked users
  for (const u of usersData) {
    const member = memberByLastName[u.memberLastName];
    const user = await prisma.user.create({
      data: {
        email: u.email,
        password: hashedPassword,
        role: u.role,
        isActive: true,
        memberId: member.id,
      },
    });
    createdUsers.push({ ...user, memberLastName: u.memberLastName });
  }

  // Province admin (not linked to a member)
  const provinceAdmin = await prisma.user.create({
    data: {
      email: 'admin@ynerprovince.co.uk',
      password: hashedPassword,
      role: 'PROVINCE_ADMIN',
      isActive: true,
      provinceId: province.id,
    },
  });
  createdUsers.push({ id: provinceAdmin.id, email: provinceAdmin.email, role: provinceAdmin.role });

  console.log(`Created ${createdUsers.length} users.`);

  // ─── UserLodgeAccess ────────────────────────────────────
  const lodgeUsers = createdUsers.filter((u) => u.role !== 'PROVINCE_ADMIN');
  await prisma.$transaction(
    lodgeUsers.map((u) =>
      prisma.userLodgeAccess.create({
        data: {
          userId: u.id,
          lodgeId: lodge.id,
          role: u.role as any,
        },
      })
    )
  );
  console.log(`Created ${lodgeUsers.length} UserLodgeAccess records.`);

  // ─── Officers (2025 masonic year) ───────────────────────
  const officerAssignments: Array<{ office: string; memberLastName: string }> = [
    { office: 'WORSHIPFUL_MASTER', memberLastName: 'Harrison' },
    { office: 'IMMEDIATE_PAST_MASTER', memberLastName: 'Thornton' },
    { office: 'SENIOR_WARDEN', memberLastName: 'Mitchell' },
    { office: 'JUNIOR_WARDEN', memberLastName: 'Cooper' },
    { office: 'TREASURER', memberLastName: 'Williams' },
    { office: 'SECRETARY', memberLastName: 'Stevens' },
    { office: 'SENIOR_DEACON', memberLastName: 'Clark' },
    { office: 'JUNIOR_DEACON', memberLastName: 'Moore' },
    { office: 'INNER_GUARD', memberLastName: 'Wright' },
    { office: 'DIRECTOR_OF_CEREMONIES', memberLastName: 'Brown' },
    { office: 'ALMONER', memberLastName: 'Taylor' },
    { office: 'CHARITY_STEWARD', memberLastName: 'Jackson' },
    { office: 'TYLER', memberLastName: 'Dixon' },
    { office: 'STEWARD', memberLastName: 'Thompson' },
    // Note: Paul Green is also a Steward, but the unique constraint is [lodgeId, office, year],
    // so we can only have one STEWARD per year. We skip the second steward to avoid constraint violation.
  ];

  const officers = await prisma.$transaction(
    officerAssignments.map((o) =>
      prisma.officer.create({
        data: {
          office: o.office as any,
          year: 2025,
          isActive: true,
          installedDate: new Date('2025-04-17'), // April installation
          memberId: memberByLastName[o.memberLastName].id,
          lodgeId: lodge.id,
        },
      })
    )
  );
  console.log(`Created ${officers.length} officer appointments.`);

  // ─── Accounts ───────────────────────────────────────────
  const accountsData = [
    { name: 'General Fund', type: 'GENERAL' as const, balance: 4250.0 },
    { name: 'Benevolent Fund', type: 'BENEVOLENT' as const, balance: 1820.0 },
    { name: 'Social Fund', type: 'SOCIAL' as const, balance: 635.0 },
    { name: 'Charity Account', type: 'CHARITY' as const, balance: 2100.0 },
  ];

  const accounts = await prisma.$transaction(
    accountsData.map((a) =>
      prisma.account.create({
        data: {
          name: a.name,
          type: a.type,
          balance: a.balance,
          lodgeId: lodge.id,
        },
      })
    )
  );
  console.log(`Created ${accounts.length} accounts.`);

  // ─── Meetings (Sep 2025 - Apr 2026 season) ─────────────
  // 3rd Thursday of: Sep, Oct, Nov 2025, Jan, Feb, Mar, Apr 2026
  const meetingMonths: Array<[number, number]> = [
    [2025, 8],  // Sep (0-indexed)
    [2025, 9],  // Oct
    [2025, 10], // Nov
    [2026, 0],  // Jan
    [2026, 1],  // Feb
    [2026, 2],  // Mar
    [2026, 3],  // Apr (Installation)
  ];

  const meetings = await prisma.$transaction(
    meetingMonths.map(([year, month], index) => {
      const date = thirdThursday(year, month);
      const isInstallation = month === 3 && year === 2026;
      return prisma.meeting.create({
        data: {
          type: isInstallation ? 'INSTALLATION' : 'REGULAR',
          date,
          startTime: '18:30',
          diningTime: '20:00',
          diningCost: 22.5,
          venue: 'Middlesbrough Masonic Hall',
          ceremonyType: isInstallation ? 'Installation' : null,
          lodgeId: lodge.id,
        },
      });
    })
  );
  console.log(`Created ${meetings.length} meetings.`);

  // ─── Attendance (for first 3 meetings: Sep, Oct, Nov 2025) ──
  // These are in the past relative to today (2026-04-12)
  const activeMembers = members.filter(
    (m) => m.status === 'ACTIVE' && m.degree !== 'ENTERED_APPRENTICE'
  );

  const attendanceRecords: Array<{
    memberId: string;
    meetingId: string;
    status: 'PRESENT' | 'APOLOGY' | 'ABSENT';
  }> = [];

  // Generate realistic attendance for first 3 meetings (past meetings)
  for (let i = 0; i < 3; i++) {
    const meeting = meetings[i];
    for (const member of activeMembers) {
      // Country members attend less frequently
      const isCountryMember = memberByLastName[member.lastName]?.status === 'COUNTRY_MEMBER';
      const rand = Math.random();

      let status: 'PRESENT' | 'APOLOGY' | 'ABSENT';
      if (isCountryMember) {
        status = rand < 0.3 ? 'PRESENT' : rand < 0.6 ? 'APOLOGY' : 'ABSENT';
      } else {
        status = rand < 0.75 ? 'PRESENT' : rand < 0.9 ? 'APOLOGY' : 'ABSENT';
      }

      attendanceRecords.push({
        memberId: member.id,
        meetingId: meeting.id,
        status,
      });
    }
  }

  // Also add the EA (Steven Young) to Oct and Nov meetings
  const stevenYoung = memberByLastName['Young'];
  if (stevenYoung && meetings.length >= 3) {
    attendanceRecords.push(
      { memberId: stevenYoung.id, meetingId: meetings[1].id, status: 'PRESENT' },
      { memberId: stevenYoung.id, meetingId: meetings[2].id, status: 'PRESENT' }
    );
  }

  await prisma.$transaction(
    attendanceRecords.map((a) =>
      prisma.attendance.create({
        data: {
          memberId: a.memberId,
          meetingId: a.meetingId,
          status: a.status,
          apologyReason: a.status === 'APOLOGY' ? 'Unable to attend' : null,
          respondedAt: new Date(),
        },
      })
    )
  );
  console.log(`Created ${attendanceRecords.length} attendance records.`);

  // ─── Summary ────────────────────────────────────────────
  console.log('\n--- Seed complete ---');
  console.log(`Province: ${province.name}`);
  console.log(`Lodge: ${lodge.name} No. ${lodge.number}`);
  console.log(`Members: ${members.length}`);
  console.log(`Users: ${createdUsers.length}`);
  console.log(`Officers: ${officers.length}`);
  console.log(`Accounts: ${accounts.length}`);
  console.log(`Meetings: ${meetings.length}`);
  console.log(`Attendance records: ${attendanceRecords.length}`);
  console.log('\nLogin credentials (all use password "Password123!"):');
  console.log('  Secretary:      secretary@vulcan4510.co.uk');
  console.log('  Worshipful Master: wm@vulcan4510.co.uk');
  console.log('  Treasurer:      treasurer@vulcan4510.co.uk');
  console.log('  Province Admin: admin@ynerprovince.co.uk');
  console.log('  Member:         member@vulcan4510.co.uk');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
