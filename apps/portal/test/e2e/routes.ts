/**
 * Every portal route that takes a project ID, with how a non-owner must be
 * answered. test/route-inventory.test.ts fails if a route under app/ with a
 * [projectId] segment is missing here, so new endpoints can't skip the
 * isolation test.
 */
export interface ProjectRoute {
  /** App Router file pattern, e.g. "app/api/projects/[projectId]/web/route.ts". */
  file: string;
  method: 'GET' | 'POST' | 'DELETE';
  /** `keyId` is an ingest key of the project, created by the test. */
  path: (projectId: string, ctx: { keyId: string }) => string;
  kind: 'api' | 'page';
  /** Expected status for the owner (default 200). */
  ownerStatus?: number;
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
    // Owner without a confirmation body: 400 (the matrix must not delete the project).
    file: 'app/api/projects/[projectId]/route.ts',
    method: 'DELETE',
    path: (id) => `/api/projects/${id}`,
    kind: 'api',
    ownerStatus: 400,
  },
  {
    file: 'app/(app)/projects/[projectId]/settings/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}/settings`,
    kind: 'page',
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
    file: 'app/api/operator/projects/[projectId]/remove/route.ts',
    method: 'POST',
    path: (id) => `/api/operator/projects/${id}/remove`,
    kind: 'api',
    operatorOnly: true,
  },
  {
    file: 'app/api/operator/projects/[projectId]/restore/route.ts',
    method: 'POST',
    path: (id) => `/api/operator/projects/${id}/restore`,
    kind: 'api',
    operatorOnly: true,
  },
  {
    file: 'app/api/projects/[projectId]/api-metrics/route.ts',
    method: 'GET',
    path: (id) => `/api/projects/${id}/api-metrics?range=24h`,
    kind: 'api',
  },
  {
    file: 'app/api/projects/[projectId]/ingest-keys/route.ts',
    method: 'GET',
    path: (id) => `/api/projects/${id}/ingest-keys`,
    kind: 'api',
  },
  {
    file: 'app/api/projects/[projectId]/ingest-keys/route.ts',
    method: 'POST',
    path: (id) => `/api/projects/${id}/ingest-keys`,
    kind: 'api',
    ownerStatus: 201,
  },
  {
    file: 'app/api/projects/[projectId]/ingest-keys/[keyId]/route.ts',
    method: 'DELETE',
    path: (id, { keyId }) => `/api/projects/${id}/ingest-keys/${keyId}`,
    kind: 'api',
    ownerStatus: 204,
  },
  {
    file: 'app/(app)/projects/[projectId]/api/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}/api`,
    kind: 'page',
  },
  {
    file: 'app/(app)/projects/[projectId]/instrument/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}/instrument`,
    kind: 'page',
  },
  {
    file: 'app/(app)/projects/[projectId]/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}`,
    kind: 'page',
  },
  {
    file: 'app/(app)/projects/[projectId]/setup/page.tsx',
    method: 'GET',
    path: (id) => `/projects/${id}/setup`,
    kind: 'page',
  },
];
