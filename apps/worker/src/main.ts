import { createDb } from '@parallax/db';
import { tick } from './jobs.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 60_000);
const RETENTION_EVERY_MS = 60 * 60_000;
const { pool } = createDb(url, { max: 2 });
let lastRetention = 0;
let running = false;

async function run() {
  if (running) return;
  running = true;
  const now = Date.now();
  const retention = now - lastRetention >= RETENTION_EVERY_MS;
  try {
    const ran = await tick(pool, now, { retention });
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
