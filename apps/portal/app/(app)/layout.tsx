import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { listProjects } from '@/lib/projects';
import { getDeps, requireUser } from '@/lib/server';

/** Signed-in shell: sidebar navigation + inset content area. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [projects, jar] = await Promise.all([listProjects(getDeps(), user.id), cookies()]);
  const defaultOpen = jar.get('sidebar_state')?.value !== 'false';

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        variant="inset"
        user={{
          name: user.name,
          email: user.email,
          operator: user.operator
            ? { scope: user.operator.scope, readOnly: user.operator.readOnly }
            : null,
        }}
        projects={projects.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
      />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm text-muted-foreground">
            Privacy-first analytics · no cookies on tracked sites
          </span>
        </header>
        <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
