import { describe, expect, it } from 'vitest';
import {
  LATENCY_BOUNDS_MS,
  LATENCY_BUCKETS,
  bucketIndex,
  digestsEqual,
  emptyBuckets,
  generateKey,
  hashKey,
  isKeyOfKind,
  keyPrefix,
  product,
  quantileMs,
} from '../src/index.js';

describe('keys', () => {
  it('generates typed, unique, high-entropy keys', () => {
    const a = generateKey('ingest');
    const b = generateKey('ingest');
    expect(a).not.toBe(b);
    expect(a.startsWith(product.keyPrefixes.ingest)).toBe(true);
    expect(isKeyOfKind(a, 'ingest')).toBe(true);
    expect(isKeyOfKind(a, 'operator')).toBe(false);
    expect(isKeyOfKind(`${product.keyPrefixes.ingest}short`, 'ingest')).toBe(false);
  });

  it('hashes deterministically and never returns the key', () => {
    const k = generateKey('operator');
    expect(hashKey(k)).toBe(hashKey(k));
    expect(hashKey(k)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(k)).not.toContain(k.slice(7));
    expect(digestsEqual(hashKey(k), hashKey(k))).toBe(true);
    expect(digestsEqual(hashKey(k), hashKey(generateKey('operator')))).toBe(false);
  });

  it('exposes only a short prefix', () => {
    const k = generateKey('ingest');
    expect(keyPrefix(k)).toBe(k.slice(0, product.keyPrefixes.ingest.length + 6));
  });
});

describe('latency buckets', () => {
  it('contain both OpenTelemetry default boundary sets', () => {
    const seconds = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];
    const legacyMs = [5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000];
    expect(seconds.map((s) => Math.round(s * 1000))).toEqual([...LATENCY_BOUNDS_MS]);
    for (const b of legacyMs) expect(LATENCY_BOUNDS_MS).toContain(b);
  });

  it.each([
    [0, 0],
    [5, 0],
    [5.1, 1],
    [100, 5],
    [10000, 13],
    [10001, 14],
  ])('%f ms → bucket %i', (ms, i) => {
    expect(bucketIndex(ms)).toBe(i);
  });

  it('estimates quantiles by interpolating inside the bucket', () => {
    const b = emptyBuckets();
    b[bucketIndex(30)] = 50; // (25, 50]
    b[bucketIndex(80)] = 50; // (75, 100]
    expect(quantileMs(b, 0.5)).toBe(50);
    expect(quantileMs(b, 0.25)).toBeCloseTo(37.5);
    expect(quantileMs(b, 0.95)).toBeCloseTo(97.5);
    expect(quantileMs(emptyBuckets(), 0.5)).toBeNull();
  });

  it('reports overflow as the last bound', () => {
    const b = emptyBuckets();
    b[LATENCY_BUCKETS - 1] = 10;
    expect(quantileMs(b, 0.95)).toBe(10000);
  });
});
