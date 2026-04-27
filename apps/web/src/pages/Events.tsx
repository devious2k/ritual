import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Megaphone, Pencil, Trash2 } from 'lucide-react';
import api from '@/lib/api';

interface LodgeEvent {
  id: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  venueAddress: string | null;
  ticketPrice: number | null;
  capacity: number | null;
  allowsGuests: boolean;
  isPublished: boolean;
  imageUrl: string | null;
  sentAdvertAt: string | null;
  _count: { bookings: number };
}

const blank = { title: '', description: '', date: '', startTime: '', endTime: '', venue: '', venueAddress: '', ticketPrice: '', capacity: '', isPublished: false, allowsGuests: true, imageUrl: '' };

export default function Events() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<null | (typeof blank & { id?: string })>(null);

  const { data: events = [] } = useQuery<LodgeEvent[]>({
    queryKey: ['events'],
    queryFn: async () => (await api.get('/events')).data,
  });

  const saveMut = useMutation({
    mutationFn: async (form: typeof blank & { id?: string }) => {
      const payload: any = {
        title: form.title, description: form.description || undefined,
        date: form.date, startTime: form.startTime || undefined, endTime: form.endTime || undefined,
        venue: form.venue || undefined, venueAddress: form.venueAddress || undefined,
        ticketPrice: form.ticketPrice ? Number(form.ticketPrice) : undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        isPublished: form.isPublished, allowsGuests: form.allowsGuests,
        imageUrl: form.imageUrl || undefined,
      };
      if (form.id) return (await api.put(`/events/${form.id}`, payload)).data;
      return (await api.post('/events', payload)).data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); setEditing(null); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/events/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  const advertiseMut = useMutation({
    mutationFn: async (id: string) => (await api.post(`/events/${id}/advertise`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });

  return (
    <div className="space-y-8">
      <header className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 sm:p-8">
        <p className="eyebrow mb-1">Events</p>
        <h1 className="font-display text-3xl text-[var(--ink-strong)]">Public events &amp; calendar</h1>
        <p className="mt-2 text-sm text-steel-grey">Public meetings auto-appear on the lodge website. Add festive boards, ladies' nights, charity quizzes, open evenings — publish when ready, then blast announcements via Sendoff.</p>
        <div className="mt-4">
          <button onClick={() => setEditing({ ...blank })}
            className="inline-flex items-center gap-2 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-navy hover:shadow-glow">
            <CalendarPlus size={14} /> New event
          </button>
        </div>
      </header>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white/[0.03] p-10 text-center text-steel-grey">No events yet — click <strong>New event</strong> to add one.</div>
      ) : (
        <div className="grid gap-3">
          {events.map((e) => (
            <div key={e.id} className="rounded-2xl border border-[var(--border-subtle)] bg-deep-blue/40 p-4 flex flex-wrap justify-between gap-3 items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl text-[var(--ink-strong)]">{e.title}</h3>
                  <span className={`rounded-md px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] ${e.isPublished ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/5 text-steel-grey'}`}>{e.isPublished ? 'Published' : 'Draft'}</span>
                  {e.sentAdvertAt && <span className="rounded-md bg-brass-gold/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-brass-gold">Advertised</span>}
                </div>
                <p className="text-[12px] text-steel-grey mt-1">
                  {new Date(e.date).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
                  {e.startTime && ` · ${e.startTime}`}
                  {e.venue && ` · ${e.venue}`}
                </p>
                <p className="text-[11px] text-steel-grey mt-1">{e._count.bookings} booking{e._count.bookings === 1 ? '' : 's'}{e.ticketPrice != null ? ` · £${e.ticketPrice.toFixed(2)} per head` : ''}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setEditing({ ...blank, ...e, ticketPrice: e.ticketPrice?.toString() ?? '', capacity: e.capacity?.toString() ?? '', date: e.date.slice(0, 10) })}
                  className="rounded-sm border border-[var(--border-subtle)] bg-deep-blue/60 px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] text-steel-grey hover:border-brass-gold/40 hover:text-brass-gold">
                  <Pencil size={12} className="inline mr-1" /> Edit
                </button>
                <button onClick={() => { if (e.isPublished && confirm(`Send announcement email for "${e.title}" to all members and subscribers?`)) advertiseMut.mutate(e.id); }}
                  disabled={!e.isPublished || advertiseMut.isPending}
                  className="rounded-sm border border-brass-gold/40 bg-deep-blue/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-brass-gold hover:border-brass-gold disabled:opacity-40">
                  <Megaphone size={12} className="inline mr-1" /> {e.sentAdvertAt ? 'Re-advertise' : 'Advertise'}
                </button>
                <button onClick={() => { if (confirm('Delete this event? Bookings will be removed too.')) deleteMut.mutate(e.id); }}
                  className="rounded-sm border border-[var(--border-subtle)] bg-deep-blue/60 px-2 py-1.5 text-steel-grey hover:border-forge-orange/40 hover:text-forge-orange">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setEditing(null)}>
          <div className="bg-[var(--surface-strong)] border border-brass-gold/40 max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto rounded-2xl">
            <h2 className="font-display text-2xl text-[var(--ink-strong)] mb-4">{editing.id ? 'Edit event' : 'New event'}</h2>
            <Field label="Title *" value={editing.title} onChange={(v) => setEditing({ ...editing, title: v })} />
            <Field label="Date *" type="date" value={editing.date} onChange={(v) => setEditing({ ...editing, date: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start time" value={editing.startTime} onChange={(v) => setEditing({ ...editing, startTime: v })} placeholder="7:00pm" />
              <Field label="End time" value={editing.endTime} onChange={(v) => setEditing({ ...editing, endTime: v })} placeholder="11:00pm" />
            </div>
            <Field label="Venue" value={editing.venue} onChange={(v) => setEditing({ ...editing, venue: v })} />
            <Field label="Venue address" value={editing.venueAddress} onChange={(v) => setEditing({ ...editing, venueAddress: v })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Ticket price (£)" type="number" value={editing.ticketPrice} onChange={(v) => setEditing({ ...editing, ticketPrice: v })} />
              <Field label="Capacity" type="number" value={editing.capacity} onChange={(v) => setEditing({ ...editing, capacity: v })} />
            </div>
            <Field label="Image URL (optional)" value={editing.imageUrl} onChange={(v) => setEditing({ ...editing, imageUrl: v })} />
            <label className="block text-[11px] uppercase tracking-[0.12em] text-steel-grey mt-3 mb-1">Description</label>
            <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={4}
              className="w-full rounded-md border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2 text-sm text-[var(--ink-strong)] focus:border-brass-gold/60 focus:outline-none" />
            <label className="flex items-center gap-2 mt-3 text-sm text-[var(--ink-strong)]">
              <input type="checkbox" checked={editing.isPublished} onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })} />
              Published — visible on the lodge website
            </label>
            <label className="flex items-center gap-2 mt-1 text-sm text-[var(--ink-strong)]">
              <input type="checkbox" checked={editing.allowsGuests} onChange={(e) => setEditing({ ...editing, allowsGuests: e.target.checked })} />
              Guests allowed
            </label>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="rounded-sm border border-[var(--border-subtle)] bg-deep-blue/60 px-4 py-2 text-xs uppercase tracking-[0.06em] text-steel-grey hover:border-brass-gold/40">Cancel</button>
              <button onClick={() => editing && saveMut.mutate(editing)} disabled={!editing.title || !editing.date || saveMut.isPending}
                className="rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-navy hover:shadow-glow disabled:opacity-40">
                {saveMut.isPending ? 'Saving…' : editing.id ? 'Save changes' : 'Create event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-[0.12em] text-steel-grey mt-3 mb-1">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2 text-sm text-[var(--ink-strong)] focus:border-brass-gold/60 focus:outline-none" />
    </label>
  );
}
