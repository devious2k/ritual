import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import {
  buildWebsiteConfig,
  LodgeWebsiteView,
  PublicLodgeSiteResponse,
} from '@/lib/lodgeWebsite';

export default function PublicLodgeSite({ tenantLodgeId }: { tenantLodgeId?: string } = {}) {
  const params = useParams<{ lodgeId: string }>();
  const lodgeId = tenantLodgeId || params.lodgeId;

  const { data, isLoading, isError } = useQuery<PublicLodgeSiteResponse>({
    queryKey: ['public-lodge-site', lodgeId],
    queryFn: () => api.get(`/public/lodges/${lodgeId}/site`).then((r) => r.data),
    enabled: !!lodgeId,
  });

  const website = useMemo(
    () => (data ? buildWebsiteConfig(data.lodge) : null),
    [data],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] text-[var(--ink-muted)]">
        Loading lodge website...
      </div>
    );
  }

  if (isError || !data || !website) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-canvas)] px-6 text-center">
        <p className="text-lg text-[var(--ink-strong)]">This lodge website could not be loaded.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-muted)] no-underline transition hover:bg-white hover:text-[var(--ink-strong)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to app
        </Link>
      </div>
    );
  }

  return <LodgeWebsiteView lodge={data.lodge} website={website} meetings={data.meetings} />;
}
