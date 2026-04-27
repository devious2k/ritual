import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import api from '@/lib/api';
import { detectTenantSlug } from '@/lib/subdomain';
import { useTenantStore } from '@/stores/tenantStore';
import PublicLodgeSite from './PublicLodgeSite';

interface TenantPayload {
  id: string; name: string; number: string; slug: string;
  subdomain: string; siteMode: 'PUBLIC_PAGE' | 'LOGIN_DIRECT';
  domainStatus: string; crestUrl: string | null;
  venue: string | null; venueAddress: string | null; meetingDay: string | null;
}

/**
 * Renders when the user lands on `<slug>.freemasons.app/`.
 * - LOGIN_DIRECT → redirect to /login pre-scoped to that lodge.
 * - PUBLIC_PAGE  → render the LodgeKey-designed public lodge page.
 */
export default function TenantGate() {
  const navigate = useNavigate();
  const slug = detectTenantSlug();
  const setActive = useTenantStore((s) => s.setActive);

  const { data, isLoading, isError } = useQuery<TenantPayload>({
    queryKey: ['tenant-by-slug', slug],
    queryFn: async () => (await api.get(`/public/tenants/by-subdomain/${slug}`)).data,
    enabled: !!slug,
    retry: false,
  });

  useEffect(() => {
    if (data?.id) setActive(data.id);
  }, [data, setActive]);

  useEffect(() => {
    if (data?.siteMode === 'LOGIN_DIRECT') {
      navigate('/login', { replace: true });
    }
  }, [data, navigate]);

  if (!slug) return <Navigate to="/login" replace />;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy text-steel-grey">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy px-6 text-center">
        <div className="max-w-md">
          <p className="eyebrow mb-3">Unknown lodge</p>
          <h1 className="mb-3 text-3xl text-off-white">This subdomain isn't configured</h1>
          <p className="text-steel-grey">
            <code className="rounded bg-white/5 px-1.5 py-0.5">{slug}.freemasons.app</code> hasn't been set up yet.
            If you're looking for the main site, head to <a className="text-brass-gold hover:underline" href="https://app.freemasons.app">app.freemasons.app</a>.
          </p>
        </div>
      </div>
    );
  }

  if (data.siteMode === 'PUBLIC_PAGE') {
    // PublicLodgeSite reads its lodge from the URL param; we render the
    // scoped tenant version by passing the lodge id via param prop fallback.
    return <PublicLodgeSite tenantLodgeId={data.id} />;
  }

  // LOGIN_DIRECT — useEffect above handles the redirect. Show a brief loader.
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy text-steel-grey">
      <Loader2 className="animate-spin" />
    </div>
  );
}
