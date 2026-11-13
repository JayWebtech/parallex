import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_ROUTES, PLACEHOLDERS, createCardinalityGuard } from '../src/index.js';

describe('createCardinalityGuard', () => {
  it('admits routes until the budget is reached, then maps new ones to {other}', () => {
    const guard = createCardinalityGuard({ maxRoutes: 2 });
    expect(guard.admit('/a')).toBe('/a');
    expect(guard.admit('/b')).toBe('/b');
    expect(guard.admit('/c')).toBe(PLACEHOLDERS.other);
    expect(guard.size).toBe(2);
    expect(guard.rejected).toBe(1);
  });

  it('keeps admitting known routes after the budget is full', () => {
    const guard = createCardinalityGuard({ maxRoutes: 1 });
    guard.admit('/a');
    guard.admit('/b');
    expect(guard.admit('/a')).toBe('/a');
  });

  it('counts seeded routes toward the budget', () => {
    const guard = createCardinalityGuard({ maxRoutes: 2, known: ['/a', '/b'] });
    expect(guard.admit('/b')).toBe('/b');
    expect(guard.admit('/c')).toBe(PLACEHOLDERS.other);
  });

  it(`defaults to ${DEFAULT_MAX_ROUTES} routes`, () => {
    const guard = createCardinalityGuard();
    for (let i = 0; i < DEFAULT_MAX_ROUTES; i++) guard.admit(`/r${i}`);
    expect(guard.size).toBe(DEFAULT_MAX_ROUTES);
    expect(guard.admit('/one-more')).toBe(PLACEHOLDERS.other);
  });
});
