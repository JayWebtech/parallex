import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentTracker } from '@parallax/tracker';
import { CopySnippet } from '@/components/copy-snippet';
import { NotFoundError } from '@/lib/errors';
import { getProject, getSnippet } from '@/lib/projects';
import { getDeps, requireUser } from '@/lib/server';

export const metadata = { title: 'Add the snippet' };

export default async function SetupPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireUser();
  const { projectId } = await params;
  const deps = getDeps();
  const [project, snippet] = await Promise.all([
    getProject(deps, user.id, projectId),
    getSnippet(deps, user.id, projectId),
  ]).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  const tracker = currentTracker();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href={`/projects/${project.id}`} className="text-sm text-muted hover:text-ink">
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold mt-1">Add the snippet to your site</h1>
      </div>

      {snippet ? (
        <>
          <p className="text-ink-2">
            Paste this into the <code className="font-mono text-sm">&lt;head&gt;</code> of every
            page on {project.domains.join(', ')}. Visits show up on your dashboard within a minute.
          </p>
          <CopySnippet snippet={snippet} />
          <ul className="text-sm text-ink-2 list-disc pl-5 space-y-1">
            <li>
              Tracker version <span className="font-mono">{tracker.version}</span>, pinned. The{' '}
              <code className="font-mono">integrity</code> hash makes browsers refuse any modified
              copy. Upgrades never happen silently: you copy a new snippet when you choose to.
            </li>
            <li>
              No cookies and nothing written to browser storage; no IP addresses stored;
              country-level location only. Browsers sending Do Not Track are not counted.
            </li>
            <li>Single-page apps are tracked automatically on route changes.</li>
          </ul>
          <Link href={`/projects/${project.id}`} className="btn btn-primary">
            Go to dashboard
          </Link>
        </>
      ) : (
        <p className="rounded-lg bg-warn-bg text-warn-ink p-4">
          ◷ This project is waiting for operator approval. Your snippet appears here once it is
          approved.
        </p>
      )}
    </div>
  );
}
