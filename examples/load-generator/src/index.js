// Drives the demo's example apps:
//  - API: realistic requests to examples/express-api        (TARGET_URL, RPS)
//  - Web: synthetic visitors to the two example sites       (WEB_COLLECT_URL, WEB_VISITS_PER_HOUR)
// Either part runs only when its URL is set.
//
//   TARGET_URL=http://localhost:4000 RPS=20 DURATION_S=60 pnpm --filter @parallax/example-load-generator start
//
// DURATION_S=0 runs forever (the public demo); rates then follow a daily curve.
import { runApi } from './api.js';
import { runWeb } from './web.js';

const env = process.env;
const DURATION_S = Number(env.DURATION_S ?? 60);
const forever = DURATION_S === 0;
const until = forever ? Infinity : Date.now() + DURATION_S * 1000;
const stats = { api: 0, apiFailed: 0, visits: 0, pageviews: 0, webFailed: 0 };

const jobs = [];
if (env.TARGET_URL) {
  jobs.push(
    runApi({
      target: env.TARGET_URL.replace(/\/$/, ''),
      rps: Number(env.RPS ?? 20),
      until,
      shape: forever,
      stats,
    }),
  );
}
if (env.WEB_COLLECT_URL) {
  jobs.push(
    runWeb({
      collectUrl: env.WEB_COLLECT_URL,
      hostname: new URL(env.PUBLIC_URL ?? 'http://localhost:8080').hostname,
      perHour: Number(env.WEB_VISITS_PER_HOUR ?? 120),
      until,
      stats,
    }),
  );
}
if (jobs.length === 0) {
  console.error('Set TARGET_URL (API traffic) and/or WEB_COLLECT_URL (web visits).');
  process.exit(1);
}

const report = () => console.log(JSON.stringify({ msg: 'load', ...stats }));
const timer = setInterval(report, forever ? 5 * 60_000 : 10_000);
await Promise.all(jobs);
clearInterval(timer);
report();
