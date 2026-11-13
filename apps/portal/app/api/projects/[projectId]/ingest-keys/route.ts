import { createIngestKey, listIngestKeys } from '@/lib/ingest-keys';
import { withUser } from '@/lib/route';
import { getDeps } from '@/lib/server';

export const GET = withUser<{ projectId: string }>(async ({ user, params }) => {
  return Response.json({ keys: await listIngestKeys(getDeps(), user.id, params.projectId) });
});

/** Returns the plaintext key once; only its hash is stored. */
export const POST = withUser<{ projectId: string }>(async ({ user, params }) => {
  const created = await createIngestKey(getDeps(), user.id, params.projectId);
  return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
});
