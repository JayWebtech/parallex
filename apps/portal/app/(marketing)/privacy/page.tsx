import { ArrowLeft, Check, X } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PRODUCT_NAME } from '@parallax/shared';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

export const metadata = { title: 'Privacy' };
// DATA_REGION is runtime configuration.
export const dynamic = 'force-dynamic';

const KEPT = [
  'Page path, page title and hostname of each pageview',
  'Referrer (where the visitor came from)',
  'Country, derived from the IP address by a local database',
  'Browser, operating system, device type, screen size and language',
  'A visitor hash of website, IP and user agent with a salt that changes daily',
  'For APIs: per-minute counts and latency per service, method, route template and status',
];

const NEVER = [
  'IP addresses, full user-agent strings, region or city',
  'Cookies, local storage or any identifier stored on the visitor’s device',
  'Query strings: the snippet strips them in the browser, ad click IDs included',
  'Visits from browsers that send Do Not Track',
  'API request or response bodies, headers, spans, span attributes or logs',
  'Raw path IDs: account IDs, hashes and numbers are replaced by placeholders; secret seeds are redacted',
];

function List({ items, icon }: { items: string[]; icon: 'yes' | 'no' }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-sm">
          <span
            className={
              icon === 'yes'
                ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success'
                : 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
            }
          >
            {icon === 'yes' ? (
              <Check className="size-3" strokeWidth={3} aria-label="Kept" />
            ) : (
              <X className="size-3" strokeWidth={3} aria-label="Never kept" />
            )}
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-pretty text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  const region = env().DATA_REGION;
  return (
    <div className="min-h-svh bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
          <Link href="/" className="rounded-md focus-visible:outline-2">
            <Logo />
          </Link>
          <Button variant="ghost" size="sm" render={<Link href="/" />} nativeButton={false}>
            <ArrowLeft data-icon="inline-start" />
            Home
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-12">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Privacy at {PRODUCT_NAME}
          </h1>
          <p className="text-pretty text-muted-foreground">
            {PRODUCT_NAME} counts traffic, not people. Tracked sites set no cookies and store
            nothing on the visitor’s device, so they need no consent banner for {PRODUCT_NAME}.
          </p>
          <dl className="mt-2 grid gap-px overflow-hidden rounded-xl border bg-border text-sm sm:grid-cols-2">
            <div className="flex flex-col gap-0.5 bg-card p-4">
              <dt className="text-muted-foreground">Data stored in</dt>
              <dd className="font-medium">{region}</dd>
            </div>
            <div className="flex flex-col gap-0.5 bg-card p-4">
              <dt className="text-muted-foreground">Third-party processors</dt>
              <dd className="font-medium">None: everything runs on our own servers</dd>
            </div>
          </dl>
        </div>

        <Section title="What we keep">
          <List items={KEPT} icon="yes" />
        </Section>
        <Section title="What we never keep">
          <List items={NEVER} icon="no" />
        </Section>
        <Section title="How long">
          <p>
            Web analytics are kept while the project exists. API metrics are kept per minute for 14
            days, per hour for 90 days and per day for as long as the project exists.
          </p>
        </Section>
        <Section title="Deleting a project’s data">
          <p>
            Project owners can delete their project and all of its data at any time from the
            project’s Settings page; it is erased within a minute and cannot be restored. When an
            operator removes a project, its data is erased after a short grace period.
          </p>
        </Section>
        <Section title="Accounts on this portal">
          <p>
            For people who enroll a project we store an email address, a name and an argon2id
            password hash. Sessions are kept without IP address or user agent.
          </p>
        </Section>
        <Section title="Jurisdictions">
          <p>
            The design follows the GDPR and the ePrivacy Directive’s rules on device storage: no
            information is stored on or read from the visitor’s device, and IP addresses are used
            only in memory. Each tracked site remains responsible for its own privacy notice and
            should mention {PRODUCT_NAME} there. This page describes how the software works; it is
            not legal advice.
          </p>
          <p>
            Country lookup uses{' '}
            <a href="https://db-ip.com" className="underline underline-offset-2">
              DB-IP
            </a>{' '}
            (CC BY 4.0), queried locally; no lookup leaves our servers.
          </p>
        </Section>
      </main>
    </div>
  );
}
