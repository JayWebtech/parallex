import { notFound } from 'next/navigation';
import { OperatorControls } from '@/components/operator-controls';
import { listPendingProjects } from '@/lib/projects';
import { getDeps, requireUser } from '@/lib/server';
import { getEnrollmentMode } from '@/lib/settings';
import { toProjectView } from '@/lib/views';

export const metadata = { title: 'Operator' };

/** Minimal operator page for Phase 2 (enrollment mode + approvals). Phase 4 adds the global view. */
export default async function OperatorPage() {
  const user = await requireUser();
  if (!user.isOperator) notFound();
  const deps = getDeps();
  const [mode, pending] = await Promise.all([getEnrollmentMode(deps), listPendingProjects(deps)]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Operator</h1>
      <OperatorControls mode={mode} pending={pending.map(toProjectView)} />
    </div>
  );
}
