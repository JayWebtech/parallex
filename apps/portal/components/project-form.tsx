'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Fields = Partial<Record<'name' | 'domains' | 'stellarId' | 'scfUrl' | 'form', string>>;

export function ProjectForm({ approvalRequired }: { approvalRequired: boolean }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Fields>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(form: FormData) {
    setPending(true);
    setErrors({});
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const body = (await res.json().catch(() => ({}))) as {
      project?: { id: string };
      fields?: Fields;
    };
    setPending(false);
    if (res.ok && body.project) {
      router.push(`/projects/${body.project.id}/setup`);
      return;
    }
    setErrors(body.fields ?? { form: 'Something went wrong. Please try again.' });
  }

  const err = (k: keyof Fields) =>
    errors[k] ? (
      <span role="alert" className="text-sm text-critical">
        {errors[k]}
      </span>
    ) : null;

  return (
    <form action={onSubmit} className="card p-6 space-y-5 max-w-xl">
      {approvalRequired && (
        <p className="rounded-lg bg-warn-bg text-warn-ink text-sm p-3">
          ◷ New projects currently need operator approval before tracking starts.
        </p>
      )}
      <label className="block space-y-1">
        <span className="text-sm font-medium">Project name</span>
        <input name="name" required maxLength={80} className="field" />
        {err('name')}
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Website domain(s)</span>
        <input name="domains" required placeholder="app.example.org, docs.example.org" className="field" />
        <span className="text-xs text-muted">Comma-separated hostnames where you will add the snippet.</span>
        {err('domains')}
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Stellar account or contract</span>
        <input
          name="stellarId"
          required
          spellCheck={false}
          autoComplete="off"
          placeholder="G… or C…"
          className="field font-mono text-sm"
        />
        <span className="text-xs text-muted">
          The account or contract that represents your project. We check it exists on mainnet or
          testnet.
        </span>
        {err('stellarId')}
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">
          SCF project link <span className="text-muted font-normal">(optional)</span>
        </span>
        <input name="scfUrl" type="url" placeholder="https://communityfund.stellar.org/…" className="field" />
        {err('scfUrl')}
      </label>
      {err('form')}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? 'Checking on the network…' : 'Create project'}
      </button>
    </form>
  );
}
