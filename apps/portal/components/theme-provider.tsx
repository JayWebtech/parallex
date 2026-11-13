'use client';

import { usePathname } from 'next/navigation';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/** Pages designed for daylight only (the sky-themed landing page). */
const LIGHT_ONLY = new Set(['/']);

/** Light / dark / system via the `.dark` class. Transitions are suppressed while switching. */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  const pathname = usePathname();
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      forcedTheme={LIGHT_ONLY.has(pathname) ? 'light' : undefined}
      {...props}
    />
  );
}
