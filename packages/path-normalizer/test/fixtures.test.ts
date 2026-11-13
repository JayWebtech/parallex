import { StrKey } from '@stellar/stellar-sdk/base';
import { describe, expect, it } from 'vitest';
import * as f from './fixtures.js';

describe('test fixtures', () => {
  it.each([
    ['ACCOUNT_A', f.ACCOUNT_A, StrKey.isValidEd25519PublicKey],
    ['ACCOUNT_B', f.ACCOUNT_B, StrKey.isValidEd25519PublicKey],
    ['SECRET_A', f.SECRET_A, StrKey.isValidEd25519SecretSeed],
    ['SECRET_B', f.SECRET_B, StrKey.isValidEd25519SecretSeed],
    ['CONTRACT_A', f.CONTRACT_A, StrKey.isValidContract],
    ['CONTRACT_B', f.CONTRACT_B, StrKey.isValidContract],
    ['MUXED_A', f.MUXED_A, StrKey.isValidMed25519PublicKey],
    ['LIQUIDITY_POOL', f.LIQUIDITY_POOL, StrKey.isValidLiquidityPool],
    ['CLAIMABLE_BALANCE', f.CLAIMABLE_BALANCE, StrKey.isValidClaimableBalance],
  ] as const)('%s is a valid StrKey and corrupt() breaks it', (_name, key, isValid) => {
    expect(isValid(key)).toBe(true);
    expect(isValid(f.corrupt(key))).toBe(false);
  });
});
