import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6 md:p-10">
      <Link href="/" className="rounded-md focus-visible:outline-2">
        <Logo />
      </Link>
      <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
    </div>
  );
}
