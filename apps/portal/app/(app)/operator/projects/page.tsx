import { EnrollmentModeCard, ManagedProjects } from '@/components/project-admin';
import { PageHeader } from '@/components/page-header';
import { listManagedProjects } from '@/lib/operator-projects';
import { getDeps, requireOperator } from '@/lib/server';
import { getEnrollmentMode } from '@/lib/settings';

export const metadata = { title: 'Manage projects' };

export default async function ManageProjects(props: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { operator } = await requireOperator();
  const filter = await props.searchParams;
  const deps = getDeps();
  const [mode, projects] = await Promise.all([
    getEnrollmentMode(deps),
    listManagedProjects(deps, operator, filter),
  ]);

  return (
    <>
      <PageHeader
        title="Manage projects"
        description="Approve, remove and restore projects. Every action is recorded in the audit log."
      />
      <EnrollmentModeCard mode={mode} readOnly={operator.readOnly} />
      <ManagedProjects
        projects={projects}
        readOnly={operator.readOnly}
        q={filter.q ?? ''}
        status={filter.status ?? 'all'}
      />
    </>
  );
}
