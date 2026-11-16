import { Clock, Cookie, Globe, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { currentTracker } from '@parallax/tracker';
import { CodeBlock } from '@/components/code-block';
import { prettyTag } from '@/lib/highlight';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { loadOwnedProject, orNotFound } from '@/lib/page-data';
import { getSnippet } from '@/lib/projects';
import { getDeps } from '@/lib/server';

export const metadata = { title: 'Website snippet' };

const FACTS = [
  {
    icon: Lock,
    title: 'Pinned and verified',
    text: 'Version-pinned with Subresource Integrity: browsers refuse any modified copy. Upgrades never happen silently.',
  },
  {
    icon: Cookie,
    title: 'No cookies, no storage',
    text: 'Nothing is written to the visitor’s browser, so no consent banner is needed.',
  },
  {
    icon: ShieldCheck,
    title: 'No IP addresses stored',
    text: 'Location is resolved to a country and the IP is discarded. Browsers sending Do Not Track are not counted.',
  },
  {
    icon: Globe,
    title: 'Single-page apps included',
    text: 'Route changes are tracked automatically.',
  },
];

export default async function SetupPage(props: { params: Promise<{ projectId: string }> }) {
  const { user, project } = await loadOwnedProject(props.params);
  const snippet = await getSnippet(getDeps(), user.id, project.id).catch(orNotFound);
  const tracker = currentTracker();

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<StatusBadge status={project.status} />}
        description="Website snippet · add web analytics to your site"
      />
      {!snippet ? (
        <Alert>
          <Clock />
          <AlertTitle>Waiting for approval</AlertTitle>
          <AlertDescription>
            Your snippet appears here once an operator approves the project.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>1. Paste into every page&apos;s &lt;head&gt;</CardTitle>
              <CardDescription>
                On {project.domains.join(', ')}. Tracker version {tracker.version}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock
                code={prettyTag(snippet)}
                label="Snippet"
                language="html"
                title="Inside <head> on every page"
              />
            </CardContent>
            <CardFooter className="flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                2. Open your site. Visits appear on the dashboard within a minute.
              </p>
              <Button render={<Link href={`/projects/${project.id}`} />} nativeButton={false}>
                Go to the dashboard
              </Button>
            </CardFooter>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>What the snippet does</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-4">
                {FACTS.map((f) => (
                  <li key={f.title} className="flex gap-3">
                    <f.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{f.title}</span>
                      <span className="text-sm text-muted-foreground">{f.text}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
