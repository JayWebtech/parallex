import { auditLog, project } from '@parallax/db';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Deps } from './deps';
import type { OperatorContext } from './operator';

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
}

/**
 * Latest audit entries, newest first. Demo operators only see entries about
 * demo projects: the full log names real operators and real tenants.
 */
export async function listAudit(
  deps: Pick<Deps, 'db'>,
  op: OperatorContext,
  filter: { action?: string | undefined } = {},
  limit = 200,
): Promise<AuditEntry[]> {
  const demoOnly =
    op.scope === 'demo'
      ? and(
          eq(auditLog.targetType, 'project'),
          inArray(
            auditLog.targetId,
            deps.db
              .select({ id: sql<string>`${project.id}::text` })
              .from(project)
              .where(eq(project.isDemo, true)),
          ),
        )
      : undefined;
  const rows = await deps.db
    .select()
    .from(auditLog)
    .where(and(demoOnly, filter.action ? eq(auditLog.action, filter.action) : undefined))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    at: r.createdAt.toISOString(),
    actor: r.actorEmail,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    details: r.details,
  }));
}

export const AUDIT_ACTIONS = [
  'enrollment_mode.set',
  'project.approve',
  'project.remove',
  'project.restore',
  'project.purge',
  'operator_key.create',
  'operator_key.revoke',
] as const;
