import type { Database } from '@parallax/db';
import type { UmamiClient } from '@parallax/umami';
import type { StellarEndpoints } from './stellar';

/**
 * Everything the service layer touches, passed explicitly so tests can run
 * the same code against a test database and a fake Umami.
 */
export interface Deps {
  db: Database;
  umami: UmamiClient;
  stellar: { endpoints: StellarEndpoints; fetch?: typeof fetch };
  publicUrl: string;
  maxProjectsPerUser: number;
  operatorEmails: ReadonlySet<string>;
  /** Read-only operators limited to demo tenants. */
  demoOperatorEmails?: ReadonlySet<string>;
  purgeAfterHours?: number;
}
