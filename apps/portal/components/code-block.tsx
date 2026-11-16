'use client';

import { Check, Copy, FileCode2, FileText, SquareTerminal } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { CodeLanguage, TokenKind } from '@/lib/highlight';
import { highlight } from '@/lib/highlight';
import { cn } from '@/lib/utils';

const COLOR: Record<TokenKind, string> = {
  punct: 'var(--code-punct)',
  tag: 'var(--code-tag)',
  attr: 'var(--code-attr)',
  string: 'var(--code-string)',
  comment: 'var(--code-muted)',
  key: 'var(--code-key)',
  number: 'var(--code-number)',
  command: 'var(--code-command)',
  flag: 'var(--code-flag)',
  placeholder: 'var(--code-placeholder)',
};

const LANGUAGE: Record<CodeLanguage, { label: string; icon: typeof FileCode2 }> = {
  html: { label: 'HTML', icon: FileCode2 },
  shell: { label: 'Shell', icon: SquareTerminal },
  yaml: { label: 'YAML', icon: FileCode2 },
  text: { label: 'Text', icon: FileText },
};

/**
 * Read-only code in a dark editor panel: title bar, syntax colors, line
 * numbers for multi-line code, and a copy button (copies exactly what is
 * shown; line numbers are not part of the text).
 */
export function CodeBlock({
  code,
  label,
  language = 'text',
  title,
  className,
}: {
  code: string;
  /** Used in the copy button's name and the toast ("Snippet copied"). */
  label?: string;
  language?: CodeLanguage;
  /** Shown in the title bar, e.g. a file name; defaults to the language. */
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => highlight(code, language), [code, language]);
  const numbered = lines.length > 2;
  const { label: languageLabel, icon: Icon } = LANGUAGE[language];
  // Long single tokens (keys, hashes) wrap; formatted code scrolls instead.
  const wrap = language === 'text';

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(`${label ?? 'Code'} copied`);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-code-border bg-code-bg text-code-fg shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:border-border',
        className,
      )}
    >
      <div className="flex h-10 items-center gap-2 border-b border-code-border bg-code-bar pr-1.5 pl-3.5">
        <Icon className="size-3.5 text-code-muted" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-code-muted">
          {title ?? languageLabel}
        </span>
        {title && (
          <span className="rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-code-muted uppercase ring-1 ring-code-border">
            {languageLabel}
          </span>
        )}
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'Copied' : `Copy ${label ?? 'code'}`}
          className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-code-muted transition-colors hover:bg-white/8 hover:text-code-fg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={cn(
          'max-h-[28rem] overflow-auto overscroll-contain py-3.5 font-mono text-[12.5px] leading-6',
          wrap ? 'px-4 break-all whitespace-pre-wrap' : 'whitespace-pre',
        )}
      >
        <code className={cn(!wrap && 'grid min-w-max')}>
          {lines.map((tokens, i) => (
            <span key={i} className={cn(!wrap && 'flex pr-4', !numbered && !wrap && 'pl-4')}>
              {numbered && (
                <span
                  aria-hidden
                  className="w-10 shrink-0 pr-4 text-right text-code-muted/60 tabular-nums select-none"
                >
                  {i + 1}
                </span>
              )}
              <span>
                {tokens.map((t, j) => (
                  <span
                    key={j}
                    style={t.kind ? ({ color: COLOR[t.kind] } as CSSProperties) : undefined}
                    className={t.kind === 'comment' ? 'italic' : undefined}
                  >
                    {t.text}
                  </span>
                ))}
                {wrap && i < lines.length - 1 ? '\n' : null}
                {!wrap && tokens.length === 0 ? '​' : null}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
