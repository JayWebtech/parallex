import { project, user } from '@parallax/db';
import type { Project } from '@parallax/db';
import { and, desc, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Deps } from './deps';
import { NotFoundError, ValidationError } from './errors';
import type { OperatorContext } from './operator';
import { assertWritable, audit } from './operator';
import { scopeFilter } from './operator-data';

export interface ManagedProject {
  id: string;
  name: string;
  domains: string[];
  status: Project['status'];
  stellarId: string;
  stellarNetwork: Project['stellarNetwork'];
  scfUrl: string | null;
  isDemo: boolean;
  ownerEmail: string;
  createdAt: string;
  removedAt: string | null;
  removedBy: string | null;
  /** When the worker will delete (or deleted) the project's data. */
  purgeAt: string | null;
  purgedAt: string | null;
}

const STATUSES = ['pending', 'active', 'removed'] as const;
export type StatusFilter = (typeof STATUSES)[number] | 'all';

/** All projects in scope, newest first, optionally filtered by status and a search term. */
export async function listManagedProjects(
  deps: Pick<Deps, 'db' | 'purgeAfterHours'>,
  op: OperatorContext,
  filter: { q?: string | undefined; status?: string | undefined } = {},
): Promise<ManagedProject[]> {
  const q = filter.q?.trim().slice(0, 100);
  const like = q ? `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : undefined;
  const status = (STATUSES as readonly string[]).includes(filter.status ?? '')
    ? (filter.status as (typeof STATUSES)[number])
    : undefined;
  const rows = await deps.db
    .select({ p: project, ownerEmail: user.email })
    .from(project)
    .innerJoin(user, eq(user.id, project.ownerId))
    .where(
      and(
        scopeFilter(op),
        status ? eq(project.status, status) : undefined,
        like
          ? or(
              ilike(project.name, like),
              ilike(project.stellarId, like),
              ilike(user.email, like),
              sql`array_to_string(${project.domains}, ' ') ILIKE ${like}`,
            )
          : undefined,
      ),
    )
    .orderBy(desc(project.createdAt))
    .limit(500);
  const grace = (deps.purgeAfterHours ?? 24) * 3_600_000;
  return rows.map(({ p, ownerEmail }) => ({
    id: p.id,
    name: p.name,
    domains: p.domains,
    status: p.status,
    stellarId: p.stellarId,
    stellarNetwork: p.stellarNetwork,
    scfUrl: p.scfUrl,
    isDemo: p.isDemo,
    ownerEmail,
    createdAt: p.createdAt.toISOString(),
    removedAt: p.removedAt?.toISOString() ?? null,
    removedBy: p.removedBy,
    purgeAt: p.removedAt ? new Date(p.removedAt.getTime() + grace).toISOString() : null,
    purgedAt: p.purgedAt?.toISOString() ?? null,
  }));
}

/** Loads one project the operator may see, or throws NotFoundError. */
async function scoped(deps: Pick<Deps, 'db'>, op: OperatorContext, id: string): Promise<Project> {
  if (!z.uuid().safeParse(id).success) throw new NotFoundError();
  const [row] = await deps.db
    .select()
    .from(project)
    .where(and(eq(project.id, id), scopeFilter(op)));
  if (!row) throw new NotFoundError();
  return row;
}

/** Activates a pending project and creates its Umami website. */
export async function approveProject(
  deps: Deps,
  op: OperatorContext,
  id: string,
): Promise<Project> {
  assertWritable(op);
  const pending = await scoped(deps, op, id);
  if (pending.status !== 'pending') throw new NotFoundError();
  const website = await deps.umami.createWebsite({
    name: pending.name,
    domain: pending.domains[0] ?? 'unknown',
  });
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .update(project)
      .set({ status: 'active', umamiWebsiteId: website.id, updatedAt: new Date() })
      .where(and(eq(project.id, id), eq(project.status, 'pending')))
      .returning();
    if (!row) throw new NotFoundError();
    await audit(tx, op.actor, 'project.approve', { type: 'project', id });
    return row;
  });
}

const reasonSchema = z.string().trim().max(500).optional();

/**
 * Soft-deletes a project: it disappears for its owner at once, its ingest
 * keys stop working, and after the grace period the worker deletes its Umami
 * website and API data. Until then an operator can restore it.
 */
export async function removeProject(
  deps: Pick<Deps, 'db'>,
  op: OperatorContext,
  id: string,
  input: unknown,
): Promise<Project> {
  assertWritable(op);
  const reason = reasonSchema.safeParse((input as { reason?: unknown } | null)?.reason);
  if (!reason.success)
    throw new ValidationError({ reason: 'Keep the reason under 500 characters.' });
  const current = await scoped(deps, op, id);
  if (current.status === 'removed') throw new NotFoundError();
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .update(project)
      .set({ status: 'removed', removedAt: new Date(), removedBy: op.actor, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning();
    await audit(
      tx,
      op.actor,
      'project.remove',
      { type: 'project', id },
      {
        previousStatus: current.status,
        ...(reason.data ? { reason: reason.data } : {}),
      },
    );
    return row!;
  });
}

/** Undoes a removal that has not been purged yet. */
export async function restoreProject(
  deps: Pick<Deps, 'db'>,
  op: OperatorContext,
  id: string,
): Promise<Project> {
  assertWritable(op);
  const current = await scoped(deps, op, id);
  if (current.status !== 'removed' || current.purgedAt) throw new NotFoundError();
  if (current.removedBy === 'owner')
    throw new ValidationError({ form: 'Its owner deleted this project and all its data.' });
  const status = current.umamiWebsiteId ? 'active' : 'pending';
  return deps.db.transaction(async (tx) => {
    const [row] = await tx
      .update(project)
      .set({ status, removedAt: null, removedBy: null, updatedAt: new Date() })
      .where(and(eq(project.id, id), isNull(project.purgedAt)))
      .returning();
    if (!row) throw new NotFoundError();
    await audit(tx, op.actor, 'project.restore', { type: 'project', id }, { status });
    return row;
  });
}
