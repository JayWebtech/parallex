import { ingestKey } from '@parallax/db';
import { generateKey, hashKey, keyPrefix } from '@parallax/shared';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Deps } from './deps';
import { NotFoundError, ValidationError } from './errors';
import { getProject } from './projects';

export const MAX_ACTIVE_INGEST_KEYS = 5;

export interface IngestKeyView {
  id: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const toView = (k: typeof ingestKey.$inferSelect): IngestKeyView => ({
  id: k.id,
  prefix: k.prefix,
  createdAt: k.createdAt.toISOString(),
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  revokedAt: k.revokedAt?.toISOString() ?? null,
});

/** Keys of a project the user owns (prefix only; the secret is never stored). */
export async function listIngestKeys(
  deps: Pick<Deps, 'db'>,
  userId: string,
  projectId: string,
): Promise<IngestKeyView[]> {
  const p = await getProject(deps, userId, projectId);
  const rows = await deps.db
    .select()
    .from(ingestKey)
    .where(eq(ingestKey.projectId, p.id))
    .orderBy(desc(ingestKey.createdAt));
  return rows.map(toView);
}

/** Creates a key and returns the plaintext once. Only active projects can ingest. */
export async function createIngestKey(
  deps: Pick<Deps, 'db'>,
  userId: string,
  projectId: string,
): Promise<{ key: string; ingestKey: IngestKeyView }> {
  const p = await getProject(deps, userId, projectId);
  if (p.status !== 'active') {
    throw new ValidationError({ form: 'API analytics can be enabled once the project is approved.' });
  }
  const [{ value: active } = { value: 0 }] = await deps.db
    .select({ value: count() })
    .from(ingestKey)
    .where(and(eq(ingestKey.projectId, p.id), isNull(ingestKey.revokedAt)));
  if (active >= MAX_ACTIVE_INGEST_KEYS) {
    throw new ValidationError({ form: `At most ${MAX_ACTIVE_INGEST_KEYS} active keys. Revoke one first.` });
  }
  const key = generateKey('ingest');
  const [row] = await deps.db
    .insert(ingestKey)
    .values({ projectId: p.id, prefix: keyPrefix(key), keyHash: hashKey(key) })
    .returning();
  return { key, ingestKey: toView(row!) };
}

/** Revokes a key of a project the user owns. The collector stops accepting it within a minute. */
export async function revokeIngestKey(
  deps: Pick<Deps, 'db'>,
  userId: string,
  projectId: string,
  keyId: string,
): Promise<void> {
  const p = await getProject(deps, userId, projectId);
  if (!z.uuid().safeParse(keyId).success) throw new NotFoundError();
  const rows = await deps.db
    .update(ingestKey)
    .set({ revokedAt: new Date() })
    .where(and(eq(ingestKey.id, keyId), eq(ingestKey.projectId, p.id), isNull(ingestKey.revokedAt)))
    .returning({ id: ingestKey.id });
  if (rows.length === 0) throw new NotFoundError();
}
