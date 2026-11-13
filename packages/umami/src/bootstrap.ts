/**
 * One-shot setup run by the `setup` compose service: waits for Umami, then
 * replaces the seeded `admin` / `umami` password with UMAMI_ADMIN_PASSWORD.
 * Safe to run on every deploy.
 */
import { fileURLToPath } from 'node:url';
import { UmamiClient } from './client.js';

export async function waitForUmami(baseUrl: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/heartbeat`, {
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`Umami not reachable at ${baseUrl}`);
    await new Promise((r) => setTimeout(r, 2_000));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { UMAMI_URL, UMAMI_ADMIN_USERNAME = 'admin', UMAMI_ADMIN_PASSWORD } = process.env;
  if (!UMAMI_URL || !UMAMI_ADMIN_PASSWORD) {
    console.error('UMAMI_URL and UMAMI_ADMIN_PASSWORD are required');
    process.exit(1);
  }
  await waitForUmami(UMAMI_URL);
  const client = new UmamiClient({
    baseUrl: UMAMI_URL,
    username: UMAMI_ADMIN_USERNAME,
    password: UMAMI_ADMIN_PASSWORD,
  });
  const result = await client.ensureAdminPassword();
  console.log(result === 'changed' ? 'umami: admin password set' : 'umami: admin password ok');
}
