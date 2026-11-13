import Link from 'next/link';
import { StatusBadge } from '@/components/status-badge';
import { listProjects } from '@/lib/projects';
import { getDeps, requireUser } from '@/lib/server';

export const metadata = { title: 'Projects' };

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await listProjects(getDeps(), user.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your projects</h1>
        <Link href="/projects/new" className="btn btn-primary">
          New project
        </Link>
      </div>
      {projects.length === 0 ? (
        <div className="card p-8 text-center text-ink-2">
          No projects yet.{' '}
          <Link href="/projects/new" className="underline">
            Enroll your first one
          </Link>
          .
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link
                href={`/projects/${p.id}`}
                className="card p-4 block hover:border-[var(--axis)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{p.name}</span>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-1 text-sm text-muted truncate">{p.domains.join(', ')}</div>
                <div className="mt-1 text-xs text-muted font-mono truncate">
                  {p.stellarId.slice(0, 8)}…{p.stellarId.slice(-6)} · {p.stellarNetwork}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
