'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/*
 * Illustration of the API dashboard: a deck of per-route cards that cycles.
 * Routes come from examples/express-api; the numbers are made up.
 */

type Route = {
  method: 'GET' | 'POST';
  path: string;
  p50: number;
  p95: number;
  rpm: string;
  /** Share of responses per status class, in percent. */
  status: { s2: number; s4: number; s5: number };
};

const ROUTES: Route[] = [
  {
    method: 'GET',
    path: '/accounts/:accountId',
    p50: 38,
    p95: 84,
    rpm: '1.2k',
    status: { s2: 98.6, s4: 1.2, s5: 0.2 },
  },
  {
    method: 'POST',
    path: '/quotes',
    p50: 112,
    p95: 318,
    rpm: '240',
    status: { s2: 93.5, s4: 5.1, s5: 1.4 },
  },
  {
    method: 'GET',
    path: '/transactions/:hash',
    p50: 27,
    p95: 61,
    rpm: '860',
    status: { s2: 96.9, s4: 3.0, s5: 0.1 },
  },
  {
    method: 'GET',
    path: '/contracts/:contractId/events',
    p50: 96,
    p95: 236,
    rpm: '410',
    status: { s2: 99.1, s4: 0.4, s5: 0.5 },
  },
  {
    method: 'GET',
    path: '/accounts/:accountId/payments',
    p50: 54,
    p95: 142,
    rpm: '690',
    status: { s2: 97.8, s4: 2.0, s5: 0.2 },
  },
];

const N = ROUTES.length;

/** Slot styles: 0 = front, 1–2 peeking behind, 3 = hidden behind, N-1 = leaving. */
function slot(pos: number) {
  if (pos === 0) return 'z-30 translate-y-0 scale-100 opacity-100';
  if (pos === 1) return 'z-20 -translate-y-3.5 scale-[0.95] opacity-70';
  if (pos === 2) return 'z-10 -translate-y-7 scale-[0.9] opacity-35';
  if (pos === N - 1) return 'z-40 translate-y-6 scale-[1.02] opacity-0';
  return 'z-0 -translate-y-9 scale-[0.85] opacity-0';
}

export function RouteStack() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setTick((t) => t + 1);
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">Requests, last hour</span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">204,180</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2 py-0.5 text-xs font-medium">
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
            <span className="relative size-1.5 rounded-full bg-success" />
          </span>
          Live
        </span>
      </div>
      <RouteDeck tick={tick} />
    </div>
  );
}

function RouteDeck({ tick }: { tick: number }) {
  return (
    <div className="relative h-36" aria-hidden>
      {ROUTES.map((r, i) => {
        const pos = (((i - tick) % N) + N) % N;
        return (
          <div
            key={r.path}
            className={cn(
              'absolute inset-x-0 bottom-0 origin-top transition-[translate,scale,opacity] duration-500 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
              slot(pos),
            )}
          >
            <RouteCard route={r} />
          </div>
        );
      })}
    </div>
  );
}

function RouteCard({ route: r }: { route: Route }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_24px_-12px_rgb(0_0_0/0.18)]">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold',
            r.method === 'GET' ? 'bg-chart-1/12 text-chart-1' : 'bg-chart-3/12 text-chart-3',
          )}
        >
          {r.method}
        </span>
        <span className="truncate font-mono text-sm">{r.path}</span>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs">
        {[
          ['p50', `${r.p50} ms`],
          ['p95', `${r.p95} ms`],
          ['req/min', r.rpm],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        <span className="rounded-full bg-status-2xx" style={{ flexGrow: r.status.s2 }} />
        <span className="rounded-full bg-status-4xx" style={{ flexGrow: r.status.s4 * 6 }} />
        <span className="rounded-full bg-status-5xx" style={{ flexGrow: r.status.s5 * 6 }} />
      </div>
    </div>
  );
}
