import { DeleteProject } from '@/components/delete-project';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadOwnedProject } from '@/lib/page-data';

export const metadata = { title: 'Project settings' };

export default async function ProjectSettings(props: { params: Promise<{ projectId: string }> }) {
  const { project } = await loadOwnedProject(props.params);
  const facts: [string, string][] = [
    ['Domains', project.domains.join(', ') || '–'],
    [
      'Stellar ID',
      `${project.stellarId} (${project.stellarIdKind}${project.stellarNetwork ? `, ${project.stellarNetwork}` : ''})`,
    ],
    ['SCF project', project.scfUrl ?? '–'],
    ['Enrolled', project.createdAt.toISOString().slice(0, 10)],
  ];

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<StatusBadge status={project.status} />}
        description="Settings"
      />
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
          <CardDescription>As registered at enrollment.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="min-w-0 font-medium break-all">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete all of this project&apos;s data</CardTitle>
          <CardDescription>
            Removes the project, revokes its ingest keys, and permanently erases its web analytics
            (every pageview and session) and API metrics within a minute. Nothing is kept.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteProject projectId={project.id} name={project.name} />
        </CardContent>
      </Card>
    </>
  );
}
