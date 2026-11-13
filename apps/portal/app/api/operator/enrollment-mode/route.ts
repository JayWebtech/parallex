import { z } from 'zod';
import { ValidationError } from '@/lib/errors';
import { readJson, withOperator } from '@/lib/route';
import { getDeps } from '@/lib/server';
import { ENROLLMENT_MODES, getEnrollmentMode, setEnrollmentMode } from '@/lib/settings';

export const GET = withOperator(async () => {
  return Response.json({ mode: await getEnrollmentMode(getDeps()) });
});

const body = z.object({ mode: z.enum(ENROLLMENT_MODES) });

export const PUT = withOperator(
  async ({ request, op }) => {
    const parsed = body.safeParse(await readJson(request));
    if (!parsed.success) throw new ValidationError({ mode: 'Use "open" or "approval_required".' });
    await setEnrollmentMode(getDeps(), parsed.data.mode, op.actor);
    return Response.json({ mode: parsed.data.mode });
  },
  { write: true },
);
