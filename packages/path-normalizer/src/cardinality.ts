import { PLACEHOLDERS } from './placeholders.js';

export interface CardinalityGuardOptions {
  /** Maximum distinct routes admitted. Default 1000. */
  maxRoutes?: number;
  /** Routes already stored for this tenant, so a restart does not reset the budget. */
  known?: Iterable<string>;
}

export interface CardinalityGuard {
  /** Returns `route` if it is known or fits the budget, otherwise `{other}`. */
  admit(route: string): string;
  /** Distinct routes currently admitted. */
  readonly size: number;
  /** How many `admit` calls were mapped to `{other}`. */
  readonly rejected: number;
}

export const DEFAULT_MAX_ROUTES = 1000;

/**
 * Per-tenant guard against route explosions (e.g. an ID shape the default
 * rules do not recognize). Keep one guard per tenant; memory is bounded by
 * `maxRoutes` plus the size of `known`.
 */
export function createCardinalityGuard(options: CardinalityGuardOptions = {}): CardinalityGuard {
  const maxRoutes = options.maxRoutes ?? DEFAULT_MAX_ROUTES;
  const routes = new Set<string>(options.known ?? []);
  let rejected = 0;

  return {
    admit(route) {
      if (routes.has(route)) return route;
      if (routes.size < maxRoutes) {
        routes.add(route);
        return route;
      }
      rejected++;
      return PLACEHOLDERS.other;
    },
    get size() {
      return routes.size;
    },
    get rejected() {
      return rejected;
    },
  };
}
