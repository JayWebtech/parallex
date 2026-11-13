'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export interface DemoNavItem {
  href: string;
  label: string;
  detail?: string;
}

/** Tabs across the demo's dashboards; the current one is underlined. */
export function DemoNav({ items }: { items: DemoNavItem[] }) {
  const pathname = usePathname();
  const current = (href: string) =>
    href === '/demo/operator' ? pathname.startsWith(href) : pathname === href;
  return (
    <nav aria-label="Demo dashboards" className="-mb-px flex gap-1 overflow-x-auto">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={current(item.href) ? 'page' : undefined}
          className={cn(
            'flex shrink-0 items-center gap-1.5 border-b-2 border-transparent px-3 py-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground',
            'aria-[current=page]:border-foreground aria-[current=page]:text-foreground',
          )}
        >
          {item.label}
          {item.detail && <span className="text-xs text-muted-foreground">{item.detail}</span>}
        </Link>
      ))}
    </nav>
  );
}
