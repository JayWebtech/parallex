'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function AuditFilter({ actions, value }: { actions: readonly string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const items = [
    { value: 'all', label: 'All actions' },
    ...actions.map((a) => ({ value: a, label: a })),
  ];
  return (
    <Select
      value={value}
      items={items}
      onValueChange={(v) => router.push(v === 'all' ? pathname : `${pathname}?action=${String(v)}`)}
    >
      <SelectTrigger className="w-56" aria-label="Filter by action">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((i) => (
            <SelectItem key={i.value} value={i.value}>
              {i.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
