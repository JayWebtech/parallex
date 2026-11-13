'use client';

import { KeyRound, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { CodeBlock } from '@/components/code-block';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { IngestKeyView } from '@/lib/ingest-keys';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en') : 'Never');

/**
 * Ingest keys plus copy-paste setup. A new key is shown once (in a dialog)
 * and substituted into the snippets for that session.
 */
export function IngestKeys(props: {
  projectId: string;
  keys: IngestKeyView[];
  snippets: { node: string; collector: string };
  placeholder: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const base = `/api/projects/${props.projectId}/ingest-keys`;
  const active = props.keys.filter((k) => !k.revokedAt);

  async function create() {
    setBusy(true);
    const res = await fetch(base, { method: 'POST' });
    const body = (await res.json().catch(() => ({}))) as {
      key?: string;
      fields?: { form?: string };
    };
    setBusy(false);
    if (!res.ok || !body.key) {
      toast.error(body.fields?.form ?? 'Could not create a key.');
      return;
    }
    setFresh(body.key);
    setDialogOpen(true);
    router.refresh();
  }

  async function revoke(id: string) {
    const res = await fetch(`${base}/${id}`, { method: 'DELETE' });
    if (res.ok) toast.success('Key revoked. Exporters using it stop within a minute.');
    else toast.error('Could not revoke the key.');
    router.refresh();
  }

  const withKey = (text: string) => (fresh ? text.replaceAll(props.placeholder, fresh) : text);

  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Ingest keys</CardTitle>
          <CardDescription>{active.length} of 5 active. We keep only a hash.</CardDescription>
          <CardAction>
            <Button size="sm" onClick={create} disabled={busy}>
              {busy ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
              Create key
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {props.keys.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRound />
                </EmptyMedia>
                <EmptyTitle>No keys yet</EmptyTitle>
                <EmptyDescription>
                  Create a key, then add it to your exporter configuration.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div className="font-mono text-xs">{k.prefix}…</div>
                      <div className="text-xs text-muted-foreground">
                        Created {new Date(k.createdAt).toLocaleDateString('en')}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{when(k.lastUsedAt)}</TableCell>
                    <TableCell className="text-right">
                      {k.revokedAt ? (
                        <Badge variant="secondary">Revoked</Badge>
                      ) : (
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
                            Revoke
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke {k.prefix}…?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Exporters using this key are rejected within a minute. This cannot
                                be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction variant="destructive" onClick={() => revoke(k.id)}>
                                Revoke key
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Send OpenTelemetry metrics</CardTitle>
          <CardDescription>
            Keep your APM. Add this destination for HTTP server request durations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="node">
            <TabsList>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="collector">Any language</TabsTrigger>
            </TabsList>
            <TabsContent value="node" className="flex flex-col gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                With OpenTelemetry auto-instrumentation, set these environment variables. Metrics
                come here; traces keep going to your own APM.
              </p>
              <CodeBlock code={withKey(props.snippets.node)} label="Environment variables" />
            </TabsContent>
            <TabsContent value="collector" className="flex flex-col gap-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Run an OpenTelemetry Collector with two exporters: everything to your APM, and only
                HTTP server duration metrics here.
              </p>
              <CodeBlock code={withKey(props.snippets.collector)} label="Collector config" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your new ingest key</DialogTitle>
            <DialogDescription>
              It is shown only once; we store a hash. The setup snippets on this page now include
              it.
            </DialogDescription>
          </DialogHeader>
          {fresh && <CodeBlock code={fresh} label="Ingest key" />}
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
