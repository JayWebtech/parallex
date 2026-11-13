import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROJECT_ROUTES } from './e2e/routes';

const root = join(import.meta.dirname, '..');

function routeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return routeFiles(full);
    return /^(route\.ts|page\.tsx)$/.test(e.name) ? [relative(root, full)] : [];
  });
}

describe('route inventory', () => {
  const files = routeFiles(join(root, 'app'));

  it('every route with a [projectId] segment is covered by the e2e isolation test', () => {
    const scoped = files.filter((f) => f.includes('[projectId]'));
    const covered = new Set(PROJECT_ROUTES.map((r) => r.file));
    expect(scoped.length).toBeGreaterThan(0);
    expect(scoped.filter((f) => !covered.has(f))).toEqual([]);
  });

  /** Routes that are public on purpose. Everything else must use a guard. */
  const PUBLIC = /app\/api\/auth\/|app\/api\/health\/|app\/p\/|app\/api\/v1\/openapi\.json\//;

  it('every other API route uses withUser, withOperator or withOperatorKey', async () => {
    const { readFileSync } = await import('node:fs');
    const unguarded = files
      .filter((f) => f.endsWith('route.ts'))
      .filter((f) => !PUBLIC.test(f))
      .filter(
        (f) =>
          !/with(User|Operator|OperatorKey)(<[^>]*>)?\(/.test(readFileSync(join(root, f), 'utf8')),
      );
    expect(unguarded).toEqual([]);
  });

  it('every operator API route and page is operator-only', async () => {
    const { readFileSync } = await import('node:fs');
    const leaky = files
      .filter((f) => f.startsWith('app/api/operator/') || f.startsWith('app/(app)/operator/'))
      .filter(
        (f) =>
          !/withOperator(<[^>]*>)?\(|requireOperator\(/.test(readFileSync(join(root, f), 'utf8')),
      );
    expect(leaky).toEqual([]);
  });

  it('every public demo page reads through lib/demo (demo projects only)', async () => {
    const { readFileSync } = await import('node:fs');
    const pages = files.filter((f) => f.startsWith('app/(demo)/'));
    expect(pages.length).toBeGreaterThan(0);
    const unscoped = pages.filter((f) => {
      const src = readFileSync(join(root, f), 'utf8');
      // Per-project pages must resolve the ID with getDemoProject; the operator
      // pages must run as PUBLIC_DEMO_OPERATOR. Tenant helpers are off limits.
      const scoped = f.includes('[demoId]')
        ? /getDemoProject\(/.test(src)
        : /PUBLIC_DEMO_OPERATOR|listDemoProjects\(/.test(src);
      return !scoped || /getProject\(|requireUser\(|getWebAnalytics\(|getApiAnalytics\(/.test(src);
    });
    expect(unscoped).toEqual([]);
  });

  it('every machine API route requires an operator key', async () => {
    const { readFileSync } = await import('node:fs');
    const open = files
      .filter((f) => f.startsWith('app/api/v1/') && !PUBLIC.test(f))
      .filter((f) => !/withOperatorKey\(/.test(readFileSync(join(root, f), 'utf8')));
    expect(open).toEqual([]);
  });
});
