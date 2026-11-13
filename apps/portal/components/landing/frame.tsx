import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Content width shared by sections, dividers and the vertical guides. */
export const FRAME = 'mx-auto w-full max-w-5xl';

/** Dashed vertical guides at the frame edges, behind everything on the page. */
export function GuideLines() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
      <div className={cn(FRAME, 'h-full border-x border-dashed border-foreground/12')} />
    </div>
  );
}

/** Full-bleed dashed rule with a node where it crosses each guide. */
export function Divider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('relative border-t border-dashed border-foreground/12', className)}
    >
      <div className={cn(FRAME, 'relative')}>
        <span className="absolute -top-[4.5px] -left-[4px] size-2 rounded-full border border-foreground/20 bg-background" />
        <span className="absolute -top-[4.5px] -right-[4px] size-2 rounded-full border border-foreground/20 bg-background" />
      </div>
    </div>
  );
}

/** Crop-mark corners around a box (see .brackets in globals.css). */
export function Brackets({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('brackets', className)}>
      <span aria-hidden className="bracket -top-1.5 -left-1.5 border-t border-l" />
      <span aria-hidden className="bracket -top-1.5 -right-1.5 border-t border-r" />
      <span aria-hidden className="bracket -bottom-1.5 -left-1.5 border-b border-l" />
      <span aria-hidden className="bracket -right-1.5 -bottom-1.5 border-r border-b" />
      {children}
    </div>
  );
}

/** White raised tile holding an icon (the app-icon look). */
export function IconTile({
  icon: Icon,
  className,
  size = 'md',
}: {
  icon: LucideIcon;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl border border-foreground/8 bg-background shadow-[0_1px_0_0_rgb(255_255_255)_inset,0_2px_6px_-1px_rgb(0_0_0/0.12),0_8px_16px_-8px_rgb(0_0_0/0.15)]',
        size === 'md' ? 'size-11' : 'size-9',
        className,
      )}
    >
      <Icon className={size === 'md' ? 'size-5' : 'size-4'} aria-hidden />
    </span>
  );
}

export function SectionHeading({
  title,
  subtitle,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <h2 className="max-w-2xl text-3xl font-semibold tracking-[-0.03em] text-balance md:text-5xl">
        {title}
      </h2>
      {subtitle && <p className="max-w-xl text-lg text-pretty text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
