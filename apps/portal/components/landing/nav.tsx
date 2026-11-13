'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { id: 'top', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how', label: 'How it works' },
  { id: 'privacy', label: 'Privacy' },
] as const;

/**
 * Floating header: a glass pill of in-page links that highlights the section in
 * view, and gains a frosted backdrop once the page scrolls under it.
 */
export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const [active, setActive] = useState<string>('top');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const sections = LINKS.map((l) => document.getElementById(l.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    // A section is "current" once it crosses the upper third of the viewport.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-30% 0px -65% 0px' },
    );
    for (const s of sections) io.observe(s);
    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-200',
        scrolled
          ? 'bg-background/70 shadow-[0_1px_0_0_var(--color-border)] backdrop-blur-md'
          : 'bg-transparent',
      )}
    >
      <div className="mx-auto grid h-16 w-full max-w-5xl grid-cols-[1fr_auto] items-center gap-4 px-4 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="justify-self-start rounded-md focus-visible:outline-2">
          <Logo />
        </Link>

        <nav
          aria-label="Sections"
          className="hidden items-center gap-1 rounded-full border border-white/60 bg-white/45 p-1 shadow-[0_1px_2px_rgb(0_0_0/0.06),inset_0_1px_0_rgb(255_255_255/0.7)] backdrop-blur-md md:flex"
        >
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              aria-current={active === l.id ? 'location' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-200',
                active === l.id
                  ? 'bg-background text-foreground shadow-[0_1px_3px_rgb(0_0_0/0.12)]'
                  : 'text-foreground/70 hover:text-foreground',
              )}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-self-end gap-1">
          {signedIn ? (
            <Button
              className="rounded-full px-4"
              render={<Link href="/projects" />}
              nativeButton={false}
            >
              Open dashboard
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                className="hidden rounded-full hover:bg-white/50 sm:inline-flex"
                render={<Link href="/sign-in" />}
                nativeButton={false}
              >
                Sign in
              </Button>
              <Button
                className="rounded-full px-4"
                render={<Link href="/sign-up" />}
                nativeButton={false}
              >
                Enroll your project
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
