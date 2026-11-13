/**
 * Deterministic Stellar identifiers for tests. They were derived from fixed
 * labels (sha512("parallax-fixture-…")) with @stellar/stellar-sdk, so they
 * have valid StrKey checksums but belong to no real project.
 * `fixtures.test.ts` re-validates every one of them.
 */
export const ACCOUNT_A = 'GBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FB3VS';
export const ACCOUNT_B = 'GDAS22PTXC5P4E3NK3VUBXNLFBEQP5IFADACMNDCSJAKU3SOT3TKDYRV';
export const SECRET_A = 'SB6K5QLO3JZ2LIQ2EXEAR7KU7Z7WTCIR2JFDSOJII7HKK2AVPLYRB6ZL';
export const SECRET_B = 'SABHEV2LY4MG74KFXJZC3PELQO2V26HYGP2PGG6LEYCKP6CBIAWE54CX';
export const CONTRACT_A = 'CCSTF2PQ5573DRCHU5RBU3WUUMXRSAJPW6PZVZWDPU7YCVFV4PI5QZT6';
export const CONTRACT_B = 'CDGWLIG6XTARFZBYG7VBVDGOBYV2KPAQNZYJT5UWZOT3OIJ5CHVCJM76';
export const MUXED_A = 'MBBLEE6GKRUGUF34ALTAQM7NN6WAIKHBLZ3WIIPAGOZ6S7SZ3G2FAAAAAAAAAABQHG4H4';
export const LIQUIDITY_POOL = 'LCP47MWLIJVUTOQFJ77CYROVXZ5YV2ZEQVC4EW2SMSCBZXV77UGD5TS2';
export const CLAIMABLE_BALANCE = 'BAABQ6O7S7FQIOWUZSLX3XKTVPBBJYUO3SAZPBGS6PA6PVBPHUUSWN4GCU';

/** Hex identifiers as Horizon returns them. */
export const TX_HASH = '262f23e745d9aee3529a559fa26130f1d892dbdf83d642cccc5aaed824a00505';
export const POOL_HEX = 'b9d1a05e8aa3fc3c2acad05264d50d2a3bf073cf68b68002d930338d66f3b436';
export const CLAIMABLE_BALANCE_HEX =
  '000000003cb11a3acef146089b9727ec0ba1361eb9058f774eab6d03fcc94861f9353efe';

/** Flips the last character, which breaks the StrKey CRC16 checksum. */
export function corrupt(strKey: string): string {
  const last = strKey.at(-1);
  return strKey.slice(0, -1) + (last === 'A' ? 'B' : 'A');
}
