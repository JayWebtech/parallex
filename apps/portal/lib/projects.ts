import { project } from '@parallax/db';
import type { Project } from '@parallax/db';
import { buildSnippet } from '@parallax/tracker';
import { and, count, desc, eq, ne } from 'drizzle-orm';
import { z } from 'zod';
import type { Deps } from './deps';
import { NotFoundError, ValidationError } from './errors';
import { audit } from './operator';
import { getEnrollmentMode } from './settings';
import { checkStellarIdExists, describeMissing, parseStellarId } from './stellar';

/**
 * Tenant-scoped project access. Every function that takes a `userId` filters
 * on `owner_id` in SQL; a project that exists but belongs to someone else is
 * indistinguishable from one that does not exist (both are NotFoundError → 404).
 */

const projectId = z.uuid();

/** Lists the user's projects (newest first), excluding removed ones. */
export async function listProjects(deps: Pick<Deps, 'db'>, userId: string): Promise<Project[]> {
  return deps.db
    .select()
    .from(project)
    .where(and(eq(project.ownerId, userId), ne(project.status, 'removed')))
    .orderBy(desc(project.createdAt));
}

/** Returns the project if, and only if, `userId` owns it and it is not removed. */
export async function getProject(
  deps: Pick<Deps, 'db'>,
  userId: string,
  id: string,
): Promise<Project> {
  if (!projectId.safeParse(id).success) throw new NotFoundError();
  const [row] = await deps.db
    .select()
    .from(project)
    .where(and(eq(project.id, id), eq(project.ownerId, userId), ne(project.status, 'removed')));
  if (!row) throw new NotFoundError();
  return row;
}

const HOSTNAME =
  /^(?=.{1,253}$)(?:localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9-]{2,63})$/;

/** Accepts hostnames or pasted URLs; returns lowercase hostnames. */
function parseDomains(raw: string | string[]): string[] | string {
  const items = (Array.isArray(raw) ? raw : raw.split(/[\s,]+/))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .map((s) => s.replace(/^[a-z]+:\/\//, '').split(/[/?#:]/)[0] ?? '');
  const unique = [...new Set(items)];
  if (unique.length === 0) return 'Add at least one domain.';
  if (unique.length > 10) return 'At most 10 domains.';
  const bad = unique.find((d) => !HOSTNAME.test(d));
  return bad ? `"${bad}" is not a valid hostname.` : unique;
}

export const createProjectInput = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80, 'Name is too long.'),
  domains: z.union([z.string(), z.array(z.string())]),
  stellarId: z.string(),
  scfUrl: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(
      z
        .url({ protocol: /^https$/, error: 'Use an https:// link.' })
        .max(300)
        .optional(),
    ),
});

/**
 * Self-service enrollment. Validates the Stellar ID (checksum, then existence
 * on mainnet or testnet), enforces the per-user limit, and either activates
 * the project right away (open enrollment) or leaves it pending for an operator.
 */
export async function createProject(deps: Deps, userId: string, input: unknown): Promise<Project> {
  const parsed = createProjectInput.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues)
      fields[String(issue.path[0] ?? 'form')] ??= issue.message;
    throw new ValidationError(fields);
  }
  const { name, scfUrl } = parsed.data;

  const domains = parseDomains(parsed.data.domains);
  if (typeof domains === 'string') throw new ValidationError({ domains });

  const stellar = parseStellarId(parsed.data.stellarId);
  if (!stellar.ok) throw new ValidationError({ stellarId: stellar.error });

  const [{ value: owned } = { value: 0 }] = await deps.db
    .select({ value: count() })
    .from(project)
    .where(and(eq(project.ownerId, userId), ne(project.status, 'removed')));
  if (owned >= deps.maxProjectsPerUser) {
    throw new ValidationError({
      form: `You can enroll at most ${deps.maxProjectsPerUser} projects.`,
    });
  }

  const existence = await checkStellarIdExists(
    stellar.id,
    stellar.kind,
    deps.stellar.endpoints,
    deps.stellar.fetch,
  );
  if (!existence.found) {
    throw new ValidationError({ stellarId: describeMissing(stellar.kind, existence) });
  }

  const values = {
    ownerId: userId,
    name,
    domains,
    stellarId: stellar.id,
    stellarIdKind: stellar.kind,
    stellarNetwork: existence.network,
    stellarVerifiedAt: new Date(),
    scfUrl: scfUrl ?? null,
  };

  if ((await getEnrollmentMode(deps)) === 'approval_required') {
    const [row] = await deps.db
      .insert(project)
      .values({ ...values, status: 'pending' })
      .returning();
    return row!;
  }

  const website = await deps.umami.createWebsite({ name, domain: domains[0]! });
  try {
    const [row] = await deps.db
      .insert(project)
      .values({ ...values, status: 'active', umamiWebsiteId: website.id })
      .returning();
    return row!;
  } catch (error) {
    await deps.umami.deleteWebsite(website.id).catch(() => undefined);
    throw error;
  }
}

/** The tracking snippet for an active project the user owns. */
export async function getSnippet(
  deps: Pick<Deps, 'db' | 'publicUrl'>,
  userId: string,
  id: string,
): Promise<string | null> {
  const p = await getProject(deps, userId, id);
  return p.umamiWebsiteId
    ? buildSnippet({ origin: deps.publicUrl, websiteId: p.umamiWebsiteId })
    : null;
}

/**
 * "Delete all my project's data": the owner removes the project, which hides
 * it at once and stops its ingest keys; the worker then permanently deletes
 * its Umami website (every event and session) and all API rollups within a
 * minute, with no grace period and no restore. The owner confirms by typing
 * the project's name.
 */
export async function deleteProjectByOwner(
  deps: Pick<Deps, 'db'>,
  owner: { id: string; email: string },
  id: string,
  input: unknown,
): Promise<void> {
  const p = await getProject(deps, owner.id, id);
  const confirm = (input as { confirm?: unknown } | null)?.confirm;
  if (typeof confirm !== 'string' || confirm.trim() !== p.name)
    throw new ValidationError({ confirm: 'Type the project name exactly to confirm.' });
  await deps.db.transaction(async (tx) => {
    const now = new Date();
    await tx
      .update(project)
      .set({ status: 'removed', removedAt: now, removedBy: 'owner', updatedAt: now })
      .where(and(eq(project.id, p.id), eq(project.ownerId, owner.id)));
    await audit(
      tx,
      owner.email,
      'project.delete_by_owner',
      { type: 'project', id: p.id },
      {
        name: p.name,
      },
    );
  });
}
