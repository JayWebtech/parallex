'use client';

import { useState } from 'react';

export function CopySnippet({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <pre className="card p-4 text-xs font-mono whitespace-pre-wrap break-all select-all">
        {snippet}
      </pre>
      <button
        type="button"
        className="btn"
        onClick={async () => {
          await navigator.clipboard.writeText(snippet);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? 'Copied ✓' : 'Copy snippet'}
      </button>
    </div>
  );
}
