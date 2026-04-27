const VERCEL_API = 'https://api.vercel.com';

function token(): string {
  const t = process.env.VERCEL_API_TOKEN;
  if (!t) throw new Error('VERCEL_API_TOKEN not configured');
  return t;
}

function projectId(): string {
  const p = process.env.VERCEL_PROJECT_ID;
  if (!p) throw new Error('VERCEL_PROJECT_ID not configured');
  return p;
}

function teamQuery(): string {
  const teamId = process.env.VERCEL_TEAM_ID;
  return teamId ? `?teamId=${teamId}` : '';
}

async function vercelFetch<T>(path: string, init: RequestInit): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const teamId = process.env.VERCEL_TEAM_ID;
  const url = `${VERCEL_API}${path}${teamId ? `${sep}teamId=${teamId}` : ''}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.error || `Vercel ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return body as T;
}

export async function attachDomain(hostname: string): Promise<{ name: string; verified: boolean }> {
  const result = await vercelFetch<{ name: string; verified: boolean }>(
    `/v10/projects/${projectId()}/domains${teamQuery()}`,
    {
      method: 'POST',
      body: JSON.stringify({ name: hostname }),
    },
  );
  return result;
}

export async function detachDomain(hostname: string): Promise<void> {
  await vercelFetch<unknown>(
    `/v9/projects/${projectId()}/domains/${encodeURIComponent(hostname)}`,
    { method: 'DELETE' },
  );
}

export async function getDomainStatus(hostname: string): Promise<{ verified: boolean }> {
  return vercelFetch<{ verified: boolean }>(
    `/v9/projects/${projectId()}/domains/${encodeURIComponent(hostname)}`,
    { method: 'GET' },
  );
}
