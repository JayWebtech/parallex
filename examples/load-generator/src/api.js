// Realistic requests to examples/express-api: valid random Stellar accounts
// and contracts, tx hashes, a few bad inputs.
import { randomBytes } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk/base';
import { diurnal, sleep, weighted } from './random.js';

const account = () => StrKey.encodeEd25519PublicKey(randomBytes(32));
const contract = () => StrKey.encodeContract(randomBytes(32));
const txHash = () => randomBytes(32).toString('hex');

/** Weighted mix, roughly what a wallet backend sees. */
const ROUTES = [
  [30, () => ['GET', `/accounts/${account()}`]],
  [20, () => ['GET', `/accounts/${account()}/payments?limit=20&cursor=${Date.now()}`]],
  [20, () => ['GET', `/transactions/${txHash()}`]],
  [10, () => ['GET', `/contracts/${contract()}/events`]],
  [8, () => ['POST', '/quotes']],
  [10, () => ['GET', '/health']],
  [2, () => ['GET', '/accounts/not-a-key']],
];

/**
 * Sends requests at `rps` on average until `until` (epoch ms, or forever).
 * With `shape`, the rate follows the daily curve (same daily total).
 */
export async function runApi({ target, rps, until, shape, stats }) {
  while (Date.now() < until) {
    const [method, path] = weighted(ROUTES)[1]();
    stats.api++;
    fetch(`${target}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ amount: '10' }) : undefined,
      signal: AbortSignal.timeout(10_000),
    }).catch(() => stats.apiFailed++);
    await sleep(1000 / (rps * (shape ? diurnal() : 1)));
  }
}
