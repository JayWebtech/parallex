/**
 * The subset of OTLP (as plain objects, both encodings) the collector reads.
 * Everything else in a request (span names, events, links, IDs, other
 * attributes, exemplars) is never read and never stored.
 */
export type Long = string | number;

export interface AnyValue {
  stringValue?: string;
  intValue?: Long;
  doubleValue?: number;
  boolValue?: boolean;
}

export interface KeyValue {
  key: string;
  value?: AnyValue;
}

export interface Resource {
  attributes?: KeyValue[];
}

export interface HistogramDataPoint {
  attributes?: KeyValue[];
  startTimeUnixNano?: Long;
  timeUnixNano?: Long;
  count?: Long;
  sum?: number;
  bucketCounts?: Long[];
  explicitBounds?: number[];
}

export interface ExponentialHistogramDataPoint {
  attributes?: KeyValue[];
  startTimeUnixNano?: Long;
  timeUnixNano?: Long;
  count?: Long;
  sum?: number;
  scale?: number;
  zeroCount?: Long;
  positive?: { offset?: number; bucketCounts?: Long[] };
}

export interface Metric {
  name?: string;
  unit?: string;
  histogram?: { dataPoints?: HistogramDataPoint[]; aggregationTemporality?: number | string };
  exponentialHistogram?: {
    dataPoints?: ExponentialHistogramDataPoint[];
    aggregationTemporality?: number | string;
  };
}

export interface MetricsRequest {
  resourceMetrics?: { resource?: Resource; scopeMetrics?: { metrics?: Metric[] }[] }[];
}

export interface Span {
  kind?: number | string;
  startTimeUnixNano?: Long;
  endTimeUnixNano?: Long;
  attributes?: KeyValue[];
}

export interface TraceRequest {
  resourceSpans?: { resource?: Resource; scopeSpans?: { spans?: Span[] }[] }[];
}

export const TEMPORALITY_DELTA = 1;
export const TEMPORALITY_CUMULATIVE = 2;
export const SPAN_KIND_SERVER = 2;

/** Accepts enum numbers and, defensively, their proto names. */
export function enumValue(v: number | string | undefined, names: Record<string, number>): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return names[v] ?? Number(v);
  return 0;
}

export function toNumber(v: Long | undefined): number {
  if (v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

/** Flattens KeyValue[] into a plain map of primitive values. */
export function attributeMap(kvs: KeyValue[] | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const { key, value } of kvs ?? []) {
    if (!value) continue;
    if (value.stringValue !== undefined) out[key] = value.stringValue;
    else if (value.intValue !== undefined) out[key] = toNumber(value.intValue);
    else if (value.doubleValue !== undefined) out[key] = value.doubleValue;
    else if (value.boolValue !== undefined) out[key] = value.boolValue;
  }
  return out;
}
