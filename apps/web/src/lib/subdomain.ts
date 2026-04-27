/**
 * Resolves the subdomain slug from window.location, ignoring the platform's
 * own marketing/app subdomains.
 *
 * Returns null when on the apex (`freemasons.app`), the app subdomain
 * (`app.freemasons.app`), localhost, or any non-freemasons.app host.
 */
const PLATFORM_SUBDOMAINS = new Set(['app', 'www', 'api', 'admin']);
const ROOT_DOMAIN = 'freemasons.app';

export function detectTenantSlug(host: string = window.location.host): string | null {
  const hostname = host.split(':')[0].toLowerCase();
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const labels = hostname.slice(0, -ROOT_DOMAIN.length - 1).split('.');
  if (labels.length !== 1) return null;
  const slug = labels[0];
  if (PLATFORM_SUBDOMAINS.has(slug)) return null;
  return slug;
}

export function isTenantSubdomain(): boolean {
  return detectTenantSlug() !== null;
}
