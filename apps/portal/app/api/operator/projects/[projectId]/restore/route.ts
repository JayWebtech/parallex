import { restoreProject } from '@/lib/operator-projects';
import { withOperator } from '@/lib/route';
import { getDeps } from '@/lib/server';
import { toProjectView } from '@/lib/views';

export const POST = withOperator<{ projectId: string }>(
  async ({ op, params }) => {
    const project = await restoreProject(getDeps(), op, params.projectId);
    return Response.json({ project: toProjectView(project) });
  },
  { write: true },
);
