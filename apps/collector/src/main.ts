import { createDb } from '@parallax/db';
import { configFromEnv } from './config.js';
import { buildServer } from './server.js';
import { createPgStore } from './store.js';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const { pool } = createDb(url, { max: Number(process.env.DB_POOL_SIZE ?? 10) });
const app = buildServer({ store: createPgStore(pool), config: configFromEnv(process.env), logger: true });

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 4318) });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await pool.end();
    process.exit(0);
  });
}
