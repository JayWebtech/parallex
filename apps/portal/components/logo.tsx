import { PRODUCT_NAME } from '@parallax/shared';
import { cn } from '@/lib/utils';

/** Two offset frames: the same thing seen from two vantage points. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn('size-5', className)}>
      <rect x="3" y="7" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="9" y="3" width="12" height="12" rx="3" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-semibold tracking-tight', className)}>
      <span className="flex size-7 items-center justify-center rounded-md bg-brand text-white">
        <LogoMark className="size-4" />
      </span>
      {PRODUCT_NAME}
    </span>
  );
}
