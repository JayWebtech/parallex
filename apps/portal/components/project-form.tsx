'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Clock } from 'lucide-react';

type Fields = Partial<Record<'name' | 'domains' | 'stellarId' | 'scfUrl' | 'form', string>>;

export function ProjectForm({ approvalRequired }: { approvalRequired: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Fields>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(e.currentTarget))),
    });
    const body = (await res.json().catch(() => ({}))) as {
      project?: { id: string; status: string };
      fields?: Fields;
    };
    setPending(false);
    if (res.ok && body.project) {
      toast.success(
        body.project.status === 'pending' ? 'Project submitted for approval' : 'Project created',
      );
      router.push(`/projects/${body.project.id}/setup`);
      router.refresh();
      return;
    }
    setErrors(body.fields ?? { form: 'Something went wrong. Please try again.' });
  }

  const field = (name: keyof Fields) => ({
    'data-invalid': errors[name] ? true : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        {approvalRequired && (
          <Alert>
            <Clock />
            <AlertTitle>Approval required</AlertTitle>
            <AlertDescription>
              New projects are reviewed by an operator before tracking starts.
            </AlertDescription>
          </Alert>
        )}
        <Field {...field('name')}>
          <FieldLabel htmlFor="name">Project name</FieldLabel>
          <Input id="name" name="name" required maxLength={80} aria-invalid={!!errors.name} />
          <FieldError>{errors.name}</FieldError>
        </Field>
        <Field {...field('domains')}>
          <FieldLabel htmlFor="domains">Website domains</FieldLabel>
          <Input
            id="domains"
            name="domains"
            required
            placeholder="app.example.org, docs.example.org"
            aria-invalid={!!errors.domains}
          />
          <FieldDescription>
            Comma-separated hostnames where you will add the snippet.
          </FieldDescription>
          <FieldError>{errors.domains}</FieldError>
        </Field>
        <Field {...field('stellarId')}>
          <FieldLabel htmlFor="stellarId">Stellar account or contract</FieldLabel>
          <Input
            id="stellarId"
            name="stellarId"
            required
            spellCheck={false}
            autoComplete="off"
            placeholder="G… or C…"
            className="font-mono"
            aria-invalid={!!errors.stellarId}
          />
          <FieldDescription>
            The account or contract that represents your project. We check that it exists on mainnet
            or testnet.
          </FieldDescription>
          <FieldError>{errors.stellarId}</FieldError>
        </Field>
        <Field {...field('scfUrl')}>
          <FieldLabel htmlFor="scfUrl">SCF project link (optional)</FieldLabel>
          <Input
            id="scfUrl"
            name="scfUrl"
            type="url"
            placeholder="https://communityfund.stellar.org/…"
            aria-invalid={!!errors.scfUrl}
          />
          <FieldError>{errors.scfUrl}</FieldError>
        </Field>
        {errors.form && (
          <Alert variant="destructive">
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        )}
        <Field orientation="horizontal">
          <Button type="submit" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {pending ? 'Checking on the network…' : 'Create project'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}
