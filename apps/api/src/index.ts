import Fastify from 'fastify';
import cors from '@fastify/cors';
import { PrismaClient } from '@prisma/client';
import { authRoutes } from './routes/auth.js';
import { memberRoutes } from './routes/members.js';
import { officerRoutes } from './routes/officers.js';
import { meetingRoutes } from './routes/meetings.js';
import { attendanceRoutes } from './routes/attendance.js';
import { candidateRoutes } from './routes/candidates.js';
import { degreeRoutes } from './routes/degrees.js';
import { ceremonyRoutes } from './routes/ceremonies.js';
import { summonsRoutes } from './routes/summons.js';
import { financeRoutes } from './routes/finance.js';
import { duesRoutes } from './routes/dues.js';
import { diningRoutes } from './routes/dining.js';
import { charityRoutes } from './routes/charity.js';
import { honoursRoutes } from './routes/honours.js';
import { correspondenceRoutes } from './routes/correspondence.js';
import { almonerRoutes } from './routes/almoner.js';
import { equipmentRoutes } from './routes/equipment.js';
import { visitorRoutes } from './routes/visitors.js';
import { stripeRoutes } from './routes/stripe.js';
import { stripeWebhookRoutes } from './routes/stripeWebhook.js';
import { xeroRoutes } from './routes/xero.js';
import { aiRoutes } from './routes/ai.js';
import { notificationRoutes } from './routes/notifications.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { lodgeRoutes } from './routes/lodges.js';
import { provinceRoutes } from './routes/provinces.js';
import { userRoutes } from './routes/users.js';
import { publicRoutes } from './routes/public.js';
import { tenantRoutes } from './routes/tenants.js';
import { inboundMailRoutes } from './routes/inboundMail.js';
import { mailDomainRoutes } from './routes/mailDomains.js';
import { inboxRoutes } from './routes/inbox.js';
import { ritualRoutes } from './routes/ritual.js';
import { ritualSummonsRoutes } from './routes/ritualSummons.js';
import { treasurerRoutes } from './routes/treasurer.js';
import { paymentPlanRoutes } from './routes/paymentPlans.js';
import { publicVulcanRoutes } from './routes/publicVulcan.js';
import { eventRoutes } from './routes/events.js';
import { widgetRoutes } from './routes/widget.js';
import { publicRsvpRoutes } from './routes/publicRsvp.js';
import { errorHandler } from './middleware/errorHandler.js';

const prisma = new PrismaClient();

const fastify = Fastify({
  logger: true,
  bodyLimit: 5 * 1024 * 1024, // 5 MB — accommodates inline crest data URLs
});

// Decorate with prisma
fastify.decorate('prisma', prisma);

// Global error handler
fastify.setErrorHandler(errorHandler);

// CORS
// Explicit allowlist (preview deploys, marketing apex, app subdomain, localhost)
// plus any *.freemasons.app tenant subdomain so newly-provisioned lodges work
// without redeploying the API.
const explicitOrigins = new Set(
  (process.env.WEB_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
);
await fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow same-origin / curl
    if (explicitOrigins.has(origin)) return cb(null, true);
    try {
      const host = new URL(origin).hostname;
      if (host === 'freemasons.app' || host.endsWith('.freemasons.app')) {
        return cb(null, true);
      }
    } catch { /* fallthrough */ }
    return cb(null, false);
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Lodge-Id'],
});

// Webhook routes must be registered BEFORE body parsing (needs raw body)
await fastify.register(stripeWebhookRoutes);

// Register all route plugins
await fastify.register(authRoutes, { prefix: '/auth' });
await fastify.register(memberRoutes, { prefix: '/members' });
await fastify.register(officerRoutes, { prefix: '/officers' });
await fastify.register(meetingRoutes, { prefix: '/meetings' });
await fastify.register(attendanceRoutes, { prefix: '/attendance' });
await fastify.register(candidateRoutes, { prefix: '/candidates' });
await fastify.register(degreeRoutes, { prefix: '/degrees' });
await fastify.register(ceremonyRoutes, { prefix: '/ceremonies' });
await fastify.register(summonsRoutes, { prefix: '/summons' });
await fastify.register(financeRoutes, { prefix: '/finance' });
await fastify.register(duesRoutes, { prefix: '/dues' });
await fastify.register(diningRoutes, { prefix: '/dining' });
await fastify.register(charityRoutes, { prefix: '/charity' });
await fastify.register(honoursRoutes, { prefix: '/honours' });
await fastify.register(correspondenceRoutes, { prefix: '/correspondence' });
await fastify.register(almonerRoutes, { prefix: '/almoner' });
await fastify.register(equipmentRoutes, { prefix: '/equipment' });
await fastify.register(visitorRoutes, { prefix: '/visitors' });
await fastify.register(stripeRoutes, { prefix: '/stripe' });
await fastify.register(xeroRoutes, { prefix: '/xero' });
await fastify.register(aiRoutes, { prefix: '/ai' });
await fastify.register(notificationRoutes, { prefix: '/notifications' });
await fastify.register(dashboardRoutes, { prefix: '/dashboard' });
await fastify.register(lodgeRoutes, { prefix: '/lodges' });
await fastify.register(provinceRoutes, { prefix: '/provinces' });
await fastify.register(userRoutes, { prefix: '/users' });
await fastify.register(publicRoutes, { prefix: '/public' });
await fastify.register(tenantRoutes, { prefix: '/tenants' });
await fastify.register(mailDomainRoutes, { prefix: '/mail-domains' });
await fastify.register(inboxRoutes, { prefix: '/inbox' });
await fastify.register(inboundMailRoutes, { prefix: '/inbound-mail' });
await fastify.register(ritualRoutes, { prefix: '/ritual' });
await fastify.register(ritualSummonsRoutes, { prefix: '/ritual/summons' });
await fastify.register(treasurerRoutes, { prefix: '/treasurer' });
await fastify.register(paymentPlanRoutes, { prefix: '/payment-plans' });
await fastify.register(publicVulcanRoutes, { prefix: '/public' });
await fastify.register(eventRoutes, { prefix: '/events' });
await fastify.register(widgetRoutes, { prefix: '/widget' });
await fastify.register(publicRsvpRoutes, { prefix: '/public/rsvp' });

// Health check
fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Graceful shutdown
const shutdown = async () => {
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
const port = parseInt(process.env.PORT || process.env.API_PORT || '3001', 10);
try {
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`LodgeKey API running on port ${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
