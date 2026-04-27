import { Anvil } from 'lucide-react';
import IncusChat from '@/components/incus/IncusChat';

export default function Incus() {
  return (
    <div className="space-y-6">
      <header className="rounded-[30px] border border-[var(--border-subtle)] bg-[linear-gradient(180deg,rgba(17,29,46,0.97),rgba(11,20,34,0.97))] p-8 text-white shadow-[0_20px_60px_rgba(12,22,38,0.2)]">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brass-gold/40 bg-deep-blue/60">
            <Anvil className="h-7 w-7 text-brass-gold" />
          </div>
          <div>
            <p className="eyebrow mb-1 text-brass-gold">Lodge Mentor</p>
            <h1 className="font-display text-3xl">Incus</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/72">
              Your patient guide on the Craft. Ask about ritual at your degree, lodge admin, your dues, or a piece of Masonic history. Incus only ever shares what you're permitted to know.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-[30px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] overflow-hidden">
        <IncusChat />
      </section>
    </div>
  );
}
