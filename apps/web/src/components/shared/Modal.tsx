import { useEffect, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const widths: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-4xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-[rgba(11,20,34,0.55)] backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div
        className={`relative mx-4 max-h-[90vh] w-full overflow-y-auto rounded-[28px] border border-[var(--border-strong)] bg-[var(--surface-soft)] shadow-[0_30px_80px_rgba(12,22,38,0.28)] ${widths[size]}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--ink-faint)]">Panel</p>
            <h3 className="mt-2 font-display text-3xl text-[var(--ink-strong)]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-2xl border border-[var(--border-subtle)] bg-white/60 p-2 text-[var(--ink-muted)] transition hover:bg-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
