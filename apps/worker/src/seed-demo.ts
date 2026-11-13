/**
 * Creates the public demo tenant (docker compose profile `demo`, one-shot).
 *
 *  - a demo owner account with no password (nobody can sign in as it)
 *  - the projects in DEMO_PROJECTS, flagged is_demo, each with an Umami
 *    website under its fixed ID
 *  - DEMO_INGEST_KEY (hashed) as the ingest key examples/express-api uses
 *
 * Idempotent: safe on every deploy. A demo project an operator has removed
 * stays removed.
 */
import { fileURLToPath } from 'node:url';
import { createDb } from '@parallax/db';
import type { DbHandle } from '@parallax/db';
import {
  DEMO_API_PROJECT,
  DEMO_OWNER,
  DEMO_PROJECTS,
  hashKey,
  isKeyOfKind,
  keyPrefix,
} from '@parallax/shared';
import { UmamiClient, waitForUmami } from '@parallax/umami';

type Queryable = Pick<DbHandle['pool'], 'query'>;

export interface WebsiteEnsurer {
  ensureWebsite(input: { id: string; name: string; domain: string }): Promise<'created' | 'exists'>;
}

export interface DemoSeedResult {
  created: string[];
  skipped: string[];
}

export async function seedDemo(
  db: Queryable,
  umami: WebsiteEnsurer,
  opts: { ingestKey: string; publicUrl: string },
): Promise<DemoSeedResult> {
  if (!isKeyOfKind(opts.ingestKey, 'ingest'))
    throw new Error('DEMO_INGEST_KEY must be an ingest key (plx_in_…); run scripts/init-env.sh');
  const host = new URL(opts.publicUrl).hostname;

  await db.query(
    `INSERT INTO portal."user" (id, name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [DEMO_OWNER.id, DEMO_OWNER.name, DEMO_OWNER.email],
  );

  const result: DemoSeedResult = { created: [], skipped: [] };
  for (const p of DEMO_PROJECTS) {
    const existing = await db.query('SELECT 1 FROM portal.project WHERE id = $1', [p.id]);
    if (existing.rowCount) {
      result.skipped.push(p.name);
      continue;
    }
    await umami.ensureWebsite({ id: p.websiteId, name: p.name, domain: host });
    await db.query(
      `INSERT INTO portal.project
         (id, owner_id, name, domains, stellar_id, stellar_id_kind, status, is_demo, umami_website_id)
       VALUES ($1, $2, $3, $4, $5, 'account', 'active', true, $6)`,
      [p.id, DEMO_OWNER.id, p.name, [host], p.stellarId, p.websiteId],
    );
    result.created.push(p.name);
  }

  // The configured key is the demo API's only active key (a new .env rotates it).
  const keyHash = hashKey(opts.ingestKey);
  await db.query(
    `UPDATE api_metrics.ingest_key SET revoked_at = now()
      WHERE project_id = $1 AND key_hash <> $2 AND revoked_at IS NULL`,
    [DEMO_API_PROJECT.id, keyHash],
  );
  await db.query(
    `INSERT INTO api_metrics.ingest_key (project_id, prefix, key_hash)
     SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM portal.project WHERE id = $1)
     ON CONFLICT (key_hash) DO NOTHING`,
    [DEMO_API_PROJECT.id, keyPrefix(opts.ingestKey), keyHash],
  );
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {
    MIGRATION_DATABASE_URL,
    UMAMI_URL,
    UMAMI_ADMIN_USERNAME = 'admin',
    UMAMI_ADMIN_PASSWORD,
    DEMO_INGEST_KEY,
    PUBLIC_URL,
  } = process.env;
  if (
    !MIGRATION_DATABASE_URL ||
    !UMAMI_URL ||
    !UMAMI_ADMIN_PASSWORD ||
    !DEMO_INGEST_KEY ||
    !PUBLIC_URL
  ) {
    console.error(
      'MIGRATION_DATABASE_URL, UMAMI_URL, UMAMI_ADMIN_PASSWORD, DEMO_INGEST_KEY and PUBLIC_URL are required',
    );
    process.exit(1);
  }
  await waitForUmami(UMAMI_URL);
  const { pool } = createDb(MIGRATION_DATABASE_URL, { max: 1 });
  try {
    const umami = new UmamiClient({
      baseUrl: UMAMI_URL,
      username: UMAMI_ADMIN_USERNAME,
      password: UMAMI_ADMIN_PASSWORD,
    });
    const result = await seedDemo(pool, umami, {
      ingestKey: DEMO_INGEST_KEY,
      publicUrl: PUBLIC_URL,
    });
    console.log(JSON.stringify({ msg: 'demo tenant ready', ...result }));
  } finally {
    await pool.end();
  }
}
