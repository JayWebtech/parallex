'use client';

import { ArrowUpRight } from 'lucide-react';
import type { PointerEvent } from 'react';
import { useState } from 'react';

/*
 * Illustration of the web dashboard: visitors per hour, today (so far) against
 * yesterday. Numbers are made up but deterministic, so server and client agree.
 */

const HOURS = 25; // 00:00 … 24:00
const NOW = 16; // "today" runs up to 16:00

function diurnal(h: number, scale: number, phase: number) {
  const peak = 260 * Math.exp(-((h - 14) ** 2) / (2 * 4.6 ** 2));
  const wobble = 14 * Math.sin(h * 1.7 + phase) + 9 * Math.sin(h * 0.9 + phase * 2);
  return Math.max(12, Math.round((48 + peak + wobble) * scale));
}

const YESTERDAY = Array.from({ length: HOURS }, (_, h) => diurnal(h, 0.82, 2.1));
const TODAY = Array.from({ length: NOW + 1 }, (_, h) => diurnal(h, 1, 0.4));

const TODAY_TOTAL = TODAY.reduce((a, b) => a + b, 0);
const YESTERDAY_SAME_TIME = YESTERDAY.slice(0, NOW + 1).reduce((a, b) => a + b, 0);
const DELTA = Math.round((TODAY_TOTAL / YESTERDAY_SAME_TIME - 1) * 100);

const W = 400;
const H = 150;
const PAD_TOP = 14;
const MAX = Math.max(...YESTERDAY, ...TODAY) * 1.08;
const x = (h: number) => (h / (HOURS - 1)) * W;
const y = (v: number) => PAD_TOP + (1 - v / MAX) * (H - PAD_TOP);

/** Smooth path through the points (Catmull–Rom converted to cubic Béziers). */
function smooth(values: number[]): string {
  const pts = values.map((v, h) => [x(h), y(v)] as const);
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]!.toFixed(1)},${c1[1]!.toFixed(1)} ${c2[0]!.toFixed(1)},${c2[1]!.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

const TODAY_PATH = smooth(TODAY);
const YESTERDAY_PATH = smooth(YESTERDAY);
const TODAY_AREA = `${TODAY_PATH} L${x(NOW)},${H} L0,${H} Z`;

const fmt = (n: number) => n.toLocaleString('en-US');
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function VisitorsChart() {
  const [hover, setHover] = useState<number | null>(null);

  function onMove(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const h = Math.round(((e.clientX - box.left) / box.width) * (HOURS - 1));
    setHover(Math.min(HOURS - 1, Math.max(0, h)));
  }

  const tip = hover;
  const tipToday = tip === null ? undefined : TODAY[tip];
  const tipYesterday = tip === null ? undefined : YESTERDAY[tip];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-muted-foreground">Unique visitors today</span>
          <span className="flex items-center gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">
              {fmt(TODAY_TOTAL)}
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success tabular-nums">
              <ArrowUpRight className="size-3" aria-hidden />
              {DELTA}%
            </span>
          </span>
        </div>
        <ul className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="Legend">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-chart-1" />
            Today
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground/60"
            />
            Yesterday
          </li>
        </ul>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-pan-y overflow-visible"
          role="img"
          aria-label={`Example chart: ${fmt(TODAY_TOTAL)} visitors so far today, ${DELTA}% more than yesterday at the same time.`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="visitors-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={W}
              y1={PAD_TOP + f * (H - PAD_TOP)}
              y2={PAD_TOP + f * (H - PAD_TOP)}
              stroke="var(--color-border)"
              strokeDasharray="2 4"
            />
          ))}
          <path
            d={YESTERDAY_PATH}
            fill="none"
            stroke="var(--color-muted-foreground)"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          <path d={TODAY_AREA} fill="url(#visitors-fill)" className="area-fade" />
          <path
            d={TODAY_PATH}
            pathLength={1}
            fill="none"
            stroke="var(--color-chart-1)"
            strokeWidth="2"
            strokeLinecap="round"
            className="draw-line"
          />
          {/* "Now": the live end of today's line. */}
          <g className="area-fade">
            <circle
              cx={x(NOW)}
              cy={y(TODAY[NOW]!)}
              r="9"
              fill="var(--color-chart-1)"
              className="pulse-ring"
            />
            <circle
              cx={x(NOW)}
              cy={y(TODAY[NOW]!)}
              r="4"
              fill="var(--color-chart-1)"
              stroke="var(--color-card)"
              strokeWidth="2"
            />
          </g>
          {tip !== null && (
            <g aria-hidden>
              <line
                x1={x(tip)}
                x2={x(tip)}
                y1={PAD_TOP / 2}
                y2={H}
                stroke="var(--color-foreground)"
                strokeOpacity="0.25"
              />
              <circle
                cx={x(tip)}
                cy={y(tipYesterday ?? 0)}
                r="4"
                fill="var(--color-muted-foreground)"
                stroke="var(--color-card)"
                strokeWidth="2"
              />
              {tipToday !== undefined && (
                <circle
                  cx={x(tip)}
                  cy={y(tipToday)}
                  r="4"
                  fill="var(--color-chart-1)"
                  stroke="var(--color-card)"
                  strokeWidth="2"
                />
              )}
            </g>
          )}
        </svg>

        {tip !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute -top-2 z-10 flex -translate-x-1/2 -translate-y-full flex-col gap-0.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-md"
            style={{ left: `${Math.min(88, Math.max(12, (tip / (HOURS - 1)) * 100))}%` }}
          >
            <span className="font-medium">{hourLabel(tip)}</span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0.5 w-2.5 rounded-full bg-chart-1" />
              Today
              <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">
                {tipToday !== undefined ? fmt(tipToday) : '—'}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="h-0 w-2.5 border-t-2 border-dashed border-muted-foreground/60" />
              Yesterday
              <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">
                {fmt(tipYesterday ?? 0)}
              </span>
            </span>
          </div>
        )}

        <div
          aria-hidden
          className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground tabular-nums"
        >
          {[0, 6, 12, 18, 24].map((h) => (
            <span key={h}>{hourLabel(h)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
