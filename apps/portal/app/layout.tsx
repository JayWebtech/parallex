import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PRODUCT_NAME } from '@parallax/shared';
import { SignOutButton } from '@/components/sign-out-button';
import { currentUser } from '@/lib/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: PRODUCT_NAME, template: `%s · ${PRODUCT_NAME}` },
  description: 'Privacy-first web and API analytics for Stellar ecosystem projects.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await currentUser().catch(() => null);
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold text-base tracking-tight">
              {PRODUCT_NAME}
            </Link>
            {user && (
              <>
                <Link href="/projects" className="text-ink-2 hover:text-ink">
                  Projects
                </Link>
                {user.isOperator && (
                  <Link href="/operator" className="text-ink-2 hover:text-ink">
                    Operator
                  </Link>
                )}
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              {user ? (
                <>
                  <span className="text-muted hidden sm:inline">{user.email}</span>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="text-ink-2 hover:text-ink">
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="btn btn-primary">
                    Enroll
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 flex-1">{children}</main>
        <footer className="border-t border-line text-xs text-muted">
          <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap gap-x-6 gap-y-1">
            <span>
              No cookies on tracked sites. No IP addresses stored. Country-level location only.
            </span>
            <span>
              IP geolocation by{' '}
              <a className="underline" href="https://db-ip.com">
                DB-IP
              </a>{' '}
              (CC BY 4.0)
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
