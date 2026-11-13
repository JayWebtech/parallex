import { ArrowUpRight, Eye } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DemoNav } from '@/components/demo/demo-nav';
import type { DemoNavItem } from '@/components/demo/demo-nav';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { demoSpec, listDemoProjects } from '@/lib/demo';
import { getDeps } from '@/lib/server';

// Live data on every request; never prerendered at build time.
export const dynamic = 'force-dynamic';

/** Public, read-only demo shell: no account, no actions, demo projects only. */
export default async function DemoLayout({ children }: { children: ReactNode }) {
  const projects = await listDemoProjects(getDeps()).catch(() => []);
  const items: DemoNavItem[] = [
    ...projects.flatMap((p) => [
      { href: `/demo/${p.id}`, label: p.name, detail: 'Web' },
      ...(demoSpec(p.id)?.api !== false
        ? [{ href: `/demo/${p.id}/api`, label: p.name, detail: 'API' }]
        : []),
    ]),
    { href: '/demo/operator', label: 'Operator view' },
  ];
  const sites = projects.map((p) => demoSpec(p.id)?.site).filter((s) => s !== undefined);

  return (
    <div className="flex min-h-svh flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-3 px-4">
          <Link href="/" className="rounded-md focus-visible:outline-2">
            <Logo />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium">
            <span className="relative flex size-1.5">
              <span className="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
              <span className="relative size-1.5 rounded-full bg-success" />
            </span>
            Live demo
          </span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              className="hidden sm:inline-flex"
              render={<Link href="/sign-in" />}
              nativeButton={false}
            >
              Sign in
            </Button>
            <Button render={<Link href="/sign-up" />} nativeButton={false}>
              Enroll your project
            </Button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-2">
          <DemoNav items={items} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">
        <aside className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-background px-4 py-3 text-sm">
          <Eye className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="min-w-0 flex-1 text-pretty text-muted-foreground">
            <span className="font-medium text-foreground">Read-only demo with live data.</span> A
            fictional tenant fed by the apps in <code className="font-mono text-xs">examples/</code>
            : synthetic visitors and API calls, plus anyone who opens an example site.
          </p>
          {sites.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {sites.map((s) => (
                <Button
                  key={s.basePath}
                  variant="outline"
                  size="sm"
                  render={<a href={`${s.basePath}/`} target="_blank" rel="noopener" />}
                  nativeButton={false}
                >
                  Open {s.example}
                  <ArrowUpRight data-icon="inline-end" />
                </Button>
              ))}
            </span>
          )}
        </aside>
        {children}
      </main>
    </div>
  );
}
