import { project } from '@parallax/db';
import type { Project } from '@parallax/db';
import { DEMO_PROJECTS } from '@parallax/shared';
import type { DemoProject } from '@parallax/shared';
import { and, eq } from 'drizzle-orm';
import type { Deps } from './deps';
import { NotFoundError } from './errors';
import type { OperatorContext } from './operator';

/**
 * The public, read-only demo (/demo). No account: every query here is pinned
 * to `is_demo = true` on the server, so a real tenant's ID gets a 404 exactly
 * like a missing one. The operator view runs with the same scope a demo
 * operator login gets ('demo', read-only).
 */
export const PUBLIC_DEMO_OPERATOR: OperatorContext = {
  actor: 'public-demo',
  scope: 'demo',
  readOnly: true,
  via: 'public',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isLiveDemo = and(eq(project.isDemo, true), eq(project.status, 'active'));

/** Live demo projects, in DEMO_PROJECTS order (any other demo projects last, by name). */
export async function listDemoProjects(deps: Pick<Deps, 'db'>): Promise<Project[]> {
  const rows = await deps.db.select().from(project).where(isLiveDemo);
  const rank = (p: Project) => {
    const i = DEMO_PROJECTS.findIndex((d) => d.id === p.id);
    return i === -1 ? DEMO_PROJECTS.length : i;
  };
  return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** The example app behind a demo project, if it is one of the built-in ones. */
export function demoSpec(id: string): DemoProject | undefined {
  return DEMO_PROJECTS.find((d) => d.id === id);
}

/** A live demo project, or NotFoundError for anything else (real, removed, malformed). */
export async function getDemoProject(deps: Pick<Deps, 'db'>, id: string): Promise<Project> {
  if (!UUID.test(id)) throw new NotFoundError();
  const [row] = await deps.db
    .select()
    .from(project)
    .where(and(eq(project.id, id), isLiveDemo));
  if (!row) throw new NotFoundError();
  return row;
}

const cache = new Map<string, { at: number; value: Promise<unknown> }>();
const MAX_ENTRIES = 500;

/**
 * The demo is public and unauthenticated: identical requests within `ttlMs`
 * share one result, so traffic to /demo cannot fan out into Umami or Postgres.
 */
export function demoCached<T>(key: string, load: () => Promise<T>, ttlMs = 30_000): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = load();
  cache.set(key, { at: now, value });
  value.catch(() => cache.delete(key));
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
  return value;
}

/** Cache key part for a range (presets move with the clock; the TTL bounds staleness). */
export const rangeKey = (r: { key: string; from?: string | undefined; to?: string | undefined }) =>
  `${r.key}:${r.from ?? ''}:${r.to ?? ''}`;
