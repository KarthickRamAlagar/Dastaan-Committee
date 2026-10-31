'use client';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const variants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 select-none',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-[0_8px_22px_-10px_hsl(var(--primary)/0.8)] hover:brightness-110',
        secondary: 'border border-border bg-muted/70 text-foreground hover:bg-muted',
        ghost: 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        danger: 'bg-danger/90 text-white hover:bg-danger',
        outline: 'border border-primary/50 text-primary hover:bg-primary/10',
      },
      size: { sm: 'h-8 px-3 text-[13px]', md: 'h-10 px-4', lg: 'h-11 px-5 text-[15px]', icon: 'size-9' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  loading?: boolean;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, children, disabled, type = 'button', ...p }, ref) => (
  <button ref={ref} type={type} disabled={disabled || loading} className={cn(variants({ variant, size }), className)} {...p}>
    {loading && <Loader2 className="animate-spin" aria-hidden />}
    {children}
  </button>
));
Button.displayName = 'Button';
