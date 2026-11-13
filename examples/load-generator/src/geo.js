// Where synthetic visitors "come from". Umami derives the country from the
// client IP, so each visit carries an X-Forwarded-For from one of these /24
// prefixes, which the pinned country DB (infra/geo) maps to the country shown.
// Only used as lookup input: Umami never stores IPs, and nothing contacts them.
//
// The demo container sits on the private Docker network, which Umami trusts
// for X-Forwarded-For (TRUSTED_PROXIES=private). Public clients cannot do
// this: Caddy replaces X-Forwarded-For with the real client address.
export const COUNTRIES = [
  // [weight, ISO code, /24 prefix, browser language]
  [22, 'US', '52.53.201', 'en-US'],
  [10, 'DE', '84.62.84', 'de-DE'],
  [9, 'IN', '182.73.134', 'en-IN'],
  [8, 'NG', '41.58.139', 'en-NG'],
  [7, 'BR', '177.49.148', 'pt-BR'],
  [6, 'GB', '176.254.126', 'en-GB'],
  [5, 'FR', '90.102.239', 'fr-FR'],
  [4, 'AR', '181.26.170', 'es-AR'],
  [4, 'KE', '196.97.25', 'en-KE'],
  [4, 'PH', '112.206.234', 'en-PH'],
  [3, 'ES', '85.56.109', 'es-ES'],
  [3, 'CA', '70.24.226', 'en-CA'],
  [3, 'UA', '93.72.160', 'uk-UA'],
  [3, 'MX', '201.170.218', 'es-MX'],
  [2, 'JP', '111.232.118', 'ja-JP'],
  [2, 'TR', '85.102.107', 'tr-TR'],
  [2, 'ZA', '197.69.10', 'en-ZA'],
  [2, 'VN', '123.21.103', 'vi-VN'],
  [2, 'ID', '139.193.125', 'id-ID'],
  [2, 'CO', '186.97.220', 'es-CO'],
];
