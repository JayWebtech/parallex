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

  it('every API route except auth, health and the tracker uses withUser/withOperator', async () => {
    const { readFileSync } = await import('node:fs');
    const unguarded = files
      .filter((f) => f.endsWith('route.ts'))
      .filter((f) => !/app\/api\/auth\/|app\/api\/health\/|app\/p\//.test(f))
      .filter((f) => !/with(User|Operator)(<[^>]*>)?\(/.test(readFileSync(join(root, f), 'utf8')));
    expect(unguarded).toEqual([]);
  });
});
