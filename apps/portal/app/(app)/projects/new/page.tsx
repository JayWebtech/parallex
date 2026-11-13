import { PageHeader } from '@/components/page-header';
import { ProjectForm } from '@/components/project-form';
import { Card, CardContent } from '@/components/ui/card';
import { getDeps, requireUser } from '@/lib/server';
import { getEnrollmentMode } from '@/lib/settings';

export const metadata = { title: 'New project' };

export default async function NewProjectPage() {
  await requireUser();
  const mode = await getEnrollmentMode(getDeps());
  return (
    <>
      <PageHeader
        title="New project"
        description="Register a project building on Stellar. You get a tracking snippet and an API ingest key."
      />
      <Card className="max-w-2xl">
        <CardContent>
          <ProjectForm approvalRequired={mode === 'approval_required'} />
        </CardContent>
      </Card>
    </>
  );
}
