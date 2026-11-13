import { removeProject } from '@/lib/operator-projects';
import { readJson, withOperator } from '@/lib/route';
import { getDeps } from '@/lib/server';
import { toProjectView } from '@/lib/views';

/** Soft delete; data is purged by the worker after PURGE_AFTER_HOURS. Body: `{ reason? }`. */
export const POST = withOperator<{ projectId: string }>(
  async ({ request, op, params }) => {
    const project = await removeProject(getDeps(), op, params.projectId, await readJson(request));
    return Response.json({ project: toProjectView(project) });
  },
  { write: true },
);
