import { ProjectForm } from '@/components/project-form';
import { getDeps, requireUser } from '@/lib/server';
import { getEnrollmentMode } from '@/lib/settings';

export const metadata = { title: 'New project' };

export default async function NewProjectPage() {
  await requireUser();
  const mode = await getEnrollmentMode(getDeps());
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">New project</h1>
      <ProjectForm approvalRequired={mode === 'approval_required'} />
    </div>
  );
}
