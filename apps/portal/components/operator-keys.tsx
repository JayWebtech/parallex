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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { OperatorKeyView } from '@/lib/operator';

export function OperatorKeys({
  keys,
  readOnly,
  curlExample,
}: {
  keys: OperatorKeyView[];
  readOnly: boolean;
  curlExample: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/operator/api-keys', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: new FormData(form).get('name') }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      key?: string;
      fields?: Record<string, string>;
    };
    setBusy(false);
    if (!res.ok || !body.key) {
      setError(Object.values(body.fields ?? {})[0] ?? 'Could not create a key.');
      return;
    }
    form.reset();
    setFresh(body.key);
    router.refresh();
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/operator/api-keys/${id}`, { method: 'DELETE' });
    if (res.ok) toast.success('Key revoked');
    else toast.error('Could not revoke the key.');
    router.refresh();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {!readOnly && (
        <Card>
          <CardHeader>
            <CardTitle>New key</CardTitle>
            <CardDescription>
              Read-only access to every project&apos;s aggregate metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create}>
              <FieldGroup>
                <Field data-invalid={error ? true : undefined}>
                  <FieldLabel htmlFor="key-name">Name</FieldLabel>
                  <Input
                    id="key-name"
                    name="name"
                    placeholder="SCF quarterly report"
                    maxLength={80}
                    required
                    aria-invalid={!!error}
                  />
                  <FieldError>{error}</FieldError>
                </Field>
                <Button type="submit" disabled={busy}>
                  {busy ? <Spinner data-icon="inline-start" /> : <Plus data-icon="inline-start" />}
                  Create key
                </Button>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className={readOnly ? 'xl:col-span-3' : 'xl:col-span-2'}>
        <CardHeader>
          <CardTitle>Keys</CardTitle>
          <CardDescription>Only a prefix is shown; we store a hash.</CardDescription>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <KeyRound />
                </EmptyMedia>
                <EmptyTitle>No keys yet</EmptyTitle>
                <EmptyDescription>
                  Create one to pull metrics into reports or notebooks.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <div className="font-medium">{k.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{k.prefix}…</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {new Date(k.createdAt).toLocaleDateString('en')}
                      <div className="text-xs text-muted-foreground">{k.createdBy}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString('en') : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      {k.revokedAt ? (
                        <Badge variant="secondary">Revoked</Badge>
                      ) : readOnly ? null : (
                        <AlertDialog>
                          <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
                            Revoke
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revoke “{k.name}”?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Anything using this key stops working immediately. This cannot be
                                undone.
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

      <Dialog open={fresh !== null} onOpenChange={(open) => !open && setFresh(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy your new operator key</DialogTitle>
            <DialogDescription>
              It is shown only once. Try it with the request below.
            </DialogDescription>
          </DialogHeader>
          {fresh && (
            <div className="flex flex-col gap-3">
              <CodeBlock code={fresh} label="Operator key" title="Operator key" />
              <CodeBlock
                code={curlExample.replace('KEY', fresh)}
                label="Example request"
                language="shell"
                title="Terminal"
              />
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setFresh(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
