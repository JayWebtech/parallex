'use client';

import { CalendarRange } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const PRESETS = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
] as const;

/**
 * Time range as URL state (shareable links). Presets are a toggle group; a
 * custom UTC date range sits behind a popover. Extra params (e.g. compared
 * project IDs) are preserved.
 */
export function RangePicker({
  current,
  from,
  to,
  params = {},
}: {
  current: string;
  from?: string | undefined;
  to?: string | undefined;
  params?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const go = (next: Record<string, string>) =>
    router.push(`${pathname}?${new URLSearchParams({ ...params, ...next })}`);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        variant="outline"
        size="sm"
        value={current === 'custom' ? [] : [current]}
        onValueChange={(v) => {
          const key = v[0];
          if (typeof key === 'string') go({ range: key });
        }}
        aria-label="Time range"
      >
        {PRESETS.map((p) => (
          <ToggleGroupItem key={p.key} value={p.key}>
            {p.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant={current === 'custom' ? 'secondary' : 'outline'} size="sm" />}
        >
          <CalendarRange data-icon="inline-start" />
          {current === 'custom' && from && to ? `${from} → ${to}` : 'Custom'}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setOpen(false);
              go({ range: 'custom', from: String(data.get('from')), to: String(data.get('to')) });
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="range-from">From (UTC)</FieldLabel>
                <Input
                  id="range-from"
                  name="from"
                  type="date"
                  max={today}
                  defaultValue={from}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="range-to">To (UTC)</FieldLabel>
                <Input id="range-to" name="to" type="date" max={today} defaultValue={to} required />
              </Field>
              <Button type="submit">Apply range</Button>
            </FieldGroup>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
