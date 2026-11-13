'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, GitCompareArrows, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCount, formatDuration, formatMs, formatPercent } from '@/lib/format';
import type { TenantRow } from '@/lib/operator-data';

type Key =
  | 'name'
  | 'pageviews'
  | 'visitors'
  | 'bounceRate'
  | 'avgVisitSeconds'
  | 'requests'
  | 'errorRate'
  | 'p95';

const COLUMNS: { key: Key; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Project', numeric: false },
  { key: 'pageviews', label: 'Pageviews', numeric: true },
  { key: 'visitors', label: 'Visitors', numeric: true },
  { key: 'bounceRate', label: 'Bounce', numeric: true },
  { key: 'avgVisitSeconds', label: 'Avg. visit', numeric: true },
  { key: 'requests', label: 'API requests', numeric: true },
  { key: 'errorRate', label: '5xx', numeric: true },
  { key: 'p95', label: 'p95', numeric: true },
];

const STATUS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Awaiting approval' },
];

const MAX_COMPARE = 4;

function value(r: TenantRow, key: Key): number | string | null {
  if (key === 'name') return r.name.toLowerCase();
  if (key === 'requests' || key === 'errorRate' || key === 'p95') return r.api?.[key] ?? null;
  return r.web?.[key] ?? null;
}

function display(r: TenantRow, key: Key) {
  const na = <span className="text-muted-foreground">–</span>;
  switch (key) {
    case 'pageviews':
    case 'visitors':
      return r.web ? formatCount(r.web[key]) : na;
    case 'bounceRate':
      return r.web ? formatPercent(r.web.bounceRate) : na;
    case 'avgVisitSeconds':
      return r.web ? formatDuration(r.web.avgVisitSeconds) : na;
    case 'requests':
      return r.api ? formatCount(r.api.requests) : na;
    case 'errorRate':
      return r.api ? formatPercent(r.api.errorRate) : na;
    case 'p95':
      return r.api ? formatMs(r.api.p95) : na;
    default:
      return null;
  }
}

/** All tenants: search, status filter, sort on any column, select 2–4 to compare. */
export function TenantTable({
  rows,
  rangeQuery,
  compareHref = '/operator/compare',
}: {
  rows: TenantRow[];
  rangeQuery: string;
  /** Where "Compare" goes (the public demo has its own compare page). */
  compareHref?: string;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: 'pageviews', desc: true });
  const [selected, setSelected] = useState<string[]>([]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter(
        (r) =>
          (status === 'all' || r.status === status) &&
          (!needle ||
            [r.name, r.stellarId, r.ownerEmail, ...r.domains].some((s) =>
              s.toLowerCase().includes(needle),
            )),
      )
      .sort((a, b) => {
        const x = value(a, sort.key);
        const y = value(b, sort.key);
        if (x === y) return 0;
        if (x === null) return 1; // missing data sorts last either way
        if (y === null) return -1;
        return (x < y ? -1 : 1) * (sort.desc ? -1 : 1);
      });
  }, [rows, q, status, sort]);

  const toggle = (id: string) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : s.length < MAX_COMPARE ? [...s, id] : s,
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:w-80">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, domain, Stellar ID, owner"
            aria-label="Search projects"
          />
        </InputGroup>
        <Select value={status} onValueChange={(v) => setStatus(String(v))} items={STATUS}>
          <SelectTrigger className="w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STATUS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground tabular-nums">
          {shown.length} of {rows.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {selected.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              <X data-icon="inline-start" />
              Clear {selected.length}
            </Button>
          )}
          <Button
            size="sm"
            disabled={selected.length < 2}
            render={
              selected.length >= 2 ? (
                <Link href={`${compareHref}?ids=${selected.join(',')}&${rangeQuery}`} />
              ) : undefined
            }
            nativeButton={selected.length < 2}
          >
            <GitCompareArrows data-icon="inline-start" />
            {selected.length >= 2 ? `Compare ${selected.length}` : 'Select 2–4 to compare'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Select</span>
              </TableHead>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                const Icon = !active ? ArrowUpDown : sort.desc ? ArrowDown : ArrowUp;
                return (
                  <TableHead
                    key={c.key}
                    className={c.numeric ? 'text-right' : undefined}
                    aria-sort={active ? (sort.desc ? 'descending' : 'ascending') : 'none'}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className={c.numeric ? '-mr-2.5' : '-ml-2.5'}
                      onClick={() =>
                        setSort((s) => ({
                          key: c.key,
                          desc: s.key === c.key ? !s.desc : c.numeric,
                        }))
                      }
                    >
                      {c.label}
                      <Icon data-icon="inline-end" className={active ? undefined : 'opacity-40'} />
                    </Button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => {
              const checked = selected.includes(r.id);
              return (
                <TableRow key={r.id} data-state={checked ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={checked}
                      disabled={!checked && selected.length >= MAX_COMPARE}
                      onCheckedChange={() => toggle(r.id)}
                    />
                  </TableCell>
                  <TableCell className="max-w-72">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{r.name}</span>
                      {r.isDemo && <Badge variant="secondary">Demo</Badge>}
                      {r.status === 'pending' && <StatusBadge status="pending" />}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.domains.join(', ')} · {r.ownerEmail}
                    </div>
                  </TableCell>
                  {COLUMNS.slice(1).map((c) => (
                    <TableCell key={c.key} className="text-right">
                      {display(r, c.key)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            {shown.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.length + 1}
                  className="h-24 text-center text-muted-foreground"
                >
                  No projects match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
