import { createDb } from '@parallax/db';
import { UmamiClient } from '@parallax/umami';
import { tick } from './jobs.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
const RETENTION_EVERY_MS = 60 * 60_000;
const { pool } = createDb(url, { max: 3 });
const graceHours = Number(process.env.PURGE_AFTER_HOURS ?? 24);
// Purging deletes the project's Umami website, so it needs Umami credentials.
const umami =
  process.env.UMAMI_URL && process.env.UMAMI_ADMIN_PASSWORD
    ? new UmamiClient({
        baseUrl: process.env.UMAMI_URL,
        username: process.env.UMAMI_ADMIN_USERNAME ?? 'admin',
        password: process.env.UMAMI_ADMIN_PASSWORD,
      })
    : null;
if (!umami)
  console.warn(JSON.stringify({ msg: 'UMAMI_URL/UMAMI_ADMIN_PASSWORD unset: purge disabled' }));
let lastRetention = 0;
let running = false;

async function run() {
  if (running) return;
  running = true;
  const now = Date.now();
  const retention = now - lastRetention >= RETENTION_EVERY_MS;
  try {
    const ran = await tick(pool, now, {
      retention,
      ...(umami ? { purge: { umami, graceHours } } : {}),
    });
    if (ran && retention) lastRetention = now;
    console.log(JSON.stringify({ msg: 'tick', ran, retention, ms: Date.now() - now }));
  } catch (error) {
    console.error(JSON.stringify({ msg: 'tick failed', error: String(error) }));
  } finally {
    running = false;
  }
}

await run();
const timer = setInterval(run, INTERVAL_MS);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    clearInterval(timer);
    await pool.end();
    process.exit(0);
  });
}
