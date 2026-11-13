/** Picks from [weight, ...rest] rows. */
export function weighted(rows) {
  const total = rows.reduce((s, r) => s + r[0], 0);
  let x = Math.random() * total;
  for (const row of rows) if ((x -= row[0]) < 0) return row;
  return rows[0];
}

export const between = (min, max) => min + Math.random() * (max - min);

/**
 * Daily traffic curve, averaging 1.0 over 24 h: quiet around 02:00 UTC,
 * busiest around 14:00 UTC.
 */
export function diurnal(date = new Date()) {
  const h = date.getUTCHours() + date.getUTCMinutes() / 60;
  return 1 + 0.6 * Math.sin(((h - 8) / 24) * 2 * Math.PI);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
