import { revokeOperatorKey } from '@/lib/operator';
import { withOperator } from '@/lib/route';
import { getDeps } from '@/lib/server';

export const DELETE = withOperator<{ keyId: string }>(
  async ({ op, params }) => {
    await revokeOperatorKey(getDeps(), op, params.keyId);
    return new Response(null, { status: 204 });
  },
  { write: true },
);
