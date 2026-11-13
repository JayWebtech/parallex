'use client';

import { CircleCheck, MoreHorizontal, RotateCcw, Search, Trash2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { ManagedProject } from '@/lib/operator-projects';

async function post(url: string, body?: unknown, method = 'POST') {
  return fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
}

export function EnrollmentModeCard({
  mode,
  readOnly,
}: {
  mode: 'open' | 'approval_required';
  readOnly: boolean;
}) {
  const router = useRouter();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Enrollment</CardTitle>
        <CardDescription>
          Open: projects go live as soon as their Stellar ID checks out. Approval required: new
          projects wait for an operator. Changes are audited.
        </CardDescription>
        <CardAction>
          <ToggleGroup
            variant="outline"
            size="sm"
            value={[mode]}
            disabled={readOnly}
            aria-label="Enrollment mode"
            onValueChange={async (v) => {
              const next = v[0];
              if (typeof next !== 'string' || next === mode) return;
              const res = await post('/api/operator/enrollment-mode', { mode: next }, 'PUT');
              if (res.ok)
                toast.success(
                  next === 'open' ? 'Enrollment is open' : 'New projects now need approval',
                );
              else
                toast.error(
                  res.status === 403 ? 'This account is read-only.' : 'Could not change the mode.',
                );
              router.refresh();
            }}
          >
            <ToggleGroupItem value="open">Open</ToggleGroupItem>
            <ToggleGroupItem value="approval_required">Approval required</ToggleGroupItem>
          </ToggleGroup>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

const STATUS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Awaiting approval' },
  { value: 'active', label: 'Active' },
  { value: 'removed', label: 'Removed' },
];

export function ManagedProjects({
  projects,
  readOnly,
  q,
  status,
}: {
  projects: ManagedProject[];
  readOnly: boolean;
  q: string;
  status: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [removing, setRemoving] = useState<ManagedProject | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const filter = (next: { q?: string; status?: string }) => {
    const params = new URLSearchParams({ q, status, ...next });
    if (!params.get('q')) params.delete('q');
    if (params.get('status') === 'all') params.delete('status');
    router.push(`${pathname}?${params}`);
  };

  async function act(p: ManagedProject, action: 'approve' | 'remove' | 'restore', body?: unknown) {
    setBusy(true);
    const res = await post(`/api/operator/projects/${p.id}/${action}`, body);
    setBusy(false);
    if (!res.ok) {
      toast.error(
        res.status === 403 ? 'This account is read-only.' : `Could not ${action} ${p.name}.`,
      );
    } else {
      toast.success(
        action === 'approve'
          ? `${p.name} approved`
          : action === 'restore'
            ? `${p.name} restored`
            : `${p.name} removed`,
      );
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="w-full sm:w-80"
          onSubmit={(e) => {
            e.preventDefault();
            filter({ q: String(new FormData(e.currentTarget).get('q') ?? '') });
          }}
        >
          <InputGroup>
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              name="q"
              defaultValue={q}
              placeholder="Search name, domain, Stellar ID, owner"
              aria-label="Search projects"
            />
          </InputGroup>
        </form>
        <Select value={status} onValueChange={(v) => filter({ status: String(v) })} items={STATUS}>
          <SelectTrigger className="w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {STATUS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground tabular-nums">
          {projects.length} projects
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead>Stellar ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="max-w-72">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    {p.isDemo && <Badge variant="secondary">Demo</Badge>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {p.domains.join(', ')} · {p.ownerEmail}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-mono text-xs" title={p.stellarId}>
                    {p.stellarId.slice(0, 8)}…{p.stellarId.slice(-6)}
                  </div>
                  <div className="text-xs text-muted-foreground capitalize">
                    {p.stellarNetwork}
                    {p.scfUrl && (
                      <>
                        {' · '}
                        <a
                          href={p.scfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2"
                        >
                          SCF
                        </a>
                      </>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge status={p.status} />
                    {p.status === 'removed' && (
                      <span className="text-xs text-muted-foreground">
                        {p.purgedAt
                          ? `Data deleted ${new Date(p.purgedAt).toLocaleDateString('en')}`
                          : `Data deleted after ${new Date(p.purgeAt!).toLocaleString('en', { timeZone: 'UTC' })} UTC`}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(p.createdAt).toLocaleDateString('en')}
                </TableCell>
                <TableCell>
                  {!readOnly && !(p.status === 'removed' && p.purgedAt) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Actions for ${p.name}`}
                          />
                        }
                      >
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          {p.status === 'pending' && (
                            <DropdownMenuItem disabled={busy} onClick={() => act(p, 'approve')}>
                              <CircleCheck />
                              Approve
                            </DropdownMenuItem>
                          )}
                          {p.status === 'removed' ? (
                            <DropdownMenuItem disabled={busy} onClick={() => act(p, 'restore')}>
                              <RotateCcw />
                              Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => {
                                setReason('');
                                setRemoving(p);
                              }}
                            >
                              <Trash2 />
                              Remove…
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No projects match.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears for its owner immediately and its ingest keys stop working. Its web and
              API data are permanently deleted after the grace period unless you restore it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Field>
            <FieldLabel htmlFor="remove-reason">
              Reason (optional, kept in the audit log)
            </FieldLabel>
            <Textarea
              id="remove-reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing) void act(removing, 'remove', { reason });
                setRemoving(null);
              }}
            >
              Remove project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
