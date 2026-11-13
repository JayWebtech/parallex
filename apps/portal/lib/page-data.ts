import 'server-only';
import type { Project } from '@parallax/db';
import { notFound } from 'next/navigation';
import { NotFoundError } from './errors';
import { getProject } from './projects';
import type { SessionUser } from './server';
import { getDeps, requireUser } from './server';

/** Turns NotFoundError into Next's 404; anything else propagates. */
export function orNotFound(error: unknown): never {
  if (error instanceof NotFoundError) notFound();
  throw error;
}

/** Signed-in owner + their project, or 404 (same as a missing project). */
export async function loadOwnedProject(
  params: Promise<{ projectId: string }>,
): Promise<{ user: SessionUser; project: Project }> {
  const [user, { projectId }] = await Promise.all([requireUser(), params]);
  const project = await getProject(getDeps(), user.id, projectId).catch(orNotFound);
  return { user, project };
}
