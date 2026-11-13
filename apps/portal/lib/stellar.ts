import { Address, StrKey, xdr } from '@stellar/stellar-sdk/base';

export type StellarIdKind = 'account' | 'contract';
export type StellarNetwork = 'mainnet' | 'testnet';

export interface StellarEndpoints {
  horizon: Record<StellarNetwork, string>;
  /** RPC per network; a missing entry means that network can't be checked for contracts. */
  rpc: Partial<Record<StellarNetwork, string>>;
}

export type ParsedStellarId =
  { ok: true; id: string; kind: StellarIdKind } | { ok: false; error: string };

/** Accepts a G… account or C… contract, validated by StrKey checksum. */
export function parseStellarId(input: string): ParsedStellarId {
  const id = input.trim();
  if (StrKey.isValidEd25519PublicKey(id)) return { ok: true, id, kind: 'account' };
  if (StrKey.isValidContract(id)) return { ok: true, id, kind: 'contract' };
  if (StrKey.isValidEd25519SecretSeed(id)) {
    return {
      ok: false,
      error: 'That is a secret seed. Never share it; rotate it if it was exposed.',
    };
  }
  if (StrKey.isValidMed25519PublicKey(id)) {
    return { ok: false, error: 'Use the base G… account, not a muxed M… address.' };
  }
  return { ok: false, error: 'Enter a valid Stellar account (G…) or contract (C…) ID.' };
}

export type ExistenceResult =
  | { found: true; network: StellarNetwork }
  | {
      found: false;
      /** Looked up and not there. */
      checked: StellarNetwork[];
      /** Lookup failed (timeout, 5xx). */
      failed: StellarNetwork[];
      /** No RPC configured for contract lookups. */
      unconfigured: StellarNetwork[];
    };

const NETWORKS: StellarNetwork[] = ['mainnet', 'testnet'];
const TIMEOUT_MS = 8_000;

async function accountExists(horizon: string, id: string, f: typeof fetch): Promise<boolean> {
  const res = await f(`${horizon.replace(/\/+$/, '')}/accounts/${id}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`Horizon returned ${res.status}`);
  return true;
}

/** A deployed contract has a persistent contract-instance ledger entry. */
export function contractInstanceKey(contractId: string): string {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent,
    }),
  ).toXDR('base64');
}

async function contractExists(rpc: string, id: string, f: typeof fetch): Promise<boolean> {
  const res = await f(rpc, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getLedgerEntries',
      params: { keys: [contractInstanceKey(id)] },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`RPC returned ${res.status}`);
  const body = (await res.json()) as { result?: { entries?: unknown[] | null }; error?: unknown };
  if (body.error || !body.result) throw new Error('RPC error');
  return (body.result.entries?.length ?? 0) > 0;
}

/** Looks the ID up on mainnet, then testnet. Network errors are reported, not thrown. */
export async function checkStellarIdExists(
  id: string,
  kind: StellarIdKind,
  endpoints: StellarEndpoints,
  f: typeof fetch = fetch,
): Promise<ExistenceResult> {
  const result = { found: false as const, checked: [], failed: [], unconfigured: [] } as {
    found: false;
    checked: StellarNetwork[];
    failed: StellarNetwork[];
    unconfigured: StellarNetwork[];
  };
  for (const network of NETWORKS) {
    const rpc = endpoints.rpc[network];
    if (kind === 'contract' && !rpc) {
      result.unconfigured.push(network);
      continue;
    }
    try {
      const exists =
        kind === 'account'
          ? await accountExists(endpoints.horizon[network], id, f)
          : await contractExists(rpc!, id, f);
      if (exists) return { found: true, network };
      result.checked.push(network);
    } catch (error) {
      console.warn(`stellar: ${kind} lookup on ${network} failed`, error);
      result.failed.push(network);
    }
  }
  return result;
}

/** User-facing explanation for a failed existence check. */
export function describeMissing(
  kind: StellarIdKind,
  result: Extract<ExistenceResult, { found: false }>,
): string {
  const what = kind === 'account' ? 'account' : 'contract';
  if (result.failed.length > 0) {
    return `We couldn't reach ${result.failed.join(' and ')} to check this ${what}. Please try again in a minute.`;
  }
  const notFound =
    result.checked.length > 0
      ? `This ${what} was not found on ${result.checked.join(' or ')}.`
      : '';
  if (result.unconfigured.length > 0) {
    return `${notFound} Contract lookups on ${result.unconfigured.join(' and ')} are not enabled on this deployment.`.trim();
  }
  return `${notFound} Fund the account or deploy the contract first.`;
}
