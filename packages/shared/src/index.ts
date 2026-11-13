export { PRODUCT_NAME, PRODUCT_SLUG, product } from './config.js';
export type { Product } from './config.js';
export { digestsEqual, generateKey, hashKey, isKeyOfKind, keyPrefix } from './keys.js';
export type { KeyKind } from './keys.js';
export {
  LATENCY_BOUNDS_MS,
  LATENCY_BUCKETS,
  addBuckets,
  bucketIndex,
  emptyBuckets,
  quantileMs,
} from './latency.js';
