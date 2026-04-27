import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, GripVertical, Loader2, Save, Sparkles, User } from 'lucide-react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import api from '@/lib/api';
import Button from '@/components/shared/Button';

type Office = string;

const OFFICES: { key: string; label: string }[] = [
  { key: 'WORSHIPFUL_MASTER', label: 'Worshipful Master' },
  { key: 'IMMEDIATE_PAST_MASTER', label: 'Immediate Past Master' },
  { key: 'SENIOR_WARDEN', label: 'Senior Warden' },
  { key: 'JUNIOR_WARDEN', label: 'Junior Warden' },
  { key: 'CHAPLAIN', label: 'Chaplain' },
  { key: 'TREASURER', label: 'Treasurer' },
  { key: 'SECRETARY', label: 'Secretary' },
  { key: 'ASSISTANT_SECRETARY', label: 'Assistant Secretary' },
  { key: 'DIRECTOR_OF_CEREMONIES', label: 'Director of Ceremonies' },
  { key: 'ASSISTANT_DIRECTOR_OF_CEREMONIES', label: 'Assistant DC' },
  { key: 'ALMONER', label: 'Almoner' },
  { key: 'CHARITY_STEWARD', label: 'Charity Steward' },
  { key: 'MENTOR', label: 'Mentor' },
  { key: 'MEMBERSHIP_OFFICER', label: 'Membership Officer' },
  { key: 'SENIOR_DEACON', label: 'Senior Deacon' },
  { key: 'JUNIOR_DEACON', label: 'Junior Deacon' },
  { key: 'INNER_GUARD', label: 'Inner Guard' },
  { key: 'TYLER', label: 'Tyler' },
  { key: 'ORGANIST', label: 'Organist' },
  { key: 'SENIOR_STEWARD', label: 'Senior Steward' },
  { key: 'STEWARD_1', label: 'Steward (1)' },
  { key: 'STEWARD_2', label: 'Steward (2)' },
  { key: 'STEWARD_3', label: 'Steward (3)' },
];

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  photoUrl?: string | null;
}

interface BlockAssignment {
  id: string;
  ritualBlockId: string;
  ritualBlock: {
    id: string; title: string; description: string | null;
    degree: string; defaultOffice: Office | null;
  };
  assignedMember: Member | null;
  orderIndex: number;
  notes: string | null;
  isOverride: boolean;
}

interface CeremonyPlan {
  id: string;
  ceremonyType: string;
  degree: 'FIRST' | 'SECOND' | 'THIRD' | 'INSTALLATION' | 'MARK' | 'HOLY_ROYAL_ARCH' | 'OTHER' | null;
  candidateId: string | null;
  notes: string | null;
  isConfirmed: boolean;
  meeting: { id: string; date: string; type: string; lodgeId: string };
  roles: Array<{ role: string; member: Member }>;
  blockAssignments: BlockAssignment[];
}

export default function CeremonyWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);

  const { data: ceremony, isLoading } = useQuery<CeremonyPlan>({
    queryKey: ['ceremony', id],
    queryFn: async () => (await api.get(`/ritual/ceremonies/${id}`)).data,
    enabled: !!id,
  });

  const confirmMut = useMutation({
    mutationFn: async (next: boolean) => (await api.put(`/ritual/ceremonies/${id}`, { isConfirmed: next })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ceremony', id] });
      qc.invalidateQueries({ queryKey: ['ceremonies'] });
    },
  });

  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['members-pool'],
    queryFn: async () => {
      const { data } = await api.get('/members?limit=500');
      // Members API can respond as `[...]`, `{ data: [...] }`, or `{ members: [...] }`.
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.data)) return data.data;
      if (Array.isArray(data?.members)) return data.members;
      return [];
    },
  });

  if (isLoading || !ceremony) {
    return <div className="flex items-center justify-center py-16 text-steel-grey"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-start gap-3">
          <Link to="/ceremonies" className="text-steel-grey hover:text-off-white"><ChevronLeft /></Link>
          <div className="flex-1 min-w-0">
            <p className="eyebrow mb-1">{new Date(ceremony.meeting.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h1 className="text-2xl sm:text-3xl text-off-white">{ceremony.ceremonyType}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:ml-auto">
          <span className={`rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${
            ceremony.isConfirmed
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
              : 'border-brass-gold/40 bg-deep-blue/60 text-brass-gold'
          }`}>
            {ceremony.isConfirmed ? 'Confirmed' : 'Draft'}
          </span>
          <button
            onClick={() => {
              if (!ceremony.isConfirmed && !confirm('Mark this ceremony as confirmed? Officers and ritual blocks should be finalised first.')) return;
              confirmMut.mutate(!ceremony.isConfirmed);
            }}
            disabled={confirmMut.isPending}
            className={`inline-flex items-center gap-1.5 rounded-sm px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] transition-all duration-300 disabled:opacity-40 ${
              ceremony.isConfirmed
                ? 'border border-[var(--border-subtle)] bg-deep-blue/60 text-steel-grey hover:border-forge-orange/60 hover:text-forge-orange'
                : 'bg-gradient-to-br from-brass-gold to-warm-gold text-navy hover:shadow-glow hover:-translate-y-0.5'
            }`}
          >
            {confirmMut.isPending ? 'Saving…' : ceremony.isConfirmed ? 'Reopen as draft' : 'Mark as confirmed'}
          </button>
          <StepBadge step={1} active={step === 1}>Positions</StepBadge>
          <StepBadge step={2} active={step === 2}>Ritual blocks</StepBadge>
        </div>
      </div>

      {step === 1 ? (
        <PositionsStep ceremony={ceremony} members={members} onNext={() => setStep(2)} qc={qc} />
      ) : (
        <BlocksStep ceremony={ceremony} members={members} onBack={() => setStep(1)} onDone={() => navigate('/ceremonies')} qc={qc} />
      )}
    </div>
  );
}

function StepBadge({ step, active, children }: { step: number; active: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.12em] ${
      active
        ? 'border-brass-gold/60 bg-brass-gold/10 text-brass-gold'
        : 'border-[var(--border-subtle)] text-steel-grey'
    }`}>
      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${active ? 'bg-brass-gold text-navy' : 'bg-white/5'}`}>{step}</span>
      {children}
    </div>
  );
}

// ─── STEP 1: POSITIONS ───────────────────────────────────────────────────────

function PositionsStep({
  ceremony, members, onNext, qc,
}: {
  ceremony: CeremonyPlan; members: Member[]; onNext: () => void; qc: ReturnType<typeof useQueryClient>;
}) {
  const initial = useMemo(() => {
    const map: Record<string, string | null> = {};
    OFFICES.forEach((o) => {
      const role = ceremony.roles.find((r) => r.role === o.key);
      map[o.key] = role?.member.id ?? null;
    });
    return map;
  }, [ceremony]);

  const [positions, setPositions] = useState<Record<string, string | null>>(initial);

  // Re-sync local state whenever the ceremony refetches (e.g. after a seed or
  // save). Without this, useState's lazy init swallows ceremony updates.
  useEffect(() => { setPositions(initial); }, [initial]);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragStart = (e: DragStartEvent) => {
    if (typeof e.active.id === 'string' && e.active.id.startsWith('member:')) {
      setActiveMemberId(e.active.id.slice('member:'.length));
    }
  };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveMemberId(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !activeId.startsWith('member:')) return;
    const memberId = activeId.slice('member:'.length);
    if (overId.startsWith('office:')) {
      const office = overId.slice('office:'.length);
      setPositions((p) => ({ ...p, [office]: memberId }));
    }
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = OFFICES
        .filter((o) => positions[o.key])
        .map((o) => ({ role: o.key, memberId: positions[o.key]! }));
      await api.put(`/ritual/ceremonies/${ceremony.id}/positions`, { positions: payload });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony', ceremony.id] }),
  });

  const seedMut = useMutation({
    mutationFn: async () => (await api.post(`/ritual/ceremonies/${ceremony.id}/seed-from-officers`)).data,
    onSuccess: ({ positions: rows }: { positions: Array<{ role: string; member: { id: string } }> }) => {
      const next: Record<string, string | null> = { ...positions };
      rows.forEach((r) => { next[r.role] = r.member.id; });
      setPositions(next);
      qc.invalidateQueries({ queryKey: ['ceremony', ceremony.id] });
    },
  });

  const activeMember = members.find((m) => m.id === activeMemberId);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-12 gap-6">
        <MembersRail members={members} title="Members" subtitle="Drag onto a position" />
        <div className="col-span-12 md:col-span-8">
          <div className="mb-3 flex items-center justify-between">
            <SectionHeader>
              Step 1 — Officer positions
              <span className="text-steel-grey font-normal text-sm"> · drag any member onto a position to override</span>
            </SectionHeader>
            <Button variant="secondary" onClick={() => seedMut.mutate()} loading={seedMut.isPending}>
              <Sparkles size={14} /> Pre-fill from current officers
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OFFICES.map((o) => (
              <OfficeSlot
                key={o.key}
                office={o.key}
                label={o.label}
                member={members.find((m) => m.id === positions[o.key]) || null}
                onClear={() => setPositions((p) => ({ ...p, [o.key]: null }))}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <Button onClick={() => saveMut.mutate()} loading={saveMut.isPending} variant="secondary"><Save size={14} /> Save positions</Button>
            <Button onClick={async () => { await saveMut.mutateAsync(); onNext(); }}>
              Next: ritual blocks <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeMember ? <MemberChip member={activeMember} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function OfficeSlot({
  office, label, member, onClear,
}: {
  office: Office; label: string; member: Member | null; onClear: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `office:${office}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors ${
        isOver
          ? 'border-brass-gold bg-brass-gold/10'
          : 'border-[var(--border-subtle)] bg-white/[0.02]'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-steel-grey">{label}</p>
      {member ? (
        <div className="mt-1.5 flex items-center justify-between">
          <span className="truncate text-sm text-off-white">{member.firstName} {member.lastName}</span>
          <button onClick={onClear} className="text-xs text-steel-grey hover:text-forge-orange">×</button>
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-steel-grey/60 italic">vacant — drop a member</p>
      )}
    </div>
  );
}

// ─── STEP 2: RITUAL BLOCKS ──────────────────────────────────────────────────

function BlocksStep({
  ceremony, members, onBack, onDone, qc,
}: {
  ceremony: CeremonyPlan; members: Member[]; onBack: () => void; onDone: () => void; qc: ReturnType<typeof useQueryClient>;
}) {
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [orderedBlocks, setOrderedBlocks] = useState<BlockAssignment[]>(ceremony.blockAssignments);

  useEffect(() => { setOrderedBlocks(ceremony.blockAssignments); }, [ceremony.blockAssignments]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const autoFillMut = useMutation({
    mutationFn: async () => (await api.post(`/ritual/ceremonies/${ceremony.id}/auto-fill`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony', ceremony.id] }),
  });

  const overrideMut = useMutation({
    mutationFn: async (vars: { blockId: string; memberId: string | null }) =>
      (await api.put(`/ritual/ceremonies/${ceremony.id}/blocks/${vars.blockId}`, { assignedMemberId: vars.memberId })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ceremony', ceremony.id] }),
  });

  const reorderMut = useMutation({
    mutationFn: async (order: Array<{ blockId: string; orderIndex: number }>) =>
      api.put(`/ritual/ceremonies/${ceremony.id}/blocks`, { order }),
  });

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('member:')) setActiveMemberId(id.slice('member:'.length));
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveMemberId(null);
    const activeId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId || !overId.startsWith('blockrow:')) return;
    const blockId = overId.slice('blockrow:'.length);

    // Member dropped onto a block — assign that member as override.
    if (activeId.startsWith('member:')) {
      const memberId = activeId.slice('member:'.length);
      // Optimistic UI update so the chip appears instantly.
      const targetMember = members.find((m) => m.id === memberId);
      if (targetMember) {
        setOrderedBlocks((prev) =>
          prev.map((b) =>
            b.ritualBlockId === blockId
              ? { ...b, assignedMember: targetMember, isOverride: true }
              : b,
          ),
        );
      }
      overrideMut.mutate({ blockId, memberId });
      return;
    }

    // Block reorder.
    if (activeId.startsWith('blockrow:')) {
      const fromId = activeId.slice('blockrow:'.length);
      const fromIdx = orderedBlocks.findIndex((b) => b.ritualBlockId === fromId);
      const toIdx = orderedBlocks.findIndex((b) => b.ritualBlockId === blockId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      const next = arrayMove(orderedBlocks, fromIdx, toIdx).map((b, i) => ({ ...b, orderIndex: i }));
      setOrderedBlocks(next);
      reorderMut.mutate(next.map((b) => ({ blockId: b.ritualBlockId, orderIndex: b.orderIndex })));
    }
  };

  const activeMember = members.find((m) => m.id === activeMemberId);
  const blockIds = orderedBlocks.map((b) => `blockrow:${b.ritualBlockId}`);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-12 gap-6">
        <MembersRail members={members} title="Members" subtitle="Drag onto a ritual block" />
        <div className="col-span-12 md:col-span-8">
          <div className="mb-4 flex items-center justify-between">
            <SectionHeader>
              Step 2 — Ritual blocks
              <span className="text-steel-grey font-normal text-sm"> · auto-filled from positions, drag any member to override</span>
            </SectionHeader>
            <Button variant="secondary" onClick={() => autoFillMut.mutate()} loading={autoFillMut.isPending}>
              <Sparkles size={14} /> Auto-fill from positions
            </Button>
          </div>

          {orderedBlocks.length === 0 ? (
            <div className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-8 text-center text-steel-grey">
              No blocks yet. Click <strong className="text-off-white">Auto-fill from positions</strong> to populate using the Emulation library for {ceremony.degree?.toLowerCase() || 'this'} degree.
            </div>
          ) : (
            <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {orderedBlocks.map((b) => (
                  <BlockRow
                    key={b.ritualBlockId}
                    assignment={b}
                    onClear={() => overrideMut.mutate({ blockId: b.ritualBlockId, memberId: null })}
                  />
                ))}
              </ul>
            </SortableContext>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onBack}><ChevronLeft size={14} /> Back to positions</Button>
            <Button onClick={onDone}>Done</Button>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeMember ? <MemberChip member={activeMember} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function BlockRow({ assignment, onClear }: { assignment: BlockAssignment; onClear: () => void }) {
  const id = `blockrow:${assignment.ritualBlockId}`;
  const sortable = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <li
      ref={sortable.setNodeRef}
      style={style}
      className={`rounded-lg border p-3 transition-colors ${
        sortable.isOver
          ? 'border-brass-gold bg-brass-gold/10'
          : 'border-[var(--border-subtle)] bg-white/[0.02]'
      } ${sortable.isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          {...sortable.attributes}
          {...sortable.listeners}
          className="cursor-grab text-steel-grey hover:text-off-white"
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-off-white">{assignment.ritualBlock.title}</p>
          {assignment.ritualBlock.description && (
            <p className="truncate text-xs text-steel-grey">{assignment.ritualBlock.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {assignment.assignedMember ? (
            <>
              <span className="rounded-md border border-[var(--border-subtle)] bg-deep-blue/40 px-2 py-1 text-xs text-off-white">
                {assignment.assignedMember.firstName} {assignment.assignedMember.lastName}
              </span>
              {assignment.isOverride && (
                <span className="rounded-md bg-brass-gold/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-brass-gold">override</span>
              )}
              <button onClick={onClear} className="text-xs text-steel-grey hover:text-forge-orange" title="Clear">×</button>
            </>
          ) : (
            <span className="text-xs italic text-steel-grey/60">drop a member</span>
          )}
        </div>
      </div>
    </li>
  );
}

// ─── SHARED ─────────────────────────────────────────────────────────────────

function MembersRail({ members, title, subtitle }: { members: Member[]; title: string; subtitle: string }) {
  const [filter, setFilter] = useState('');
  const haystack = (m: Member) => `${m.firstName} ${m.lastName} ${m.email ?? ''}`.toLowerCase();
  // Token-based search: every whitespace-separated word in the query must
  // appear somewhere in the member's name/email — order-independent so
  // "james white" finds "James Robert White".
  const tokens = filter.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = members.filter((m) => {
    if (!tokens.length) return true;
    const h = haystack(m);
    return tokens.every((t) => h.includes(t));
  });
  return (
    <aside className="col-span-12 md:col-span-4 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
      <p className="eyebrow mb-1">{title}</p>
      <p className="mb-3 text-xs text-steel-grey">{subtitle}</p>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Search…"
        className="mb-3 w-full rounded-lg border border-[var(--border-subtle)] bg-navy/40 px-3 py-1.5 text-sm text-off-white placeholder:text-steel-grey/60"
      />
      <ul className="space-y-1.5">
        {filtered.map((m) => <MemberDraggable key={m.id} member={m} />)}
        {filtered.length === 0 && <p className="text-xs text-steel-grey/70">No matches.</p>}
      </ul>
    </aside>
  );
}

function MemberDraggable({ member }: { member: Member }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `member:${member.id}` });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`flex cursor-grab items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-white/[0.02] px-2 py-1.5 text-sm text-off-white hover:border-brass-gold/40 hover:bg-white/5 ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <User size={12} className="text-steel-grey" />
      <span className="truncate">{member.firstName} {member.lastName}</span>
    </li>
  );
}

function MemberChip({ member, dragging }: { member: Member; dragging?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border border-brass-gold/60 bg-deep-blue px-2 py-1 text-sm text-off-white shadow-glow ${dragging ? 'cursor-grabbing' : ''}`}>
      <User size={12} className="text-brass-gold" />
      {member.firstName} {member.lastName}
    </span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg text-off-white font-display">{children}</h2>;
}
