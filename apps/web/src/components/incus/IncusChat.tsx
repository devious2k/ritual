import { FormEvent, useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Loader2, Send, Sparkles } from 'lucide-react';
import api from '@/lib/api';

interface ChatMsg { role: 'user' | 'assistant'; content: string; toolCalls?: string[]; }

const STARTERS = [
  "What's coming up at the lodge?",
  'Have I paid my subs this Masonic year?',
  'Tell me a knowledge nugget about the working tools.',
  'Who founded Vulcan Lodge?',
  'How should I prepare for my next meeting?',
];

export default function IncusChat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMut = useMutation({
    mutationFn: async (message: string) => {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data } = await api.post('/ai/incus', { message, history });
      return data as { reply: string; toolCalls: string[] };
    },
    onSuccess: (res) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, toolCalls: res.toolCalls }]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sendMut.isPending]);

  const submit = (e: FormEvent | null, override?: string) => {
    e?.preventDefault();
    const text = (override ?? input).trim();
    if (!text || sendMut.isPending) return;
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    sendMut.mutate(text);
  };

  return (
    <div className={`flex flex-col ${compact ? 'h-full' : ''}`} style={compact ? undefined : { minHeight: '60vh' }}>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-6">
            <Sparkles className="mx-auto mb-3 h-7 w-7 text-brass-gold/60" />
            <p className="text-sm text-steel-grey">Try one of these to get started:</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => submit(null, s)}
                  className="rounded-full border border-brass-gold/30 bg-deep-blue/60 px-3 py-1.5 text-[11px] text-brass-gold hover:border-brass-gold hover:bg-deep-blue">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => <Bubble key={i} message={m} />)
        )}
        {sendMut.isPending && (
          <div className="flex items-center gap-2 text-steel-grey">
            <Loader2 size={14} className="animate-spin text-brass-gold" />
            <span className="text-sm">Incus is at the anvil…</span>
          </div>
        )}
        {sendMut.isError && (
          <div className="rounded-lg border border-forge-orange/30 bg-forge-orange/10 p-3 text-sm text-forge-orange">
            {(sendMut.error as any)?.response?.data?.error ?? 'Something went wrong — try again.'}
          </div>
        )}
      </div>

      <form onSubmit={(e) => submit(e)} className="border-t border-[var(--border-subtle)] p-3 flex gap-2 bg-[var(--surface-soft)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Incus something…"
          className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-deep-blue/40 px-3 py-2 text-sm text-[var(--ink-strong)] placeholder:text-steel-grey/60 focus:border-brass-gold/60 focus:outline-none"
        />
        <button type="submit" disabled={!input.trim() || sendMut.isPending}
          className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-br from-brass-gold to-warm-gold px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-navy hover:shadow-glow disabled:opacity-40">
          <Send size={13} /> Send
        </button>
      </form>
    </div>
  );
}

function Bubble({ message }: { message: ChatMsg }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
        isUser
          ? 'bg-gradient-to-br from-brass-gold to-warm-gold text-navy'
          : 'border border-[var(--border-subtle)] bg-deep-blue/40 text-[var(--ink-strong)]'
      }`}>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-steel-grey">
            ↳ consulted: {message.toolCalls.join(', ')}
          </p>
        )}
      </div>
    </div>
  );
}
