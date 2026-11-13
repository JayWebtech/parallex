/**
 * Product identity. "Parallax" is a placeholder: renaming the product means
 * editing PRODUCT_NAME / PRODUCT_SLUG here; everything user-facing and every
 * derived identifier (key prefixes, header names) reads from this object.
 *
 * Changing PRODUCT_SLUG after launch changes the ingest header name and key
 * prefixes, so existing tenant integrations would need to be updated.
 */
export const PRODUCT_NAME = 'Parallax';
export const PRODUCT_SLUG = 'parallax';

/** Short prefix for generated secrets, so leaked keys are easy to grep for. */
const KEY_PREFIX = 'plx';

export const product = {
  name: PRODUCT_NAME,
  slug: PRODUCT_SLUG,
  /** HTTP header carrying a tenant's OTLP ingest key. */
  ingestKeyHeader: `x-${PRODUCT_SLUG}-key`,
  keyPrefixes: {
    /** Per-tenant OTLP ingest key. */
    ingest: `${KEY_PREFIX}_in_`,
    /** Operator (SCF) read-only API key. */
    operator: `${KEY_PREFIX}_op_`,
  },
} as const;

export type Product = typeof product;
