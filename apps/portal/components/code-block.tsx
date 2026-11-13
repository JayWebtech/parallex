'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Read-only code with a copy button; the icon swaps to a check for two seconds. */
export function CodeBlock({
  code,
  label,
  className,
}: {
  code: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn('relative rounded-lg border bg-muted/40', className)}>
      <pre className="max-h-96 overflow-auto overscroll-contain p-4 pr-14 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
      <Button
        variant="outline"
        size="icon-sm"
        className="absolute top-2 right-2"
        aria-label={copied ? 'Copied' : `Copy ${label ?? 'code'}`}
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          toast.success(`${label ?? 'Code'} copied`);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}
