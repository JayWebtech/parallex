/**
 * "Delete all my project's data" against the running stack: the owner deletes,
 * the project is gone at once, and the real worker (with its real, narrow
 * database grants) purges it on its next tick.
 */
import { createDb } from '@parallax/db';
import { describe, expect, it } from 'vitest';
import { enroll, setting, signUp } from './session';

const pgUrl = (db: string) =>
  `postgresql://postgres:${encodeURIComponent(setting('POSTGRES_PASSWORD') ?? '')}@127.0.0.1:${setting('POSTGRES_HOST_PORT') ?? '55432'}/${db}`;

describe('owner deletes a project', () => {
  it('hides it at once and the worker purges every piece of its data', async () => {
    const owner = await signUp();
    const name = `Delete-${Date.now()}`;
    const id = await enroll(owner, name);

    const wrong = await owner.request('DELETE', `/api/projects/${id}`, { confirm: 'nope' });
    expect(wrong.status).toBe(400);
    const ok = await owner.request('DELETE', `/api/projects/${id}`, { confirm: name });
    expect(ok.status).toBe(204);
    expect((await owner.request('GET', `/api/projects/${id}`)).status).toBe(404);

    const { pool } = createDb(pgUrl('parallax'), { max: 1 });
    try {
      // The worker ticks every minute.
      let row: { purged_at: Date | null; umami_website_id: string | null } | undefined;
      for (let i = 0; i < 45 && !row?.purged_at; i++) {
        await new Promise((r) => setTimeout(r, 2_000));
        ({
          rows: [row],
        } = await pool.query(
          'SELECT purged_at, umami_website_id FROM portal.project WHERE id = $1',
          [id],
        ));
      }
      expect(row?.purged_at).toBeInstanceOf(Date);
      expect(row?.umami_website_id).toBeNull();
      const { rows } = await pool.query(
        `SELECT action FROM portal.audit_log WHERE target_id = $1 ORDER BY created_at`,
        [id],
      );
      expect(rows.map((r) => r.action)).toEqual(['project.delete_by_owner', 'project.purge']);
    } finally {
      await pool.end();
    }
  }, 120_000);
});
