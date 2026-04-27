import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const variantStyles: Record<string, string> = {
  primary:
    'bg-gradient-to-br from-brass-gold to-warm-gold text-navy font-semibold uppercase tracking-[0.06em] hover:shadow-glow hover:-translate-y-0.5 focus:ring-brass-gold/40',
  secondary:
    'bg-deep-blue/60 text-off-white border border-brass-gold/30 hover:border-brass-gold/60 hover:bg-deep-blue focus:ring-brass-gold/30',
  danger:
    'bg-forge-orange text-off-white hover:bg-ember focus:ring-forge-orange/40',
  ghost:
    'bg-transparent text-off-white/80 hover:bg-white/5 hover:text-off-white focus:ring-white/20',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-sm',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className = '', children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-sm transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-navy disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
export default Button;
