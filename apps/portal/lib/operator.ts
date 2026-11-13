import { auditLog, operatorApiKey } from '@parallax/db';
import type { Database } from '@parallax/db';
import { generateKey, hashKey, isKeyOfKind, keyPrefix } from '@parallax/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { Deps } from './deps';
import { NotFoundError, ValidationError } from './errors';

/**
 * Who is acting as an operator, and how far they may go.
 *  - scope 'all': every tenant (SCF operators, OPERATOR_EMAILS)
 *  - scope 'demo': demo tenants only (public demo login, DEMO_OPERATOR_EMAILS)
 *  - readOnly: demo operators and API keys can look, never change
 * There is no way to become an operator from inside the app.
 */
export interface OperatorContext {
  /** Email for people, "api-key:<prefix>" for machine access. Recorded in the audit log. */
  actor: string;
  scope: 'all' | 'demo';
  readOnly: boolean;
  /** 'public': the read-only /demo pages (no account). */
  via: 'session' | 'api_key' | 'public';
}

export function operatorForEmail(
  deps: Pick<Deps, 'operatorEmails' | 'demoOperatorEmails'>,
  email: string,
): OperatorContext | null {
  const e = email.toLowerCase();
  if (deps.operatorEmails.has(e))
    return { actor: e, scope: 'all', readOnly: false, via: 'session' };
  if (deps.demoOperatorEmails?.has(e))
    return { actor: e, scope: 'demo', readOnly: true, via: 'session' };
  return null;
}

type Tx = Pick<Database, 'insert'>;

/** Append-only audit trail of operator (and system) actions. */
export async function audit(
  db: Tx,
  actor: string,
  action: string,
  target?: { type: string; id: string },
  details?: Record<string, unknown>,
): Promise<void> {
  await db.insert(auditLog).values({
    actorEmail: actor,
    action,
    targetType: target?.type ?? null,
    targetId: target?.id ?? null,
    details: details ?? null,
  });
}

export function assertWritable(op: OperatorContext): void {
  if (op.readOnly) throw new ValidationError({ form: 'This operator account is read-only.' });
}

// ── Operator API keys ──────────────────────────────────────────────────────

export interface OperatorKeyView {
  id: string;
  name: string;
  prefix: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const toView = (k: typeof operatorApiKey.$inferSelect): OperatorKeyView => ({
  id: k.id,
  name: k.name,
  prefix: k.prefix,
  createdBy: k.createdBy,
  createdAt: k.createdAt.toISOString(),
  lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
  revokedAt: k.revokedAt?.toISOString() ?? null,
});

export async function listOperatorKeys(deps: Pick<Deps, 'db'>): Promise<OperatorKeyView[]> {
  const rows = await deps.db.select().from(operatorApiKey).orderBy(desc(operatorApiKey.createdAt));
  return rows.map(toView);
}

const keyName = z.string().trim().min(1, 'Name the key (e.g. "SCF reporting").').max(80);

export async function createOperatorKey(
  deps: Pick<Deps, 'db'>,
  op: OperatorContext,
  input: unknown,
): Promise<{ key: string; operatorKey: OperatorKeyView }> {
  assertWritable(op);
  const name = keyName.safeParse((input as { name?: unknown } | null)?.name);
  if (!name.success) throw new ValidationError({ name: name.error.issues[0]!.message });
  const key = generateKey('operator');
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(operatorApiKey)
      .values({
        name: name.data,
        prefix: keyPrefix(key),
        keyHash: hashKey(key),
        createdBy: op.actor,
      })
      .returning();
    await audit(
      tx,
      op.actor,
      'operator_key.create',
      { type: 'operator_api_key', id: row!.id },
      { name: name.data },
    );
    return { key, operatorKey: toView(row!) };
  });
}

export async function revokeOperatorKey(
  deps: Pick<Deps, 'db'>,
  op: OperatorContext,
  id: string,
): Promise<void> {
  assertWritable(op);
  if (!z.uuid().safeParse(id).success) throw new NotFoundError();
  await deps.db.transaction(async (tx) => {
    const rows = await tx
      .update(operatorApiKey)
      .set({ revokedAt: new Date(), revokedBy: op.actor })
      .where(and(eq(operatorApiKey.id, id), isNull(operatorApiKey.revokedAt)))
      .returning({ id: operatorApiKey.id });
    if (rows.length === 0) throw new NotFoundError();
    await audit(tx, op.actor, 'operator_key.revoke', { type: 'operator_api_key', id });
  });
}

const lastTouch = new Map<string, number>();

/** Resolves a Bearer operator key to a read-only, all-tenant operator context. */
export async function operatorFromApiKey(
  deps: Pick<Deps, 'db'>,
  authorization: string | null,
): Promise<OperatorContext | null> {
  const key = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!isKeyOfKind(key, 'operator')) return null;
  const [row] = await deps.db
    .select({ id: operatorApiKey.id, prefix: operatorApiKey.prefix })
    .from(operatorApiKey)
    .where(and(eq(operatorApiKey.keyHash, hashKey(key)), isNull(operatorApiKey.revokedAt)));
  if (!row) return null;
  const now = Date.now();
  if ((lastTouch.get(row.id) ?? 0) < now - 60_000) {
    lastTouch.set(row.id, now);
    await deps.db
      .update(operatorApiKey)
      .set({ lastUsedAt: new Date(now) })
      .where(eq(operatorApiKey.id, row.id));
  }
  return { actor: `api-key:${row.prefix}`, scope: 'all', readOnly: true, via: 'api_key' };
}
