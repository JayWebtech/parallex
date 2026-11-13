const LABEL = { active: 'Active', pending: 'Awaiting approval', removed: 'Removed' } as const;

/** Status is carried by the label text, never by color alone. */
export function StatusBadge({ status }: { status: keyof typeof LABEL }) {
  const tone =
    status === 'active'
      ? 'text-good border-[var(--good-text)]'
      : status === 'pending'
        ? 'bg-warn-bg text-warn-ink border-transparent'
        : 'text-muted border-line';
  return (
    <span className={`text-xs rounded-full border px-2 py-0.5 whitespace-nowrap ${tone}`}>
      {status === 'active' ? '● ' : status === 'pending' ? '◷ ' : ''}
      {LABEL[status]}
    </span>
  );
}
