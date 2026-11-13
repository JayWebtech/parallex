import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { product } from './config.js';

export type KeyKind = keyof typeof product.keyPrefixes;

/**
 * Secrets are 32 random bytes, base64url, behind a typed prefix
 * (`plx_in_…`, `plx_op_…`) so leaked keys are recognizable and greppable.
 * Only `hashKey(key)` is stored; the plaintext is shown once at creation.
 */
export function generateKey(kind: KeyKind): string {
  return `${product.keyPrefixes[kind]}${randomBytes(32).toString('base64url')}`;
}

/**
 * SHA-256 is appropriate here (unlike for passwords): the input is 256 bits of
 * randomness, so there is nothing to brute-force, and lookups stay O(1).
 */
export function hashKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Short, non-secret identifier for UIs: the typed prefix plus 6 characters. */
export function keyPrefix(key: string): string {
  const kind = Object.values(product.keyPrefixes).find((p) => key.startsWith(p)) ?? '';
  return key.slice(0, kind.length + 6);
}

export function isKeyOfKind(key: string, kind: KeyKind): boolean {
  return (
    key.startsWith(product.keyPrefixes[kind]) &&
    /^[A-Za-z0-9_-]{43}$/.test(key.slice(product.keyPrefixes[kind].length))
  );
}

/** Constant-time comparison of two hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && timingSafeEqual(x, y);
}
