import { getSnippet } from '@/lib/projects';
import { withUser } from '@/lib/route';
import { getDeps } from '@/lib/server';

export const GET = withUser<{ projectId: string }>(async ({ user, params }) => {
  const snippet = await getSnippet(getDeps(), user.id, params.projectId);
  return Response.json({ snippet });
});
