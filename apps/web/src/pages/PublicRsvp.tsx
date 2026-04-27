import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Loader2, Users, X } from 'lucide-react';
import api from '@/lib/api';

interface RsvpData {
  member: { id: string; firstName: string; lastName: string };
  meeting: { id: string; date: string; venue: string | null; diningCost: number | null; diningTime: string | null };
  lodge: { id: string; name: string; number: string; crestUrl: string | null; slug: string | null };
  rsvp: {
    status: 'PENDING' | 'ATTENDING' | 'ATTENDING_WITH_GUESTS' | 'NOT_ATTENDING';
    guestCount: number;
    guestNames: string | null;
    dietaryRequirements: string | null;
    notes: string | null;
    respondedAt: string | null;
  };
}

type Choice = 'ATTENDING' | 'ATTENDING_WITH_GUESTS' | 'NOT_ATTENDING';

export default function PublicRsvp() {
  const { token = '' } = useParams<{ token: string }>();
  const [data, setData] = useState<RsvpData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [choice, setChoice] = useState<Choice | null>(null);
  const [guestCount, setGuestCount] = useState(1);
  const [guestNames, setGuestNames] = useState('');
  const [dietary, setDietary] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/public/rsvp/${token}`)
      .then((r) => {
        setData(r.data);
        const cur = r.data.rsvp;
        if (cur.status !== 'PENDING') {
          setChoice(cur.status as Choice);
          setGuestCount(Math.max(1, cur.guestCount));
          setGuestNames(cur.guestNames ?? '');
          setDietary(cur.dietaryRequirements ?? '');
          setNotes(cur.notes ?? '');
        }
      })
      .catch((e) => setError(e?.response?.data?.error === 'invalid_token' ? 'invalid_token' : 'load_failed'))
      .finally(() => setLoading(false));
  }, [token]);

  const submit = async () => {
    if (!choice) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(`/public/rsvp/${token}`, {
        status: choice,
        guestCount: choice === 'ATTENDING_WITH_GUESTS' ? guestCount : 0,
        guestNames: guestNames.trim() || undefined,
        dietaryRequirements: dietary.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.error || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Frame>
        <Loader2 className="animate-spin text-brass-gold" />
      </Frame>
    );
  }
  if (error || !data) {
    return (
      <Frame>
        <div className="text-center">
          <p className="eyebrow mb-3 text-forge-orange">RSVP link invalid</p>
          <h1 className="font-display text-3xl text-off-white mb-2">This link can't be opened</h1>
          <p className="text-steel-grey">If you've already replied, you should have received a confirmation. Otherwise, contact your secretary.</p>
        </div>
      </Frame>
    );
  }

  const dateStr = new Date(data.meeting.date).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const diningCost = data.meeting.diningCost;

  if (submitted) {
    const verb = choice === 'NOT_ATTENDING'
      ? 'declined the festive board.'
      : choice === 'ATTENDING_WITH_GUESTS'
        ? `confirmed dining with ${guestCount} guest${guestCount === 1 ? '' : 's'}.`
        : 'confirmed your attendance for the festive board.';
    return (
      <Frame>
        <div className="text-center max-w-md">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-brass-gold" />
          <p className="eyebrow mb-3">{data.lodge.name} No. {data.lodge.number}</p>
          <h1 className="font-display text-3xl text-off-white mb-3">Thank you, Bro. {data.member.firstName}</h1>
          <p className="text-steel-grey leading-relaxed">You've {verb} The Director of Ceremonies has been notified.</p>
          <button onClick={() => { setSubmitted(false); }} className="mt-6 text-sm text-brass-gold underline-offset-4 hover:underline">
            Change my response
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-start gap-4">
          {data.lodge.crestUrl ? (
            <img src={data.lodge.crestUrl} alt="" className="h-16 w-16 rounded-lg border border-brass-gold/30 object-contain bg-white/5 p-2" />
          ) : null}
          <div>
            <p className="eyebrow mb-1">{data.lodge.name} No. {data.lodge.number}</p>
            <h1 className="font-display text-3xl text-off-white">Festive Board RSVP</h1>
            <p className="mt-1 text-steel-grey">{dateStr}{data.meeting.venue ? ` · ${data.meeting.venue}` : ''}</p>
            {diningCost != null && (
              <p className="mt-1 text-sm text-brass-gold">Dining: £{diningCost.toFixed(2)} per head</p>
            )}
          </div>
        </div>

        <p className="mb-6 text-off-white">Will you be joining the festive board, Bro. <strong>{data.member.firstName} {data.member.lastName}</strong>?</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <ChoiceButton selected={choice === 'ATTENDING'} onClick={() => setChoice('ATTENDING')}>
            <CheckCircle size={18} />
            <span className="font-semibold">Yes, I'll dine</span>
            <span className="text-[11px] text-steel-grey">just me</span>
          </ChoiceButton>
          <ChoiceButton selected={choice === 'ATTENDING_WITH_GUESTS'} onClick={() => setChoice('ATTENDING_WITH_GUESTS')}>
            <Users size={18} />
            <span className="font-semibold">Yes, with guests</span>
            <span className="text-[11px] text-steel-grey">specify how many</span>
          </ChoiceButton>
          <ChoiceButton selected={choice === 'NOT_ATTENDING'} onClick={() => setChoice('NOT_ATTENDING')}>
            <X size={18} />
            <span className="font-semibold">No, sending apologies</span>
            <span className="text-[11px] text-steel-grey">won't be dining</span>
          </ChoiceButton>
        </div>

        {choice === 'ATTENDING_WITH_GUESTS' && (
          <div className="mb-4">
            <label className="block text-[11px] uppercase tracking-[0.12em] text-steel-grey mb-1.5">Number of guests</label>
            <div className="flex items-center gap-3">
              <button onClick={() => setGuestCount(Math.max(1, guestCount - 1))} className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-deep-blue/60 text-off-white hover:border-brass-gold/50">−</button>
              <span className="font-display text-2xl text-off-white w-8 text-center">{guestCount}</span>
              <button onClick={() => setGuestCount(Math.min(10, guestCount + 1))} className="h-9 w-9 rounded-lg border border-[var(--border-subtle)] bg-deep-blue/60 text-off-white hover:border-brass-gold/50">+</button>
            </div>
            <label className="mt-4 block text-[11px] uppercase tracking-[0.12em] text-steel-grey mb-1.5">Guest names (optional)</label>
            <input
              value={guestNames}
              onChange={(e) => setGuestNames(e.target.value)}
              placeholder="e.g. Mrs Anne Robinson, Bro. John Smith"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-2 text-sm text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none"
            />
          </div>
        )}

        {choice && choice !== 'NOT_ATTENDING' && (
          <div className="mb-4">
            <label className="block text-[11px] uppercase tracking-[0.12em] text-steel-grey mb-1.5">Dietary requirements (optional)</label>
            <input
              value={dietary}
              onChange={(e) => setDietary(e.target.value)}
              placeholder="vegetarian, gluten-free, allergies…"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-2 text-sm text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none"
            />
          </div>
        )}

        {choice && (
          <div className="mb-6">
            <label className="block text-[11px] uppercase tracking-[0.12em] text-steel-grey mb-1.5">A note for the DC (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-2 text-sm text-off-white placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none resize-none"
              placeholder="anything else they should know…"
            />
          </div>
        )}

        <button
          onClick={submit}
          disabled={!choice || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-6 py-3 text-sm font-semibold uppercase tracking-[0.06em] text-navy transition-all duration-300 hover:shadow-glow hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Send response
        </button>

        {submitError && <p className="mt-3 text-sm text-forge-orange">{submitError}</p>}
        {data.rsvp.respondedAt && !submitted && (
          <p className="mt-4 text-xs text-steel-grey">
            You previously responded on {new Date(data.rsvp.respondedAt).toLocaleString('en-GB')}. Submitting will update your response.
          </p>
        )}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16" style={{
      background: 'radial-gradient(circle at 50% 100%, rgba(212, 117, 46, 0.08) 0%, transparent 50%), linear-gradient(180deg, #0B1A3A 0%, #0E1F42 50%, #0B1A3A 100%)',
    }}>
      {children}
    </div>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
        selected
          ? 'border-brass-gold bg-brass-gold/10 text-off-white shadow-glow'
          : 'border-[var(--border-subtle)] bg-deep-blue/40 text-off-white/80 hover:border-brass-gold/40 hover:bg-deep-blue/60'
      }`}
    >
      {children}
    </button>
  );
}
