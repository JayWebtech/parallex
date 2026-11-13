// Every variable the compose stack reads must be documented in .env.example
// (the "no undocumented configuration" rule). Run in CI: node scripts/check-env.mjs
import { readFileSync } from 'node:fs';

const compose = readFileSync(new URL('../infra/docker-compose.yml', import.meta.url), 'utf8');
const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

const used = new Set([...compose.matchAll(/\$\{([A-Z0-9_]+)/g)].map((m) => m[1]));
// Documented = assigned, or mentioned in a commented-out assignment.
const documented = new Set([...example.matchAll(/^#?\s*([A-Z0-9_]+)=/gm)].map((m) => m[1]));
const missing = [...used].filter((v) => !documented.has(v)).sort();

if (missing.length) {
  console.error(`Not documented in .env.example: ${missing.join(', ')}`);
  process.exit(1);
}
console.log(`.env.example documents all ${used.size} variables used by infra/docker-compose.yml`);
