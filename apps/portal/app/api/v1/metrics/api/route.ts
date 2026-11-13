import { apiMetrics } from '@/lib/machine-api';
import { withOperatorKey } from '@/lib/route';
import { getDeps } from '@/lib/server';

/** Operator machine API (Bearer operator key). See /api/v1/openapi.json. */
export const GET = withOperatorKey(async ({ request, op }) =>
  Response.json(await apiMetrics(getDeps(), op, request.url), {
    headers: { 'cache-control': 'no-store' },
  }),
);
