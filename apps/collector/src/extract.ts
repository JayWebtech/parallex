import { normalizeRoute } from '@parallax/path-normalizer';
import { LATENCY_BOUNDS_MS, bucketIndex, emptyBuckets } from '@parallax/shared';
import type { DeltaTracker, Totals } from './delta.js';
import type {
  ExponentialHistogramDataPoint,
  HistogramDataPoint,
  KeyValue,
  Metric,
  MetricsRequest,
  TraceRequest,
} from './otlp.js';
import {
  SPAN_KIND_SERVER,
  TEMPORALITY_CUMULATIVE,
  attributeMap,
  enumValue,
  toNumber,
} from './otlp.js';

export type Source = 'metrics' | 'traces';

/** One aggregated observation for a (service, method, route, status, minute). */
export interface Sample extends Totals {
  service: string;
  method: string;
  route: string;
  status: number;
  /** Start of the UTC minute, epoch ms. */
  minute: number;
  source: Source;
}

export interface ExtractContext {
  projectId: string;
  nowMs: number;
  /** Data points older or newer than this window are rejected. */
  acceptPastMs: number;
  acceptFutureMs: number;
  /** Per-project cardinality guards (return `{other}` once over budget). */
  admitRoute: (route: string) => string;
  admitService: (service: string) => string;
  deltas: DeltaTracker;
}

export interface ExtractResult {
  samples: Sample[];
  /** Points/spans we would have used but could not (bad timestamps, malformed histograms). */
  rejected: number;
  secretsRedacted: number;
}

/** http.server.request.duration (stable semconv, seconds) and its pre-1.20 name (ms). */
const DURATION_METRICS: Record<string, number> = {
  'http.server.request.duration': 1000,
  'http.server.duration': 1,
};
const UNIT_TO_MS: Record<string, number> = { s: 1000, ms: 1, us: 0.001, 'µs': 0.001, ns: 1e-6 };

const KNOWN_METHODS = new Set([
  'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH', 'QUERY',
]);

function method(attrs: Record<string, unknown>): string {
  const m = attrs['http.request.method'] ?? attrs['http.method'];
  const upper = typeof m === 'string' ? m.toUpperCase() : '';
  return KNOWN_METHODS.has(upper) ? upper : '_OTHER';
}

function status(attrs: Record<string, unknown>): number {
  const s = Number(attrs['http.response.status_code'] ?? attrs['http.status_code']);
  return Number.isInteger(s) && s >= 100 && s <= 599 ? s : 0;
}

function serviceName(resource: KeyValue[] | undefined): string {
  const name = attributeMap(resource)['service.name'];
  const s = typeof name === 'string' ? name.trim().slice(0, 100) : '';
  return s || 'unknown_service';
}

const nsToMs = (ns: string | number | undefined): number =>
  ns === undefined ? 0 : Number(BigInt(String(ns).split('.')[0] || '0') / 1_000_000n);

/** Bucket upper bounds in ms are rounded so 0.075 s → 75 ms lands exactly. */
const roundMs = (ms: number) => Math.round(ms * 1e6) / 1e6;

/**
 * Re-buckets an explicit-bounds histogram onto LATENCY_BOUNDS_MS. Each source
 * bucket goes to the target bucket containing its upper bound: exact for
 * aligned bounds (all OTel defaults), conservative (rounds up) otherwise.
 */
export function rebucketExplicit(p: HistogramDataPoint, factor: number): number[] | null {
  const bounds = p.explicitBounds ?? [];
  const counts = (p.bucketCounts ?? []).map(toNumber);
  if (counts.length === 0) return null;
  if (counts.length !== bounds.length + 1) return null;
  const out = emptyBuckets();
  counts.forEach((c, i) => {
    const target = i < bounds.length ? bucketIndex(roundMs(bounds[i]! * factor)) : LATENCY_BOUNDS_MS.length;
    out[target]! += c;
  });
  return out;
}

/** Re-buckets a base-2 exponential histogram (positive range + zero bucket). */
export function rebucketExponential(p: ExponentialHistogramDataPoint, factor: number): number[] {
  const out = emptyBuckets();
  out[0]! += toNumber(p.zeroCount);
  const base = 2 ** (2 ** -(p.scale ?? 0));
  const offset = p.positive?.offset ?? 0;
  (p.positive?.bucketCounts ?? []).forEach((c, i) => {
    const upper = base ** (offset + i + 1) * factor;
    out[bucketIndex(roundMs(upper))]! += toNumber(c);
  });
  return out;
}

function inWindow(ctx: ExtractContext, ms: number): boolean {
  return ms >= ctx.nowMs - ctx.acceptPastMs && ms <= ctx.nowMs + ctx.acceptFutureMs;
}

const minuteOf = (ms: number) => ms - (ms % 60_000);

interface Dims {
  method: string;
  route: string;
  status: number;
  secrets: number;
}

function dims(ctx: ExtractContext, attrs: Record<string, string | number | boolean>): Dims {
  const r = normalizeRoute(attrs);
  return {
    method: method(attrs),
    route: ctx.admitRoute(r.route),
    status: status(attrs),
    secrets: r.secretsRedacted,
  };
}

export function extractMetrics(req: MetricsRequest, ctx: ExtractContext): ExtractResult {
  const result: ExtractResult = { samples: [], rejected: 0, secretsRedacted: 0 };
  for (const rm of req.resourceMetrics ?? []) {
    const service = ctx.admitService(serviceName(rm.resource?.attributes));
    const resourceKey = JSON.stringify(rm.resource?.attributes ?? []);
    for (const sm of rm.scopeMetrics ?? []) {
      for (const metric of sm.metrics ?? []) {
        collectMetric(metric, service, resourceKey, ctx, result);
      }
    }
  }
  return result;
}

function collectMetric(
  metric: Metric,
  service: string,
  resourceKey: string,
  ctx: ExtractContext,
  result: ExtractResult,
): void {
  const defaultFactor = DURATION_METRICS[metric.name ?? ''];
  if (defaultFactor === undefined) return; // not an HTTP server duration: ignored by design
  const factor = UNIT_TO_MS[metric.unit ?? ''] ?? defaultFactor;

  const points: { p: HistogramDataPoint | ExponentialHistogramDataPoint; buckets: number[] | null }[] = [];
  let temporality = 0;
  if (metric.histogram) {
    temporality = enumValue(metric.histogram.aggregationTemporality, {
      AGGREGATION_TEMPORALITY_DELTA: 1,
      AGGREGATION_TEMPORALITY_CUMULATIVE: 2,
    });
    for (const p of metric.histogram.dataPoints ?? []) points.push({ p, buckets: rebucketExplicit(p, factor) });
  } else if (metric.exponentialHistogram) {
    temporality = enumValue(metric.exponentialHistogram.aggregationTemporality, {
      AGGREGATION_TEMPORALITY_DELTA: 1,
      AGGREGATION_TEMPORALITY_CUMULATIVE: 2,
    });
    for (const p of metric.exponentialHistogram.dataPoints ?? []) {
      points.push({ p, buckets: rebucketExponential(p, factor) });
    }
  } else {
    return;
  }

  for (const { p, buckets } of points) {
    const timeMs = nsToMs(p.timeUnixNano);
    if (!buckets || !inWindow(ctx, timeMs)) {
      result.rejected++;
      continue;
    }
    let totals: Totals | null = { count: toNumber(p.count), sumMs: (p.sum ?? 0) * factor, buckets };
    if (temporality === TEMPORALITY_CUMULATIVE) {
      const key = `${ctx.projectId}\u0000${metric.name}\u0000${resourceKey}\u0000${JSON.stringify(p.attributes ?? [])}`;
      totals = ctx.deltas.delta(key, String(p.startTimeUnixNano ?? '0'), totals, ctx.nowMs);
    }
    if (!totals || totals.count <= 0) continue;
    const d = dims(ctx, attributeMap(p.attributes));
    result.secretsRedacted += d.secrets;
    result.samples.push({
      service,
      method: d.method,
      route: d.route,
      status: d.status,
      minute: minuteOf(timeMs),
      source: 'metrics',
      ...totals,
    });
  }
}

/**
 * Counts SERVER spans only (one span = one handled request) and keeps their
 * duration. Client/internal/producer/consumer spans are ignored by design.
 */
export function extractTraces(req: TraceRequest, ctx: ExtractContext): ExtractResult {
  const result: ExtractResult = { samples: [], rejected: 0, secretsRedacted: 0 };
  for (const rs of req.resourceSpans ?? []) {
    const service = ctx.admitService(serviceName(rs.resource?.attributes));
    for (const ss of rs.scopeSpans ?? []) {
      for (const span of ss.spans ?? []) {
        if (enumValue(span.kind, { SPAN_KIND_SERVER }) !== SPAN_KIND_SERVER) continue;
        const endMs = nsToMs(span.endTimeUnixNano);
        const durationMs =
          Number(BigInt(String(span.endTimeUnixNano ?? 0)) - BigInt(String(span.startTimeUnixNano ?? 0))) / 1e6;
        if (!inWindow(ctx, endMs) || !(durationMs >= 0)) {
          result.rejected++;
          continue;
        }
        const d = dims(ctx, attributeMap(span.attributes));
        result.secretsRedacted += d.secrets;
        const buckets = emptyBuckets();
        buckets[bucketIndex(durationMs)] = 1;
        result.samples.push({
          service,
          method: d.method,
          route: d.route,
          status: d.status,
          minute: minuteOf(endMs),
          source: 'traces',
          count: 1,
          sumMs: durationMs,
          buckets,
        });
      }
    }
  }
  return result;
}
