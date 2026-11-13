'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

/** "Delete all my project's data", confirmed by typing the project name. */
export function DeleteProject({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ confirm: typed }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { fields?: Record<string, string> };
      setError(body.fields?.confirm ?? 'Could not delete the project. Try again.');
      return;
    }
    toast.success(`${name} deleted. Its data is erased within a minute.`);
    router.push('/projects');
    router.refresh();
  }

  return (
    <AlertDialog onOpenChange={() => (setTyped(''), setError(null))}>
      <AlertDialogTrigger render={<Button variant="destructive" />}>
        <Trash2 data-icon="inline-start" />
        Delete project and all data
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently erases every visit and API metric of this project and revokes its
            ingest keys. It cannot be undone, not even by an operator.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="confirm-name">
            Type <span className="font-mono">{name}</span> to confirm
          </FieldLabel>
          <Input
            id="confirm-name"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-invalid={!!error}
          />
          <FieldError>{error}</FieldError>
        </Field>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={busy || typed.trim() !== name} onClick={remove}>
            Delete forever
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
