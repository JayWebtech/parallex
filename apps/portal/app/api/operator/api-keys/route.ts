import { createOperatorKey, listOperatorKeys } from '@/lib/operator';
import { readJson, withOperator } from '@/lib/route';
import { getDeps } from '@/lib/server';

export const GET = withOperator(async () => {
  return Response.json({ keys: await listOperatorKeys(getDeps()) });
});

/** Body `{ name }`. Returns the plaintext key once; only its hash is stored. */
export const POST = withOperator(
  async ({ request, op }) => {
    const created = await createOperatorKey(getDeps(), op, await readJson(request));
    return Response.json(created, { status: 201, headers: { 'cache-control': 'no-store' } });
  },
  { write: true },
);
