'use client';

import { useEffect, useRef, useState } from 'react';
import { formatBucket, formatCount } from '@/lib/format';

export interface Point {
  x: string;
  pageviews: number;
  visits: number;
}

const SERIES = [
  { key: 'pageviews', label: 'Pageviews', color: 'var(--series-1)' },
  { key: 'visits', label: 'Visits', color: 'var(--series-2)' },
] as const;

const HEIGHT = 240;
const PAD = { top: 12, right: 72, bottom: 28, left: 44 };

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => v <= s * 4) ?? 10 * mag;
  return step * 4;
}

/**
 * Two series on one axis (both are counts), 2px lines, recessive grid, legend
 * plus direct end labels, crosshair tooltip on hover, and a table view.
 */
export function TimeSeriesChart({ points, unit }: { points: Point[]; unit: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (points.length === 0) {
    return <p className="text-sm text-muted py-16 text-center">No data in this range</p>;
  }

  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const yMax = niceMax(Math.max(...points.map((p) => Math.max(p.pageviews, p.visits))));
  const xAt = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const yAt = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const ticks = [0, 1, 2, 3, 4].map((i) => (yMax / 4) * i);
  const xLabels = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
  const step = points.length > 1 ? innerW / (points.length - 1) : innerW;

  const last = points[points.length - 1]!;
  const ends = SERIES.map((s) => ({ ...s, y: yAt(last[s.key]) }));
  if (Math.abs(ends[0]!.y - ends[1]!.y) < 14) {
    const mid = (ends[0]!.y + ends[1]!.y) / 2;
    const upper = last.pageviews >= last.visits ? 0 : 1;
    ends[upper]!.y = mid - 7;
    ends[1 - upper]!.y = mid + 7;
  }

  const h = hover === null ? null : points[hover];

  return (
    <div>
      <div className="flex gap-4 text-xs text-ink-2 mb-2" aria-hidden>
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div ref={wrap} className="relative">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Pageviews and visits over time, ${points.length} buckets`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={yAt(t)}
                y2={yAt(t)}
                stroke={t === 0 ? 'var(--axis)' : 'var(--grid)'}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yAt(t)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--text-muted)"
                className="num"
              >
                {formatCount(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={HEIGHT - 8}
              fontSize={11}
              fill="var(--text-muted)"
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            >
              {formatBucket(points[i]!.x, unit)}
            </text>
          ))}
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points.map((p, i) => `${xAt(i)},${yAt(p[s.key])}`).join(' ')}
            />
          ))}
          {ends.map((e) => (
            <text
              key={e.key}
              x={PAD.left + innerW + 8}
              y={e.y}
              dy="0.32em"
              fontSize={11}
              fill="var(--text-secondary)"
            >
              {e.label}
            </text>
          ))}
          {h && hover !== null && (
            <g pointerEvents="none">
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--axis)"
              />
              {SERIES.map((s) => (
                <circle
                  key={s.key}
                  cx={xAt(hover)}
                  cy={yAt(h[s.key])}
                  r={4.5}
                  fill={s.color}
                  stroke="var(--surface-1)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
          {points.map((p, i) => (
            <rect
              key={p.x}
              x={xAt(i) - step / 2}
              y={PAD.top}
              width={Math.max(step, 8)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
        {h && hover !== null && (
          <div
            className="card absolute pointer-events-none px-3 py-2 text-xs shadow-sm"
            style={{
              top: 4,
              left: Math.min(Math.max(xAt(hover) - 80, 0), width - 170),
              width: 160,
            }}
          >
            <div className="font-medium mb-1">{formatBucket(h.x, unit)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: s.color }}
                  />
                  {s.label}
                </span>
                <span className="num">{formatCount(h[s.key])}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full text-left num">
          <thead className="text-muted">
            <tr>
              <th className="font-normal py-1">{unit === 'hour' ? 'Hour (UTC)' : 'Day (UTC)'}</th>
              <th className="font-normal">Pageviews</th>
              <th className="font-normal">Visits</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.x} className="border-t border-line">
                <td className="py-1">{formatBucket(p.x, unit)}</td>
                <td>{formatCount(p.pageviews)}</td>
                <td>{formatCount(p.visits)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
