/** Replacement tokens emitted by the normalizer. Stable: they end up in stored route names. */
export const PLACEHOLDERS = {
  muxedAccount: '{muxed_account}',
  account: '{account}',
  contract: '{contract}',
  secret: '{REDACTED_SECRET}',
  liquidityPool: '{liquidity_pool}',
  claimableBalance: '{claimable_balance}',
  asset: '{asset}',
  uuid: '{uuid}',
  ulid: '{ulid}',
  hash: '{hash}',
  id: '{id}',
  date: '{date}',
  token: '{token}',
  /** Appended when a path has more segments than `maxSegments`. */
  truncated: '{…}',
  /** Returned by the cardinality guard once a tenant exceeds its route budget. */
  other: '{other}',
  /** Returned by `normalizeRoute` when no usable path attribute is present. */
  unknown: '{unknown}',
} as const;

export type Placeholder = (typeof PLACEHOLDERS)[keyof typeof PLACEHOLDERS];
