import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from './index.js';

export const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url));

/** Applies pending migrations. Must run as the schema owner role, not the app role. */
export async function runMigrations(connectionString: string): Promise<void> {
  const { db, pool } = createDb(connectionString, { max: 1 });
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('MIGRATION_DATABASE_URL (or DATABASE_URL) is required');
    process.exit(1);
  }
  await runMigrations(url);
  console.log('migrations applied');
}
