import { ReactNode } from 'react';
import { classNames } from '@/lib/utils';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  children: ReactNode;
  className?: string;
}

const variantStyles: Record<string, string> = {
  default: 'border border-[var(--border-subtle)] bg-white/5 text-[var(--ink-muted)]',
  success: 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
  warning: 'border border-forge-orange/30 bg-forge-orange/10 text-forge-orange',
  danger: 'border border-red-400/30 bg-red-500/10 text-red-300',
  info: 'border border-[var(--border-strong)] bg-[rgba(201,162,74,0.12)] text-brass-gold',
};

export default function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span
      className={classNames(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
