import { StrKey } from '@stellar/stellar-sdk/base';
import { PLACEHOLDERS } from './placeholders.js';

/**
 * One rule per kind of high-cardinality segment. Rules are tried in array
 * order, most specific first; the first match wins. Every rule looks at a
 * single, already percent-decoded path segment.
 */
interface Rule {
  readonly placeholder: string;
  readonly test: (segment: string) => boolean;
}

const BASE32_UPPER = /^[A-Z2-7]+$/;

/** StrKey candidates are cheap-filtered (prefix, length, alphabet) before the checksum is verified. */
function strKey(prefix: string, length: number, isValid: (s: string) => boolean) {
  return (s: string): boolean => {
    if (s.length !== length || s[0] !== prefix || !BASE32_UPPER.test(s)) return false;
    try {
      return isValid(s);
    } catch {
      return false;
    }
  };
}

export const isMuxedAccount = strKey('M', 69, (s) => StrKey.isValidMed25519PublicKey(s));
export const isAccount = strKey('G', 56, (s) => StrKey.isValidEd25519PublicKey(s));
export const isContract = strKey('C', 56, (s) => StrKey.isValidContract(s));
export const isSecretSeed = strKey('S', 56, (s) => StrKey.isValidEd25519SecretSeed(s));
const isLiquidityPool = strKey('L', 56, (s) => StrKey.isValidLiquidityPool(s));
const isClaimableBalance = strKey('B', 58, (s) => StrKey.isValidClaimableBalance(s));

/** `CODE:ISSUER`, `CODE-ISSUER`, optionally with a `-1`/`-2` asset-type suffix as some explorers use. */
const ASSET = /^[A-Za-z0-9]{1,12}[:-](G[A-Z2-7]{55})(?:-[12])?$/;
function isAsset(s: string): boolean {
  const issuer = ASSET.exec(s)?.[1];
  return issuer !== undefined && isAccount(issuer);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Crockford base32, 26 chars, first char 0-7 (48-bit timestamp). Excludes I, L, O, U. */
const ULID = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/i;

/**
 * Hex digests: 0x-prefixed (EVM-style) of 16+ digits, or bare hex of 32+ digits.
 * Covers md5 (32), sha1/git (40), sha256 / Stellar tx hashes / liquidity pool ids (64)
 * and Horizon claimable balance ids (72).
 */
const PREFIXED_HEX = /^0x[0-9a-f]{16,}$/i;
const BARE_HEX = /^[0-9a-f]{32,}$/i;
const isHash = (s: string): boolean => PREFIXED_HEX.test(s) || BARE_HEX.test(s);

const DIGITS = /^\d+$/;

/** ISO 8601 calendar date, optionally followed by a time and offset. */
const DATE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i;
function isDate(s: string): boolean {
  const m = DATE.exec(s);
  if (!m) return false;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  if (m[4] !== undefined && (Number(m[4]) > 23 || Number(m[5]) > 59)) return false;
  return m[6] === undefined || Number(m[6]) <= 60;
}

/**
 * Opaque tokens: base64 / base64url / base32 / base36-style identifiers (nanoid,
 * cuid, Firebase push ids, IPFS CIDs, hashed asset names…) of 20+ characters
 * that mix character classes the way random data does and readable text does not.
 *
 * A segment of token characters is a token when either
 *  - it switches between letters and digits at least 4 times
 *    (`ckl2x7y8z0000abcd1234`, base32 with digits), or
 *  - it mixes upper and lower case and its lowercase runs average fewer than
 *    3 characters. Random base64 averages ~1.7; camelCase words such as
 *    `MyBlogPost2024AboutStellar` average more than 3.
 * Separators (`-`, `_`, `.`, `~`, `+`, `=`, `/`) break letter/digit adjacency, so
 * `how-to-build-on-stellar-2024` is not a token.
 *
 * Also a token: 40+ characters of the StrKey/base32 alphabet only (`[A-Z2-7]`),
 * e.g. a Stellar-key-shaped string with a bad checksum. No readable word is that.
 *
 * Measured on random base64url strings, this misses ~1.6% of 20-char tokens and
 * ~0.2% of 32-char ones; the per-tenant cardinality guard bounds what slips through.
 */
const TOKEN_MIN_LENGTH = 20;
const MIN_READABLE_LOWER_RUN = 3;
const TOKEN_CHARS = /^[A-Za-z0-9._~+=/-]+$/;
const CharClass = { Other: 0, Lower: 1, Upper: 2, Digit: 3 } as const;
type CharClass = (typeof CharClass)[keyof typeof CharClass];
function charClass(code: number): CharClass {
  if (code >= 97 && code <= 122) return CharClass.Lower;
  if (code >= 65 && code <= 90) return CharClass.Upper;
  if (code >= 48 && code <= 57) return CharClass.Digit;
  return CharClass.Other;
}
const BASE32_RUN = /^[A-Z2-7]{40,}$/;

export function isOpaqueToken(s: string): boolean {
  if (s.length < TOKEN_MIN_LENGTH || !TOKEN_CHARS.test(s)) return false;
  if (BASE32_RUN.test(s)) return true;
  let upper = 0;
  let lower = 0;
  let lowerRuns = 0;
  let letterDigitChanges = 0;
  let prev: CharClass = CharClass.Other;
  for (let i = 0; i < s.length; i++) {
    const c = charClass(s.charCodeAt(i));
    if (c === CharClass.Upper) upper++;
    if (c === CharClass.Lower) {
      lower++;
      if (prev !== CharClass.Lower) lowerRuns++;
    }
    const isLetter = c === CharClass.Lower || c === CharClass.Upper;
    const prevIsLetter = prev === CharClass.Lower || prev === CharClass.Upper;
    if ((isLetter && prev === CharClass.Digit) || (c === CharClass.Digit && prevIsLetter)) {
      letterDigitChanges++;
    }
    prev = c;
  }
  if (letterDigitChanges >= 4) return true;
  return upper > 0 && lowerRuns > 0 && lower / lowerRuns < MIN_READABLE_LOWER_RUN;
}

/** Ordered most → least specific. */
export const RULES: readonly Rule[] = [
  { placeholder: PLACEHOLDERS.muxedAccount, test: isMuxedAccount },
  { placeholder: PLACEHOLDERS.account, test: isAccount },
  { placeholder: PLACEHOLDERS.contract, test: isContract },
  { placeholder: PLACEHOLDERS.secret, test: isSecretSeed },
  { placeholder: PLACEHOLDERS.liquidityPool, test: isLiquidityPool },
  { placeholder: PLACEHOLDERS.claimableBalance, test: isClaimableBalance },
  { placeholder: PLACEHOLDERS.asset, test: isAsset },
  { placeholder: PLACEHOLDERS.uuid, test: (s) => UUID.test(s) },
  { placeholder: PLACEHOLDERS.ulid, test: (s) => ULID.test(s) },
  { placeholder: PLACEHOLDERS.hash, test: isHash },
  { placeholder: PLACEHOLDERS.id, test: (s) => DIGITS.test(s) },
  { placeholder: PLACEHOLDERS.date, test: isDate },
  { placeholder: PLACEHOLDERS.token, test: isOpaqueToken },
];

/** Returns the placeholder for a decoded segment, or `null` if the segment is kept as-is. */
export function classifySegment(segment: string): string | null {
  for (const rule of RULES) {
    if (rule.test(segment)) return rule.placeholder;
  }
  return null;
}
