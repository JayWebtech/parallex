import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { parallaxScript } from './parallax';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Demo Wallet', template: '%s · Demo Wallet' },
  description: 'A fictional Stellar wallet: an example site for Parallax web analytics.',
};

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/send/', label: 'Send' },
  { href: '/activity/', label: 'Activity' },
  { href: '/assets/', label: 'Assets' },
  { href: '/settings/', label: 'Settings' },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/" className="brand">
            Demo Wallet
          </Link>
          {/* Client-side navigations: the tracker records each one as a pageview. */}
          <nav>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main>{children}</main>
        <footer>Example site for Parallax · fictional wallet, no real funds · MIT</footer>
        <Script strategy="afterInteractive" {...parallaxScript} />
      </body>
    </html>
  );
}
