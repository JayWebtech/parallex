import { describe, expect, it } from 'vitest';
import { PRODUCT_SLUG, product } from '../src/index.js';

describe('product config', () => {
  it('derives identifiers from the slug', () => {
    expect(product.ingestKeyHeader).toBe(`x-${PRODUCT_SLUG}-key`);
  });

  it('uses lowercase, header-safe identifiers', () => {
    expect(PRODUCT_SLUG).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(product.ingestKeyHeader).toMatch(/^[a-z0-9-]+$/);
  });

  it('keeps ingest and operator key prefixes distinct', () => {
    expect(product.keyPrefixes.ingest).not.toBe(product.keyPrefixes.operator);
  });
});
