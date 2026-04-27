const CF_API = 'https://api.cloudflare.com/client/v4';

interface CFResponse<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result?: T;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  content: string;
}

function token(): string {
  const t = process.env.CLOUDFLARE_API_TOKEN;
  if (!t) throw new Error('CLOUDFLARE_API_TOKEN not configured');
  return t;
}

function zoneId(): string {
  const z = process.env.CLOUDFLARE_ZONE_ID;
  if (!z) throw new Error('CLOUDFLARE_ZONE_ID not configured');
  return z;
}

function target(): string {
  return process.env.TENANT_DOMAIN_TARGET || 'cname.vercel-dns.com';
}

async function cfFetch<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = (await res.json()) as CFResponse<T>;
  if (!body.success) {
    const msg = body.errors?.map((e) => `[${e.code}] ${e.message}`).join('; ') || 'Cloudflare request failed';
    throw new Error(msg);
  }
  return body.result as T;
}

export async function createTenantSubdomain(slug: string): Promise<{ recordId: string; hostname: string }> {
  if (!/^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug)) {
    throw new Error('Invalid slug — lowercase letters, digits, hyphens only (max 32 chars)');
  }
  const hostname = `${slug}.freemasons.app`;

  // Idempotent: if a CNAME for this name already points at our target, reuse it.
  const existing = await cfFetch<DnsRecord[]>(
    `/zones/${zoneId()}/dns_records?name=${encodeURIComponent(hostname)}&type=CNAME`,
    { method: 'GET' },
  );
  const matched = existing.find((r) => r.content === target());
  if (matched) return { recordId: matched.id, hostname };
  if (existing.length > 0) {
    throw new Error(`A DNS record for ${hostname} already exists pointing at ${existing[0].content}. Remove it first.`);
  }

  const record = await cfFetch<DnsRecord>(`/zones/${zoneId()}/dns_records`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'CNAME',
      name: slug,
      content: target(),
      ttl: 1,
      proxied: false,
      comment: `LodgeKey tenant: ${slug}`,
    }),
  });
  return { recordId: record.id, hostname };
}

export async function removeTenantSubdomain(recordId: string): Promise<void> {
  await cfFetch<{ id: string }>(`/zones/${zoneId()}/dns_records/${recordId}`, {
    method: 'DELETE',
  });
}

/**
 * Adds MX + SPF DNS records and registers the subdomain in Cloudflare Email
 * Routing so mail to <anything>@<slug>.freemasons.app reaches the worker.
 *
 * Returns the array of CF record IDs created so they can be torn down later.
 *
 * The Email Routing subdomain registration step requires the zone token to
 * carry the "Email Routing — Edit" permission. Without it, DNS records still
 * land but mail won't be accepted until the subdomain is added in the CF
 * dashboard.
 */
export async function provisionTenantMail(slug: string): Promise<{
  hostname: string;
  recordIds: string[];
  emailRoutingRegistered: boolean;
  emailRoutingError?: string;
}> {
  const hostname = `${slug}.freemasons.app`;
  const recordIds: string[] = [];

  // Idempotently ensure MX records (priority 1/2/3) exist on the subdomain.
  for (const [priority, target] of [[1, 'route1.mx.cloudflare.net'], [2, 'route2.mx.cloudflare.net'], [3, 'route3.mx.cloudflare.net']] as const) {
    const existing = await cfFetch<Array<DnsRecord & { priority?: number }>>(
      `/zones/${zoneId()}/dns_records?type=MX&name=${encodeURIComponent(hostname)}&content=${encodeURIComponent(target)}`,
      { method: 'GET' },
    );
    if (existing.length > 0) {
      recordIds.push(existing[0].id);
      continue;
    }
    const created = await cfFetch<DnsRecord>(`/zones/${zoneId()}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'MX',
        name: slug,
        content: target,
        priority,
        ttl: 1,
        comment: `LodgeKey email routing for ${hostname}`,
      }),
    });
    recordIds.push(created.id);
  }

  // SPF TXT — idempotent.
  const spfExisting = await cfFetch<DnsRecord[]>(
    `/zones/${zoneId()}/dns_records?type=TXT&name=${encodeURIComponent(hostname)}`,
    { method: 'GET' },
  );
  const spfMatch = spfExisting.find((r) => (r.content || '').includes('include:_spf.mx.cloudflare.net'));
  if (spfMatch) {
    recordIds.push(spfMatch.id);
  } else {
    const spf = await cfFetch<DnsRecord>(`/zones/${zoneId()}/dns_records`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'TXT',
        name: slug,
        content: 'v=spf1 include:_spf.mx.cloudflare.net ~all',
        ttl: 1,
        comment: `LodgeKey SPF for ${hostname}`,
      }),
    });
    recordIds.push(spf.id);
  }

  // Register the subdomain in Email Routing. Requires zone token with
  // Email Routing — Edit. We try both potential endpoint shapes; if both
  // 401, we still consider DNS provisioning successful and return a flag.
  let emailRoutingRegistered = false;
  let emailRoutingError: string | undefined;
  try {
    await cfFetch<unknown>(
      `/zones/${zoneId()}/email/routing/dns`,
      {
        method: 'POST',
        body: JSON.stringify({ name: hostname }),
      },
    );
    emailRoutingRegistered = true;
  } catch (err: any) {
    emailRoutingError = err?.message || 'Failed to register subdomain in Email Routing';
  }

  return { hostname, recordIds, emailRoutingRegistered, emailRoutingError };
}

