import { auditLog, setting } from '@parallax/db';
import type { EnrollmentMode } from '@parallax/db';
import { eq } from 'drizzle-orm';
import type { Deps } from './deps';

const ENROLLMENT_MODE = 'enrollment_mode';
export const ENROLLMENT_MODES: readonly EnrollmentMode[] = ['open', 'approval_required'];

export async function getEnrollmentMode(deps: Pick<Deps, 'db'>): Promise<EnrollmentMode> {
  const [row] = await deps.db.select().from(setting).where(eq(setting.key, ENROLLMENT_MODE));
  return row?.value === 'approval_required' ? 'approval_required' : 'open';
}

export async function setEnrollmentMode(
  deps: Pick<Deps, 'db'>,
  mode: EnrollmentMode,
  actorEmail: string,
): Promise<void> {
  await deps.db.transaction(async (tx) => {
    await tx
      .insert(setting)
      .values({ key: ENROLLMENT_MODE, value: mode, updatedBy: actorEmail })
      .onConflictDoUpdate({
        target: setting.key,
        set: { value: mode, updatedBy: actorEmail, updatedAt: new Date() },
      });
    await tx.insert(auditLog).values({
      actorEmail,
      action: 'enrollment_mode.set',
      targetType: 'setting',
      targetId: ENROLLMENT_MODE,
      details: { mode },
    });
  });
}
