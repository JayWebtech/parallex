import { FolderPlus, Globe, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { listProjects } from '@/lib/projects';
import { getDeps, requireUser } from '@/lib/server';

export const metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjects(getDeps(), user.id);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Each project has its own private web and API analytics."
        actions={
          projects.length > 0 && (
            <Button render={<Link href="/projects/new" />} nativeButton={false}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          )
        }
      />
      {projects.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderPlus />
            </EmptyMedia>
            <EmptyTitle>Enroll your first project</EmptyTitle>
            <EmptyDescription>
              Register your project with its Stellar account or contract, then add one script tag to
              your site.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button render={<Link href="/projects/new" />} nativeButton={false}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group rounded-xl focus-visible:outline-2"
            >
              <Card className="h-full transition-[box-shadow] group-hover:shadow-md">
                <CardHeader>
                  <CardTitle className="truncate">{p.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1.5 truncate">
                    <Globe className="size-3.5 shrink-0" aria-hidden />
                    {p.domains.join(', ')}
                  </CardDescription>
                  <CardAction>
                    <StatusBadge status={p.status} />
                  </CardAction>
                </CardHeader>
                <CardFooter className="justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate font-mono">
                    {p.stellarId.slice(0, 6)}…{p.stellarId.slice(-6)}
                  </span>
                  <span className="capitalize">
                    {p.stellarIdKind} · {p.stellarNetwork}
                  </span>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
