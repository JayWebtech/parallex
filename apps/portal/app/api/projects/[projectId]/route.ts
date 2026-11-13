import { deleteProjectByOwner, getProject } from '@/lib/projects';
import { withUser } from '@/lib/route';
import { getDeps } from '@/lib/server';
import { toProjectView } from '@/lib/views';

export const GET = withUser<{ projectId: string }>(async ({ user, params }) => {
  const project = await getProject(getDeps(), user.id, params.projectId);
  return Response.json({ project: toProjectView(project) });
});

/** Owner-only: deletes the project and, within a minute, all of its data. Body: { confirm: name }. */
export const DELETE = withUser<{ projectId: string }>(async ({ user, params, request }) => {
  await deleteProjectByOwner(
    getDeps(),
    user,
    params.projectId,
    await request.json().catch(() => null),
  );
  return new Response(null, { status: 204 });
});
