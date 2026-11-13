import { FlaskConical } from 'lucide-react';
import { redirect } from 'next/navigation';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { listDemoProjects } from '@/lib/demo';
import { getDeps } from '@/lib/server';

// Live data on every request; never prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Live demo' };

export default async function DemoIndex() {
  const [first] = await listDemoProjects(getDeps());
  if (first) redirect(`/demo/${first.id}`);
  return (
    <Empty className="border border-dashed bg-background">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FlaskConical />
        </EmptyMedia>
        <EmptyTitle>The demo is not running here</EmptyTitle>
        <EmptyDescription>
          Start the stack with <code className="font-mono">COMPOSE_PROFILES=demo</code> to seed the
          demo tenant and its traffic.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
