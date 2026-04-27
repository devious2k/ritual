import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building,
  Download,
  ExternalLink,
  Globe,
  ImageUp,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils';
import Badge from '@/components/shared/Badge';
import Button from '@/components/shared/Button';
import {
  buildWebsiteConfig,
  generateWebsiteHtml,
  LodgeWebsiteLodge,
  LodgeWebsiteMeeting,
  LodgeWebsiteView,
  WebsiteConfig,
} from '@/lib/lodgeWebsite';

interface LodgeSettings extends LodgeWebsiteLodge {}
interface UpcomingMeeting extends LodgeWebsiteMeeting {}

type TabKey = 'details' | 'website';

export default function Settings() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const lodgeId = user?.lodgeId;
  const [activeTab, setActiveTab] = useState<TabKey>('details');
  const [detailsForm, setDetailsForm] = useState<Partial<LodgeSettings>>({});
  const [websiteForm, setWebsiteForm] = useState<WebsiteConfig>(() =>
    buildWebsiteConfig({
      id: '',
      name: '',
      number: '',
    }),
  );

  const { data: lodge, isLoading } = useQuery<LodgeSettings>({
    queryKey: ['lodge-settings', lodgeId],
    queryFn: () => api.get(`/lodges/${lodgeId}`).then((r) => r.data),
    enabled: !!lodgeId,
  });

  const { data: upcomingMeetings = [] } = useQuery<UpcomingMeeting[]>({
    queryKey: ['settings', 'upcoming-meetings'],
    queryFn: () =>
      api
        .get('/meetings', { params: { upcoming: true } })
        .then((r) => r.data?.data ?? r.data ?? []),
    enabled: !!lodgeId,
  });

  useEffect(() => {
    if (!lodge) return;

    setDetailsForm({
      name: lodge.name,
      number: lodge.number,
      venue: lodge.venue || '',
      venueAddress: lodge.venueAddress || '',
      meetingDay: lodge.meetingDay || '',
      meetingMonths: lodge.meetingMonths || '',
      diningCost: lodge.diningCost ?? undefined,
      tylerPhone: lodge.tylerPhone || '',
      crestUrl: lodge.crestUrl || '',
    });

    setWebsiteForm(buildWebsiteConfig(lodge));
  }, [lodge]);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/lodges/${lodgeId}`, {
        ...detailsForm,
        settings: {
          ...(lodge?.settings || {}),
          website: websiteForm,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lodge-settings', lodgeId] });
    },
  });

  const previewLodge = useMemo<LodgeSettings | null>(() => {
    if (!lodge) return null;

    return {
      ...lodge,
      ...detailsForm,
      tylerPhone: (detailsForm.tylerPhone as string) ?? lodge.tylerPhone ?? '',
      crestUrl: (detailsForm.crestUrl as string) ?? lodge.crestUrl ?? '',
    };
  }, [detailsForm, lodge]);

  const generatedHtml = useMemo(() => {
    if (!previewLodge) return '';
    return generateWebsiteHtml(previewLodge, websiteForm, upcomingMeetings);
  }, [previewLodge, websiteForm, upcomingMeetings]);

  async function handleEmblemUpload(file: File | null) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setDetailsForm((current) => ({
          ...current,
          crestUrl: result,
        }));
      }
    };
    reader.readAsDataURL(file);
  }

  function downloadWebsite() {
    if (!generatedHtml || !previewLodge) return;

    const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${previewLodge.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-website.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!lodgeId) {
    return (
      <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-6 text-sm text-[var(--ink-muted)] shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        No lodge is linked to the current user yet, so website generation is not available.
      </div>
    );
  }

  if (isLoading || !lodge || !previewLodge) {
    return <div className="py-12 text-center text-[var(--ink-muted)]">Loading settings...</div>;
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.8fr)]">
        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-8 shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--ink-faint)]">Settings</p>
          <h1 className="mt-3 font-display text-4xl text-[var(--ink-strong)]">
            Configure the lodge and generate a public-facing site from it.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--ink-muted)]">
            Keep the lodge details current, write a simple public message, and publish a polished
            public website directly from the same project.
          </p>
        </div>

        <div className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-6 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
          <p className="text-[11px] uppercase tracking-[0.28em] text-[var(--gold-soft)]">Generator status</p>
          <div className="mt-6 grid gap-3">
            <StatusTile label="Lodge" value={lodge.name} />
            <StatusTile label="Upcoming meetings" value={String(upcomingMeetings.length)} />
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Public page</p>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="success">Live route ready</Badge>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
        <div className="border-b border-[var(--border-subtle)] px-3 pt-3">
          <nav className="flex gap-1 overflow-x-auto">
            <TabButton
              active={activeTab === 'details'}
              onClick={() => setActiveTab('details')}
              icon={<Building className="h-4 w-4" />}
              label="Lodge details"
            />
            <TabButton
              active={activeTab === 'website'}
              onClick={() => setActiveTab('website')}
              icon={<Globe className="h-4 w-4" />}
              label="Website generator"
            />
          </nav>
        </div>

        {activeTab === 'details' ? (
          <div className="p-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate();
              }}
              className="grid gap-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Lodge name">
                  <input
                    value={detailsForm.name || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, name: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
                <Field label="Lodge number">
                  <input
                    value={detailsForm.number || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, number: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting venue">
                  <input
                    value={detailsForm.venue || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, venue: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
                <Field label="Venue address">
                  <input
                    value={detailsForm.venueAddress || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, venueAddress: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Meeting day">
                  <input
                    value={detailsForm.meetingDay || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, meetingDay: e.target.value })}
                    placeholder="e.g. Third Thursday"
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
                <Field label="Meeting months">
                  <input
                    value={detailsForm.meetingMonths || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, meetingMonths: e.target.value })}
                    placeholder="e.g. Sep, Oct, Nov, Jan, Feb, Mar, Apr"
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Dining cost">
                  <input
                    type="number"
                    step="0.01"
                    value={detailsForm.diningCost ?? ''}
                    onChange={(e) =>
                      setDetailsForm({
                        ...detailsForm,
                        diningCost: parseFloat(e.target.value) || undefined,
                      })
                    }
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
                <Field label="Lodge contact phone">
                  <input
                    value={detailsForm.tylerPhone || ''}
                    onChange={(e) => setDetailsForm({ ...detailsForm, tylerPhone: e.target.value })}
                    className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                  />
                </Field>
              </div>

              <Field label="Lodge emblem">
                <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                      {detailsForm.crestUrl ? (
                        <img
                          src={String(detailsForm.crestUrl)}
                          alt="Lodge emblem preview"
                          className="h-20 w-20 rounded-2xl border border-[var(--border-subtle)] bg-white object-contain p-2"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[rgba(201,168,76,0.08)] text-[var(--gold-deep)]">
                          <ImageUp className="h-8 w-8" />
                        </div>
                      )}

                      <div>
                        <p className="text-sm font-medium text-[var(--ink-strong)]">
                          Upload the emblem used on the public site
                        </p>
                        <p className="mt-1 text-sm text-[var(--ink-muted)]">
                          PNG, JPG, or SVG works best. The image is stored with the lodge settings.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[rgba(214,180,93,0.18)] bg-[linear-gradient(135deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110">
                        <ImageUp className="h-4 w-4" />
                        Upload emblem
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            void handleEmblemUpload(e.target.files?.[0] || null);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>

                      {detailsForm.crestUrl ? (
                        <button
                          type="button"
                          onClick={() => setDetailsForm({ ...detailsForm, crestUrl: '' })}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm font-medium text-[var(--ink-strong)] transition hover:bg-[var(--surface-soft)]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Field>

              <div className="flex justify-end">
                <Button type="submit" loading={updateMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Save lodge details
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {activeTab === 'website' ? (
          <div className="grid gap-6 p-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[var(--gold-deep)]" />
                  <p className="text-sm font-medium text-[var(--ink-strong)]">Public website content</p>
                </div>

                <div className="grid gap-4">
                  <Field label="Hero title">
                    <input
                      value={websiteForm.heroTitle}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, heroTitle: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Hero subtitle">
                    <textarea
                      rows={3}
                      value={websiteForm.heroSubtitle}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, heroSubtitle: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Welcome section title">
                    <input
                      value={websiteForm.welcomeTitle}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, welcomeTitle: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Welcome section body">
                    <textarea
                      rows={4}
                      value={websiteForm.welcomeBody}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, welcomeBody: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Visiting section title">
                    <input
                      value={websiteForm.visitingTitle}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, visitingTitle: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Visiting section body">
                    <textarea
                      rows={4}
                      value={websiteForm.visitingBody}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, visitingBody: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Public contact email">
                    <input
                      value={websiteForm.contactEmail}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, contactEmail: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>
                  <Field label="Public contact phone">
                    <input
                      value={websiteForm.contactPhone}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, contactPhone: e.target.value })}
                      className="w-full rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)] outline-none transition focus:border-[var(--border-strong)]"
                    />
                  </Field>

                  <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-3 text-sm text-[var(--ink-strong)]">
                    <input
                      type="checkbox"
                      checked={websiteForm.showMeetings}
                      onChange={(e) => setWebsiteForm({ ...websiteForm, showMeetings: e.target.checked })}
                    />
                    Show upcoming meetings on the website
                  </label>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>
                    <Save className="h-4 w-4" />
                    Save website settings
                  </Button>
                  <Button variant="secondary" onClick={downloadWebsite}>
                    <Download className="h-4 w-4" />
                    Download HTML
                  </Button>
                  <a
                    href={`/site/${lodgeId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open public page
                  </a>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-[var(--border-subtle)] bg-deep-blue/60 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--ink-strong)]">Live website preview</p>
                    <p className="mt-1 text-sm text-[var(--ink-muted)]">
                      Generated from lodge settings and the next {upcomingMeetings.length} meeting
                      {upcomingMeetings.length === 1 ? '' : 's'}.
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--ink-faint)]">
                    {upcomingMeetings[0] ? `Next: ${formatDate(upcomingMeetings[0].date)}` : 'No upcoming meeting'}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[28px] border border-[var(--border-subtle)] bg-white shadow-[0_18px_50px_rgba(12,22,38,0.08)]">
                <div className="border-b border-[var(--border-subtle)] bg-[rgba(239,229,211,0.6)] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                  Website Preview
                </div>
                <div className="h-[860px] overflow-auto bg-white">
                  <LodgeWebsiteView
                    lodge={previewLodge}
                    website={websiteForm}
                    meetings={upcomingMeetings}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-t-2xl px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
        active
          ? 'border border-b-0 border-[var(--border-subtle)] bg-[var(--surface-strong)] text-[var(--ink-strong)]'
          : 'text-[var(--ink-muted)] hover:bg-white/[0.04] hover:text-[var(--ink-strong)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--ink-strong)]">{label}</span>
      {children}
    </label>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</p>
      <p className="mt-1 font-display text-3xl text-white">{value}</p>
    </div>
  );
}
