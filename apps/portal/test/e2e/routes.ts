/**
 * Every portal route that takes a project ID, with how a non-owner must be
 * answered. test/route-inventory.test.ts fails if a route under app/ with a
 * [projectId] segment is missing here, so new endpoints can't skip the
 * isolation test.
 */
export interface ProjectRoute {
  /** App Router file pattern, e.g. "app/api/projects/[projectId]/web/route.ts". */
  file: string;
  method: 'GET' | 'POST';
  path: (projectId: string) => string;
  kind: 'api' | 'page';
  /** Operator-only routes answer 404 to everyone else, owner included. */
  operatorOnly?: boolean;
}

export const PROJECT_ROUTES: ProjectRoute[] = [
  {
    file: 'app/api/projects/[projectId]/route.ts',
    method: 'GET',
    path: (id) => `/api/projects/${id}`,
    kind: 'api',
  },
  {
    file: 'app/api/projects/[projectId]/web/route.ts',
    method: 'GET',
    path: (id) => `/api/projects/${id}/web?range=24h`,
    kind: 'api',
  },
  {
    file: 'app/api/projects/[projectId]/snippet/route.ts',
    method: 'GET',
    path: (id) => `/api/projects/${id}/snippet`,
    kind: 'api',
  },
  {
    file: 'app/api/operator/projects/[projectId]/approve/route.ts',
    method: 'POST',
    path: (id) => `/api/operator/projects/${id}/approve`,
    kind: 'api',
    operatorOnly: true,
  },
  {
    file: 'app/projects/[projectId]/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}`,
    kind: 'page',
  },
  {
    file: 'app/projects/[projectId]/setup/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}/setup`,
    kind: 'page',
  },
];
