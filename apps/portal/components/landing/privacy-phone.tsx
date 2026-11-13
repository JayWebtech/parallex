'use client';

import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LogoMark } from '@/components/logo';
import { PRODUCT_NAME } from '@parallax/shared';

/** What happens to each piece of a visit, as a stream of phone notifications. */
const NOTES = [
  { title: 'Cookie banner', body: 'Not needed. Nothing is stored in the browser.' },
  { title: 'IP address', body: 'Never stored. Used for the country and daily hash, then dropped.' },
  { title: 'Location', body: 'Kept at country level. No regions, no cities.' },
  { title: 'Visitor hash', body: 'Rotated daily, so visits never link across days.' },
  { title: 'API payloads', body: 'Spans, logs and bodies dropped on arrival.' },
];

/** One more than fits: the oldest slides off the bottom edge instead of vanishing. */
const SHOWN = 4;

export function PrivacyPhone() {
  // `step` counts notifications ever shown; the newest is NOTES[step % len].
  const [step, setStep] = useState(SHOWN - 1);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setAnimate(true);
    const id = window.setInterval(() => {
      if (!document.hidden) setStep((s) => s + 1);
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  const visible = Array.from({ length: SHOWN }, (_, k) => step - k).filter((n) => n >= 0);

  return (
    <div
      aria-hidden
      className="relative mx-auto h-72 w-64 overflow-hidden rounded-t-[2.5rem] border-x-[6px] border-t-[6px] border-foreground/85 bg-linear-to-b from-chart-1/15 to-background px-3 pt-3 shadow-[0_20px_40px_-20px_rgb(0_0_0/0.35)]"
    >
      <div className="mx-auto mb-5 h-5 w-20 rounded-full bg-foreground/85" />
      <p className="mb-3 text-center text-4xl font-medium tracking-[-0.04em] text-foreground/80 tabular-nums">
        09:41
      </p>
      <ul className="flex flex-col">
        {visible.map((n) => {
          const note = NOTES[n % NOTES.length]!;
          return (
            <li key={n} className={animate ? 'notif-in grid' : 'grid'}>
              <div className="min-h-0 overflow-hidden">
                <div className="mb-2 flex items-start gap-2 rounded-2xl border border-white/70 bg-white/80 p-2.5 shadow-sm backdrop-blur">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
                    <LogoMark className="size-3.5" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      {PRODUCT_NAME}
                      <span className="ml-auto">now</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold">
                      {note.title}
                      <Check className="size-3 text-success" strokeWidth={3} />
                    </span>
                    <span className="text-[11px] leading-snug text-muted-foreground">
                      {note.body}
                    </span>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
