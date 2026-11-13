import { revokeIngestKey } from '@/lib/ingest-keys';
import { withUser } from '@/lib/route';
import { getDeps } from '@/lib/server';

export const DELETE = withUser<{ projectId: string; keyId: string }>(async ({ user, params }) => {
  await revokeIngestKey(getDeps(), user.id, params.projectId, params.keyId);
  return new Response(null, { status: 204 });
});
