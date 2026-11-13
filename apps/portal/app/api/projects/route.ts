import { createProject, listProjects } from '@/lib/projects';
import { readJson, withUser } from '@/lib/route';
import { getDeps } from '@/lib/server';
import { toProjectView } from '@/lib/views';

/** The caller's own projects. */
export const GET = withUser(async ({ user }) => {
  const projects = await listProjects(getDeps(), user.id);
  return Response.json({ projects: projects.map(toProjectView) });
});

/** Self-service enrollment. */
export const POST = withUser(async ({ request, user }) => {
  const project = await createProject(getDeps(), user.id, await readJson(request));
  return Response.json({ project: toProjectView(project) }, { status: 201 });
});
