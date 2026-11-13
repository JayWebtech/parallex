import Link from 'next/link';
import { Logo } from '@/components/logo';
import { FRAME } from '@/components/landing/frame';
import { cn } from '@/lib/utils';

const COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Live demo', href: '/demo' },
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how' },
      { label: 'Privacy', href: '#privacy' },
    ],
  },
  {
    title: 'Legal',
    links: [{ label: 'Privacy notice', href: '/privacy' }],
  },
  {
    title: 'Projects',
    links: [
      { label: 'Enroll a project', href: '/sign-up' },
      { label: 'Sign in', href: '/sign-in' },
    ],
  },
  {
    title: 'Developers',
    links: [{ label: 'Operator API (OpenAPI)', href: '/api/v1/openapi.json' }],
  },
];

export function LandingFooter() {
  return (
    <footer className="relative z-10">
      <div className={cn(FRAME, 'grid gap-10 px-4 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]')}>
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-xs text-sm text-pretty text-muted-foreground">
            Privacy-first web and API analytics for projects in the Stellar ecosystem.
          </p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title} className="flex flex-col gap-3 text-sm">
            <h2 className="font-medium">{c.title}</h2>
            <ul className="flex flex-col gap-2 text-muted-foreground">
              {c.links.map((l) => (
                <li key={l.href}>
                  {l.href.startsWith('/') && !l.href.startsWith('/api') ? (
                    <Link href={l.href} className="transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="transition-colors hover:text-foreground">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-dashed border-foreground/12">
        <div
          className={cn(
            FRAME,
            'flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-6 text-xs text-muted-foreground',
          )}
        >
          <p>MIT licensed · No cookies on tracked sites · No IP addresses stored</p>
          <p>
            IP geolocation by{' '}
            <a
              href="https://db-ip.com"
              className="underline underline-offset-2 transition-colors hover:text-foreground"
            >
              DB-IP
            </a>{' '}
            (CC BY 4.0)
          </p>
        </div>
      </div>
    </footer>
  );
}
