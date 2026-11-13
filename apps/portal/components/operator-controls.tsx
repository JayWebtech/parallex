'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ProjectView } from '@/lib/views';

export function OperatorControls(props: {
  mode: 'open' | 'approval_required';
  pending: ProjectView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true);
    await fetch(url, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? null : JSON.stringify(body),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="card p-4 space-y-3">
        <h2 className="font-medium">Enrollment mode</h2>
        <fieldset className="flex gap-4 text-sm" disabled={busy}>
          {(['open', 'approval_required'] as const).map((m) => (
            <label key={m} className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={props.mode === m}
                onChange={() => call('/api/operator/enrollment-mode', 'PUT', { mode: m })}
              />
              {m === 'open' ? 'Open (self-service)' : 'Approval required'}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted">Changes are recorded in the audit log.</p>
      </section>

      <section className="card p-4">
        <h2 className="font-medium mb-3">Waiting for approval ({props.pending.length})</h2>
        {props.pending.length === 0 ? (
          <p className="text-sm text-muted">Nothing to review.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {props.pending.map((p) => (
              <li key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted">
                    {p.domains.join(', ')} · <span className="font-mono">{p.stellarId}</span> (
                    {p.stellarNetwork})
                    {p.scfUrl && (
                      <>
                        {' · '}
                        <a href={p.scfUrl} className="underline" rel="noreferrer" target="_blank">
                          SCF link
                        </a>
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => call(`/api/operator/projects/${p.id}/approve`, 'POST')}
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
