import { approveProject } from '@/lib/projects';
import { withOperator } from '@/lib/route';
import { getDeps } from '@/lib/server';
import { toProjectView } from '@/lib/views';

export const POST = withOperator<{ projectId: string }>(async ({ user, params }) => {
  const project = await approveProject(getDeps(), user.email, params.projectId);
  return Response.json({ project: toProjectView(project) });
});
