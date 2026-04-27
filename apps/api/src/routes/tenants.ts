import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext, requireSuperAdmin } from '../middleware/tenant.js';
import { createTenantSubdomain, removeTenantSubdomain, provisionTenantMail } from '../services/cloudflare.js';
import { attachDomain, detachDomain, getDomainStatus } from '../services/vercel.js';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export async function tenantRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);

  // GET /tenants/me — lodges this user can switch into
  fastify.get('/me', async (request: FastifyRequest) => {
    if (request.isSuperAdmin) {
      const lodges = await prisma.lodge.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, number: true, slug: true, subdomain: true,
          domainStatus: true, siteMode: true, crestUrl: true,
        },
        orderBy: [{ number: 'asc' }],
      });
      return { lodges, role: 'SUPER_ADMIN' };
    }

    const access = await prisma.userLodgeAccess.findMany({
      where: { userId: request.user.userId },
      include: {
        lodge: {
          select: {
            id: true, name: true, number: true, slug: true, subdomain: true,
            domainStatus: true, siteMode: true, crestUrl: true, isActive: true,
          },
        },
      },
    });
    return {
      lodges: access.filter((a) => a.lodge.isActive).map((a) => ({ ...a.lodge, role: a.role })),
      role: request.user.role,
    };
  });

  // GET /tenants — SUPER_ADMIN list of all lodges
  fastify.get('/', { preHandler: [requireSuperAdmin] }, async () => {
    const lodges = await prisma.lodge.findMany({
      include: {
        province: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
    const counts = await prisma.member.groupBy({
      by: ['lodgeId'],
      _count: { _all: true },
    });
    const countMap = new Map(counts.map((c) => [c.lodgeId, c._count._all]));
    return lodges.map((l) => ({ ...l, _count: { members: countMap.get(l.id) || 0 } }));
  });

  // POST /tenants — SUPER_ADMIN creates a new lodge
  fastify.post('/', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const body = request.body as {
      name: string; number: string; provinceId: string;
      slug?: string; siteMode?: 'PUBLIC_PAGE' | 'LOGIN_DIRECT';
      meetingDay?: string; venue?: string; venueAddress?: string;
    };
    if (!body.name || !body.number || !body.provinceId) {
      return reply.status(400).send({ error: 'name, number, and provinceId are required' });
    }
    if (body.slug && !SLUG_RE.test(body.slug)) {
      return reply.status(400).send({ error: 'Slug must be 1–32 lowercase letters/digits/hyphens' });
    }

    const lodge = await prisma.lodge.create({
      data: {
        name: body.name,
        number: body.number,
        provinceId: body.provinceId,
        slug: body.slug || null,
        siteMode: body.siteMode || 'LOGIN_DIRECT',
        meetingDay: body.meetingDay,
        venue: body.venue,
        venueAddress: body.venueAddress,
      },
    });
    return reply.status(201).send(lodge);
  });

  // PUT /tenants/:id — SUPER_ADMIN update lodge identity / siteMode
  fastify.put('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string; number: string; slug: string;
      siteMode: 'PUBLIC_PAGE' | 'LOGIN_DIRECT'; isActive: boolean;
      meetingDay: string; venue: string; venueAddress: string;
      crestUrl: string;
    }>;

    if (body.slug && !SLUG_RE.test(body.slug)) {
      return reply.status(400).send({ error: 'Invalid slug' });
    }

    const lodge = await prisma.lodge.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.number !== undefined && { number: body.number }),
        ...(body.slug !== undefined && { slug: body.slug || null }),
        ...(body.siteMode !== undefined && { siteMode: body.siteMode }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
        ...(body.meetingDay !== undefined && { meetingDay: body.meetingDay }),
        ...(body.venue !== undefined && { venue: body.venue }),
        ...(body.venueAddress !== undefined && { venueAddress: body.venueAddress }),
        ...(body.crestUrl !== undefined && { crestUrl: body.crestUrl || null }),
      },
    });
    return lodge;
  });

  // POST /tenants/:id/domain — provision <slug>.freemasons.app
  fastify.post('/:id/domain', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lodge = await prisma.lodge.findUnique({ where: { id } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });
    if (!lodge.slug) return reply.status(400).send({ error: 'Set a slug before provisioning a domain' });
    if (lodge.domainStatus === 'ACTIVE') {
      return reply.status(400).send({ error: 'Domain is already active. Remove it first to re-provision.' });
    }
    // PROVISIONING / PENDING_VERIFICATION / ERROR / NONE all fall through —
    // createTenantSubdomain and attachDomain are now idempotent.

    await prisma.lodge.update({
      where: { id },
      data: { domainStatus: 'PROVISIONING', domainError: null },
    });

    try {
      const dns = await createTenantSubdomain(lodge.slug);
      try {
        await attachDomain(dns.hostname);
      } catch (vercelErr: any) {
        // If Vercel attach fails we still keep the DNS record so the user
        // can retry, but mark status appropriately.
        await prisma.lodge.update({
          where: { id },
          data: {
            cloudflareRecordId: dns.recordId,
            subdomain: dns.hostname,
            domainStatus: 'ERROR',
            domainError: `DNS created but Vercel attach failed: ${vercelErr.message}`,
          },
        });
        return reply.status(502).send({ error: vercelErr.message });
      }

      const updated = await prisma.lodge.update({
        where: { id },
        data: {
          cloudflareRecordId: dns.recordId,
          subdomain: dns.hostname,
          domainStatus: 'PENDING_VERIFICATION',
          domainProvisionedAt: new Date(),
        },
      });

      // Provision email routing on the same subdomain (MX + SPF + Email
      // Routing subdomain registration), then upsert the LodgeMailDomain row
      // so role-addressed mail starts flowing without any further setup.
      try {
        const mail = await provisionTenantMail(lodge.slug);
        await prisma.lodgeMailDomain.upsert({
          where: { domain: mail.hostname },
          update: {
            status: mail.emailRoutingRegistered ? 'ACTIVE' : 'PENDING',
            cloudflareRecordIds: mail.recordIds,
            inboundError: mail.emailRoutingError ?? null,
            verifiedAt: mail.emailRoutingRegistered ? new Date() : null,
          },
          create: {
            lodgeId: id,
            domain: mail.hostname,
            kind: 'TENANT_SUBDOMAIN',
            status: mail.emailRoutingRegistered ? 'ACTIVE' : 'PENDING',
            cloudflareRecordIds: mail.recordIds,
            inboundError: mail.emailRoutingError ?? null,
            verifiedAt: mail.emailRoutingRegistered ? new Date() : null,
          },
        });
      } catch (mailErr: any) {
        // Don't fail the whole provision — mail provisioning is recoverable.
        await prisma.lodgeMailDomain.upsert({
          where: { domain: `${lodge.slug}.freemasons.app` },
          update: { status: 'ERROR', inboundError: mailErr?.message },
          create: {
            lodgeId: id,
            domain: `${lodge.slug}.freemasons.app`,
            kind: 'TENANT_SUBDOMAIN',
            status: 'ERROR',
            inboundError: mailErr?.message,
          },
        });
      }

      return reply.status(201).send(updated);
    } catch (err: any) {
      await prisma.lodge.update({
        where: { id },
        data: { domainStatus: 'ERROR', domainError: err.message },
      });
      return reply.status(502).send({ error: err.message });
    }
  });

  // GET /tenants/:id/domain/status — refresh Vercel verification
  fastify.get('/:id/domain/status', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lodge = await prisma.lodge.findUnique({ where: { id } });
    if (!lodge?.subdomain) return reply.status(404).send({ error: 'No domain provisioned' });

    try {
      const status = await getDomainStatus(lodge.subdomain);
      const newStatus = status.verified ? 'ACTIVE' : 'PENDING_VERIFICATION';
      const updated = await prisma.lodge.update({
        where: { id },
        data: { domainStatus: newStatus, domainError: null },
      });
      return updated;
    } catch (err: any) {
      return reply.status(502).send({ error: err.message });
    }
  });

  // DELETE /tenants/:id/domain — tear down DNS + Vercel attach
  fastify.delete('/:id/domain', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const lodge = await prisma.lodge.findUnique({ where: { id } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });

    if (lodge.subdomain) {
      try { await detachDomain(lodge.subdomain); } catch { /* tolerant — may already be gone */ }
    }
    if (lodge.cloudflareRecordId) {
      try { await removeTenantSubdomain(lodge.cloudflareRecordId); } catch { /* tolerant */ }
    }

    const updated = await prisma.lodge.update({
      where: { id },
      data: {
        cloudflareRecordId: null,
        subdomain: null,
        domainStatus: 'NONE',
        domainError: null,
        domainProvisionedAt: null,
      },
    });
    return updated;
  });
}
