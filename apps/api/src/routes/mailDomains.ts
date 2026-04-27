import { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.js';
import { tenantContext, requireSuperAdmin } from '../middleware/tenant.js';
import { CANONICAL_LOCAL_PART, OFFICE_LABELS, type OfficeKey } from '@lodgekey/shared';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

function randomToken(len = 24): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function mailDomainRoutes(fastify: FastifyInstance) {
  const prisma = fastify.prisma;

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', tenantContext);

  // GET /mail-domains/lodge/:lodgeId — list all mail domains configured for a lodge
  fastify.get('/lodge/:lodgeId', async (request, reply) => {
    const { lodgeId } = request.params as { lodgeId: string };
    if (!request.isSuperAdmin && request.lodgeId !== lodgeId) {
      return reply.status(403).send({ error: 'No access to this lodge' });
    }

    const domains = await prisma.lodgeMailDomain.findMany({
      where: { lodgeId },
      orderBy: { createdAt: 'asc' },
    });

    // Compute the role-address map dynamically — current Officer holders from
    // `Officer` joined to `Member` (and User if available).
    const officers = await prisma.officer.findMany({
      where: { lodgeId, isActive: true },
      orderBy: { year: 'desc' },
      include: {
        member: {
          include: { user: { select: { email: true } } },
        },
      },
    });

    // De-dupe by office, preferring the most recent year.
    const officeHolders: Record<string, { name: string; email: string | null; memberId: string }> = {};
    for (const o of officers) {
      const key = String(o.office);
      if (!officeHolders[key]) {
        officeHolders[key] = {
          name: `${o.member.firstName} ${o.member.lastName}`.trim(),
          email: o.member.user?.email ?? o.member.email ?? null,
          memberId: o.memberId,
        };
      }
    }

    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId }, select: { slug: true } });
    const offices = Object.entries(CANONICAL_LOCAL_PART).map(([office, localPart]) => ({
      office,
      localPart,
      label: OFFICE_LABELS[office as OfficeKey],
      holder: officeHolders[office] || null,
      // Apex-pattern address: <role>.<slug>@freemasons.app, available without
      // any per-tenant CF setup. Custom domains use plain <role>@<domain>.
      apexAddress: lodge?.slug ? `${localPart}.${lodge.slug}@freemasons.app` : null,
    }));

    return { domains, offices, lodgeSlug: lodge?.slug ?? null };
  });

  // POST /mail-domains/lodge/:lodgeId — register a new mail domain for a lodge
  // (super-admin only — adding a custom domain requires DNS coordination).
  fastify.post('/lodge/:lodgeId', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { lodgeId } = request.params as { lodgeId: string };
    const body = request.body as { domain: string; kind?: 'TENANT_SUBDOMAIN' | 'CUSTOM_DOMAIN' };
    if (!body?.domain || !DOMAIN_RE.test(body.domain.toLowerCase())) {
      return reply.status(400).send({ error: 'Invalid domain' });
    }
    const lodge = await prisma.lodge.findUnique({ where: { id: lodgeId } });
    if (!lodge) return reply.status(404).send({ error: 'Lodge not found' });

    const domain = body.domain.toLowerCase();
    const kind = body.kind || (domain.endsWith('.freemasons.app') ? 'TENANT_SUBDOMAIN' : 'CUSTOM_DOMAIN');

    const created = await prisma.lodgeMailDomain.create({
      data: {
        lodgeId,
        domain,
        kind,
        verificationToken: kind === 'CUSTOM_DOMAIN' ? `lodgekey-verify=${randomToken()}` : null,
        // Tenant subdomains are operationally already verified — they live on
        // freemasons.app which we control. Custom domains start PENDING and
        // flip to ACTIVE once their MX/TXT records are confirmed.
        status: kind === 'TENANT_SUBDOMAIN' ? 'ACTIVE' : 'PENDING',
        verifiedAt: kind === 'TENANT_SUBDOMAIN' ? new Date() : null,
      },
    });
    return reply.status(201).send(created);
  });

  // DELETE /mail-domains/:id — remove a mail domain
  fastify.delete('/:id', { preHandler: [requireSuperAdmin] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.lodgeMailDomain.delete({ where: { id } });
    return reply.send({ ok: true });
  });
}
