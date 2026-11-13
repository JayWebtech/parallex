import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Blocks,
  ChartColumn,
  Check,
  Container,
  Database,
  Gauge,
  Globe,
  Info,
  KeyRound,
  Landmark,
  Layers,
  Lock,
  Network,
  Plug,
  Radio,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { PRODUCT_NAME } from '@parallax/shared';
import {
  Brackets,
  Divider,
  FRAME,
  GuideLines,
  IconTile,
  SectionHeading,
} from '@/components/landing/frame';
import { LandingFooter } from '@/components/landing/footer';
import { LandingNav } from '@/components/landing/nav';
import { PrivacyPhone } from '@/components/landing/privacy-phone';
import { Reveal } from '@/components/landing/reveal';
import { RouteStack } from '@/components/landing/route-stack';
import { VisitorsChart } from '@/components/landing/visitors-chart';
import { LogoMark } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { demoCached, listDemoProjects } from '@/lib/demo';
import { currentUser, getDeps } from '@/lib/server';
import { cn } from '@/lib/utils';

const STACK: { name: string; role: string; icon: LucideIcon }[] = [
  { name: 'OpenTelemetry', role: 'API metrics', icon: Radio },
  { name: 'Umami', role: 'Web analytics', icon: ChartColumn },
  { name: 'PostgreSQL', role: 'Storage', icon: Database },
  { name: 'Stellar', role: 'Project identity', icon: Sparkles },
  { name: 'Fastify', role: 'OTLP collector', icon: Zap },
  { name: 'Next.js', role: 'Portal', icon: Layers },
  { name: 'Caddy', role: 'TLS and routing', icon: Network },
  { name: 'Docker', role: 'One-command deploy', icon: Container },
];

const PRIVACY = [
  'No cookies or browser storage on tracked sites',
  'IP addresses are never stored; visitor hashes rotate daily',
  'Location stops at the country',
  'From APIs we keep aggregates only, never payloads',
];

const EXTRAS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: BadgeCheck,
    title: 'Pinned and verified',
    text: 'The tracker is version-pinned with Subresource Integrity. It never changes behind your back.',
  },
  {
    icon: ShieldCheck,
    title: 'Ad-blocker friendly',
    text: 'Neutral paths and names, tested against EasyList, EasyPrivacy, uBlock and AdGuard lists.',
  },
  {
    icon: Container,
    title: 'Self-host in one command',
    text: 'MIT licensed. One docker compose up brings the whole stack online, TLS included.',
  },
  {
    icon: KeyRound,
    title: 'Operator API',
    text: 'SCF operators get a read-only, key-authenticated API described by OpenAPI 3.1.',
  },
];

const ROLES = [
  {
    icon: UserRound,
    title: 'Visitor',
    text: 'Counted, never identified',
    selected: false,
  },
  {
    icon: Users,
    title: 'Project team',
    text: 'Their own project, nothing else',
    selected: true,
  },
  {
    icon: Landmark,
    title: 'SCF operator',
    text: 'Every project, read-only and audited',
    selected: false,
  },
];

const FLOATERS: { icon: LucideIcon; className: string; color: string; delay: number }[] = [
  { icon: Globe, className: 'left-[6%] top-[16%] -rotate-6', color: 'text-chart-1', delay: 0 },
  {
    icon: Activity,
    className: 'left-[14%] bottom-[14%] rotate-3',
    color: 'text-chart-2',
    delay: 900,
  },
  {
    icon: Gauge,
    className: 'left-[24%] top-[6%] rotate-6 hidden md:flex',
    color: 'text-chart-3',
    delay: 1800,
  },
  {
    icon: ShieldCheck,
    className: 'right-[6%] top-[20%] rotate-6',
    color: 'text-chart-3',
    delay: 500,
  },
  {
    icon: ChartColumn,
    className: 'right-[15%] bottom-[12%] -rotate-3',
    color: 'text-chart-5',
    delay: 1300,
  },
  {
    icon: Lock,
    className: 'right-[25%] top-[4%] -rotate-6 hidden md:flex',
    color: 'text-chart-4',
    delay: 2200,
  },
];

export default async function Home() {
  const [user, hasDemo] = await Promise.all([
    currentUser().catch(() => null),
    demoCached('has-demo', async () => (await listDemoProjects(getDeps())).length > 0).catch(
      () => false,
    ),
  ]);
  // Reviewers can look around without integrating anything.
  const secondary = hasDemo
    ? { href: '/demo', label: 'View live demo' }
    : { href: '#how', label: 'See how it works' };
  const cta = user
    ? { href: '/projects', label: 'Open dashboard' }
    : { href: '/sign-up', label: 'Enroll your project' };

  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-x-clip bg-background">
      {/* Without JavaScript, scroll reveals never fire: show everything. */}
      <noscript>
        <style>{`.reveal{opacity:1!important;translate:none!important;filter:none!important}`}</style>
      </noscript>
      <Clouds className="absolute inset-x-0 top-0 -z-10 h-[52rem] [mask-image:linear-gradient(to_bottom,black_75%,transparent)] md:h-[56rem]" />
      <GuideLines />
      <LandingNav signedIn={!!user} />

      <main className="relative z-10 flex-1">
        {/* Hero */}
        <section id="top" className="scroll-mt-24">
          <div
            className={cn(
              FRAME,
              'flex flex-col items-center gap-7 px-4 pt-16 pb-24 text-center md:pt-24 md:pb-32',
            )}
          >
            <Enter>
              <span className="flex size-20 items-center justify-center rounded-[1.4rem] border border-white/80 bg-linear-to-b from-white to-white/75 shadow-[inset_0_1px_0_rgb(255_255_255),0_2px_6px_rgb(0_0_0/0.08),0_16px_36px_-12px_rgb(0_60_140/0.45)] backdrop-blur">
                <LogoMark className="size-10 text-brand" />
              </span>
            </Enter>
            <Enter delay={100}>
              <h1 className="text-5xl leading-[1.02] font-semibold tracking-[-0.045em] text-balance md:text-7xl">
                Track traffic.
                <br />
                Not people.
              </h1>
            </Enter>
            <Enter delay={200}>
              <p className="max-w-xl text-lg text-pretty text-foreground/75 md:text-xl">
                Private web and API analytics for Stellar projects. One script tag, no cookies, no
                consent banner.
              </p>
            </Enter>
            <Enter delay={300} className="flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="h-11 rounded-full px-5 text-[0.95rem] shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-8px_rgb(0_0_0/0.55)] active:scale-[0.96]"
                render={<Link href={cta.href} />}
                nativeButton={false}
              >
                {cta.label}
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-11 rounded-full border-white/80 bg-white/70 px-5 text-[0.95rem] backdrop-blur hover:bg-white active:scale-[0.96]"
                render={<a href={secondary.href} />}
                nativeButton={false}
              >
                {secondary.label}
              </Button>
            </Enter>

            <Enter delay={450} className="mt-10 w-full max-w-3xl">
              <Brackets>
                <div className="flex flex-col items-start gap-4 rounded-2xl border border-white/80 bg-white/75 p-3 pr-4 text-left shadow-[0_8px_30px_-12px_rgb(0_40_100/0.25)] backdrop-blur-md sm:flex-row sm:items-center">
                  <IconTile icon={Info} size="sm" className="text-brand" />
                  <p className="flex-1 text-sm text-pretty text-muted-foreground">
                    <span className="font-medium text-foreground">
                      No cookies, no stored IP addresses, country-level location.
                    </span>{' '}
                    That is why tracked sites need no consent banner.
                  </p>
                  <Button
                    size="sm"
                    className="rounded-full px-3.5"
                    render={<a href="#privacy" />}
                    nativeButton={false}
                  >
                    How?
                  </Button>
                </div>
              </Brackets>
            </Enter>
          </div>
        </section>

        <Divider />

        {/* Stack */}
        <section className={cn(FRAME, 'flex flex-col gap-10 px-4 py-20')}>
          <Reveal>
            <SectionHeading
              title="Built on open standards"
              subtitle="No proprietary agent. Every component is open source and pinned to an exact version."
            />
          </Reveal>
          <Reveal delay={100}>
            <Brackets>
              <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-4">
                {STACK.map((s) => (
                  <li
                    key={s.name}
                    className="group flex flex-col items-center gap-1 bg-card px-3 py-6 text-center transition-colors duration-200 hover:bg-muted/40"
                  >
                    <s.icon
                      className="mb-1 size-5 text-muted-foreground transition-colors duration-200 group-hover:text-brand"
                      aria-hidden
                    />
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs text-muted-foreground">{s.role}</span>
                  </li>
                ))}
              </ul>
            </Brackets>
          </Reveal>
        </section>

        <Divider />

        {/* Features */}
        <section
          id="features"
          className={cn(FRAME, 'flex scroll-mt-20 flex-col gap-10 px-4 py-20')}
        >
          <Reveal>
            <SectionHeading
              title={<>Why {PRODUCT_NAME}?</>}
              subtitle="One dashboard for your website and your API, with nothing personal in it."
            />
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            <Reveal className="flex">
              <BentoCard
                title="Web analytics that just work"
                text="Visitors, page views, referrers, countries, devices and bounce rate, from one script tag."
              >
                <VisitorsChart />
              </BentoCard>
            </Reveal>
            <Reveal delay={100} className="flex">
              <BentoCard
                title="Latency for every API route"
                text="Volume, error rate and p50/p95 per route, from the OpenTelemetry you already run."
              >
                <RouteStack />
              </BentoCard>
            </Reveal>
          </div>
        </section>

        <Divider />

        {/* How it works */}
        <section id="how" className={cn(FRAME, 'flex scroll-mt-20 flex-col gap-10 px-4 py-20')}>
          <Reveal>
            <SectionHeading
              title="Up and running in five minutes"
              subtitle="Self-service enrollment. No SDK to learn and no code to change in your API."
            />
          </Reveal>
          <Reveal delay={100}>
            <ol className="grid overflow-hidden rounded-3xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:grid-cols-3">
              <Step n={1} icon={UserPlus} title="Enroll">
                <p>
                  Create an account and register your project with its Stellar account or contract
                  ID.
                </p>
                <MiniField label="Stellar account or contract" value="G…your project account" />
              </Step>
              <Step n={2} icon={Plug} title="Connect">
                <p>
                  Paste one script tag into your site and point your OpenTelemetry exporter at us.
                </p>
                <pre className="overflow-x-auto rounded-xl bg-foreground px-3 py-2.5 font-mono text-[11px] leading-relaxed text-background/85">
                  <code>
                    <span className="text-background/50">{'<script defer src='}</span>
                    {'"…/p/v1.0.0/px.js"'}
                    {'\n  '}
                    <span className="text-background/50">integrity=</span>
                    {'"sha384-…"'}
                    <span className="text-background/50">{'>'}</span>
                    {'\n'}
                    <span className="text-background/50">OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=</span>
                    {'…'}
                  </code>
                </pre>
              </Step>
              <Step n={3} icon={Blocks} title="See your data">
                <p>
                  Visits show up within a minute; API routes as soon as your exporter sends metrics.
                </p>
                <div className="flex items-center gap-2.5 rounded-xl border bg-background px-3 py-2.5 text-xs">
                  <span className="relative flex size-2">
                    <span className="absolute inset-0 animate-ping rounded-full bg-success/60 motion-reduce:animate-none" />
                    <span className="relative size-2 rounded-full bg-success" />
                  </span>
                  <span className="font-medium">First visit recorded</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">42 s ago</span>
                </div>
              </Step>
            </ol>
          </Reveal>
        </section>

        <Divider />

        {/* Privacy */}
        <section id="privacy" className={cn(FRAME, 'scroll-mt-20 px-4 py-20')}>
          <Reveal>
            <div className="grid overflow-hidden rounded-3xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] md:grid-cols-2">
              <div className="flex flex-col gap-6 p-7 md:p-10">
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-brand" aria-hidden />
                  Privacy
                </span>
                <div className="flex flex-col gap-3">
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance md:text-4xl">
                    Private by construction
                  </h2>
                  <p className="text-pretty text-muted-foreground">
                    Compliance should not depend on a banner. We designed the data model so there is
                    nothing personal to protect in the first place.
                  </p>
                </div>
                <ul className="flex flex-col gap-3 border-t border-dashed pt-6">
                  {PRIVACY.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/12 text-success">
                        <Check className="size-3" strokeWidth={3} aria-hidden />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex items-end justify-center border-t border-dashed bg-linear-to-b from-chart-1/8 to-transparent px-6 pt-12 md:border-t-0 md:border-l">
                <PrivacyPhone />
              </div>
            </div>
          </Reveal>
        </section>

        {/* Extras on a soft sky band */}
        <section className="relative py-20">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-linear-to-b from-transparent via-chart-1/8 to-transparent"
          />
          <div className={cn(FRAME, 'flex flex-col gap-10 px-4')}>
            <Reveal>
              <SectionHeading
                title="Production-ready from day one"
                subtitle="The boring parts are done, so your team can look at the numbers."
              />
            </Reveal>
            <Reveal delay={100}>
              <div className="relative grid overflow-visible rounded-3xl border bg-card/80 backdrop-blur sm:grid-cols-2">
                {EXTRAS.map((e, i) => (
                  <div
                    key={e.title}
                    className={cn(
                      'flex flex-col gap-4 p-7 md:p-9',
                      i < 3 && 'border-b border-dashed',
                      i >= 2 && 'sm:border-b-0',
                      i % 2 === 0 && 'sm:border-r',
                    )}
                  >
                    <IconTile icon={e.icon} className="text-brand" />
                    <div className="flex flex-col gap-1.5">
                      <h3 className="font-semibold">{e.title}</h3>
                      <p className="text-sm text-pretty text-muted-foreground">{e.text}</p>
                    </div>
                  </div>
                ))}
                <span
                  aria-hidden
                  className="absolute top-1/2 left-1/2 hidden size-2.5 -translate-1/2 rounded-full border border-foreground/25 bg-background sm:block"
                />
              </div>
            </Reveal>
          </div>
        </section>

        <Divider />

        {/* Isolation */}
        <section className={cn(FRAME, 'grid items-center gap-12 px-4 py-20 md:grid-cols-2')}>
          <Reveal className="flex flex-col gap-5">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance md:text-5xl">
              Isolation by default
            </h2>
            <p className="max-w-md text-lg text-pretty text-muted-foreground">
              Every query is scoped to your project on the server, never in the browser. Operators
              see across projects, read-only, and every action they take is audited.
            </p>
            <div className="max-w-md border-t border-dashed" />
            <dl className="grid max-w-md grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">Scoped on</dt>
                <dd className="font-semibold">The server, per request</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="text-sm text-muted-foreground">Operator access</dt>
                <dd className="font-semibold">Read-only, audited</dd>
              </div>
            </dl>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-3xl border bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_48px_-24px_rgb(0_40_100/0.25)]">
              <p className="px-4 pt-3 pb-2 text-xs font-medium text-muted-foreground">
                Who sees what
              </p>
              <ul className="flex flex-col gap-1">
                {ROLES.map((r) => (
                  <li
                    key={r.title}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl p-3',
                      r.selected && 'bg-chart-1/8 ring-1 ring-chart-1/35',
                    )}
                  >
                    <IconTile icon={r.icon} size="sm" className={r.selected ? 'text-brand' : ''} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">{r.title}</span>
                      <span className="truncate text-sm text-muted-foreground">{r.text}</span>
                    </div>
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full border',
                        r.selected && 'border-brand bg-brand text-white',
                      )}
                    >
                      {r.selected && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        {/* Call to action */}
        <section className="relative isolate overflow-hidden py-28 md:py-36">
          <Clouds className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]" />
          <div aria-hidden className="absolute inset-0 -z-10">
            {FLOATERS.map((f) => (
              <span
                key={f.className}
                className={cn('float-slow absolute flex', f.className)}
                style={{ '--delay': `${f.delay}ms` } as CSSProperties}
              >
                <IconTile icon={f.icon} className={cn('size-12 rounded-2xl', f.color)} />
              </span>
            ))}
          </div>
          <Reveal className="relative flex flex-col items-center gap-6 px-4 text-center">
            <h2 className="max-w-2xl text-4xl leading-[1.05] font-semibold tracking-[-0.04em] text-balance md:text-6xl">
              Ready to see your traffic?
            </h2>
            <p className="max-w-md text-lg text-pretty text-foreground/75">
              Enrollment is self-service. Bring the Stellar account or contract that represents your
              project.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                className="h-11 rounded-full px-5 text-[0.95rem] shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-8px_rgb(0_0_0/0.55)] active:scale-[0.96]"
                render={<Link href={cta.href} />}
                nativeButton={false}
              >
                {cta.label}
                <ArrowRight data-icon="inline-end" />
              </Button>
              {hasDemo && (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 rounded-full border-white/80 bg-white/70 px-5 text-[0.95rem] backdrop-blur hover:bg-white active:scale-[0.96]"
                  render={<Link href="/demo" />}
                  nativeButton={false}
                >
                  View live demo
                </Button>
              )}
            </div>
          </Reveal>
        </section>

        <Divider />
      </main>

      <LandingFooter />
    </div>
  );
}

/** The sky photo, responsive. Decorative. */
function Clouds({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none overflow-hidden', className)}>
      <img
        src="/images/clouds.jpg"
        srcSet="/images/clouds-1200.jpg 1200w, /images/clouds.jpg 2146w"
        sizes="100vw"
        alt=""
        fetchPriority="high"
        className="size-full object-cover object-bottom"
      />
    </div>
  );
}

function Enter({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn('enter', className)} style={{ '--delay': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  );
}

function BentoCard({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <article className="flex w-full flex-col gap-2 rounded-3xl border bg-card p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      <div className="flex min-h-72 flex-1 flex-col justify-end rounded-2xl border border-dashed bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-[size:14px_14px] bg-muted/30 p-5">
        {children}
      </div>
      <div className="flex flex-col gap-1.5 px-4 pt-2 pb-4">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-pretty text-muted-foreground">{text}</p>
      </div>
    </article>
  );
}

function Step({
  n,
  icon,
  title,
  children,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-4 border-b border-dashed p-6 last:border-b-0 md:border-r md:border-b-0 md:p-7 md:last:border-r-0">
      <div className="flex items-center justify-between">
        <IconTile icon={icon} size="sm" className="text-brand" />
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {String(n).padStart(2, '0')}
        </span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      <div className="flex flex-1 flex-col justify-between gap-4 text-sm text-pretty text-muted-foreground">
        {children}
      </div>
    </li>
  );
}

function MiniField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border bg-background px-3 py-2.5">
      <span className="text-[11px] font-medium text-foreground">{label}</span>
      <span className="truncate font-mono text-xs">{value}</span>
    </div>
  );
}
