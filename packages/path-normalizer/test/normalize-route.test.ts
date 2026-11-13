import { describe, expect, it } from 'vitest';
import { normalizeRoute } from '../src/index.js';
import type { Attributes, RouteResult } from '../src/index.js';
import { ACCOUNT_A, SECRET_A } from './fixtures.js';

const cases: readonly [name: string, attributes: Attributes, expected: RouteResult][] = [
  [
    'prefers http.route over raw paths',
    { 'http.route': '/users/:id', 'url.path': '/users/42' },
    { route: '/users/:id', source: 'http.route', secretsRedacted: 0 },
  ],
  [
    'uses http.route verbatim (no trailing-slash or digit rewriting)',
    { 'http.route': '/v1/items/42/' },
    { route: '/v1/items/42/', source: 'http.route', secretsRedacted: 0 },
  ],
  [
    'keeps OpenAPI-style templates',
    { 'http.route': '/accounts/{account_id}/payments' },
    { route: '/accounts/{account_id}/payments', source: 'http.route', secretsRedacted: 0 },
  ],
  [
    'adds a leading slash to http.route',
    { 'http.route': 'users/:id' },
    { route: '/users/:id', source: 'http.route', secretsRedacted: 0 },
  ],
  [
    'strips query and fragment from http.route',
    { 'http.route': '/search?q=x#y' },
    { route: '/search', source: 'http.route', secretsRedacted: 0 },
  ],
  [
    'still redacts secret seeds inside http.route',
    { 'http.route': `/sign/${SECRET_A}` },
    { route: '/sign/{REDACTED_SECRET}', source: 'http.route', secretsRedacted: 1 },
  ],
  [
    'ignores an empty http.route',
    { 'http.route': '  ', 'url.path': '/users/42' },
    { route: '/users/{id}', source: 'url.path', secretsRedacted: 0 },
  ],
  [
    'ignores a non-string http.route',
    { 'http.route': 42, 'url.path': '/users/42' },
    { route: '/users/{id}', source: 'url.path', secretsRedacted: 0 },
  ],
  [
    'normalizes url.path',
    { 'url.path': `/accounts/${ACCOUNT_A}/payments` },
    { route: '/accounts/{account}/payments', source: 'url.path', secretsRedacted: 0 },
  ],
  [
    'prefers url.path over http.target',
    { 'url.path': '/a/1', 'http.target': '/b/2' },
    { route: '/a/{id}', source: 'url.path', secretsRedacted: 0 },
  ],
  [
    'normalizes http.target and drops its query string',
    { 'http.target': `/accounts/${ACCOUNT_A}?limit=10` },
    { route: '/accounts/{account}', source: 'http.target', secretsRedacted: 0 },
  ],
  [
    'falls back to url.full',
    { 'url.full': 'https://api.example.org/v1/users/7?x=1' },
    { route: '/v1/users/{id}', source: 'url.full', secretsRedacted: 0 },
  ],
  [
    'falls back to legacy http.url',
    { 'http.url': 'http://api.example.org/v1/health' },
    { route: '/v1/health', source: 'http.url', secretsRedacted: 0 },
  ],
  [
    'counts secrets found in raw paths',
    { 'url.path': `/keys/${SECRET_A}` },
    { route: '/keys/{REDACTED_SECRET}', source: 'url.path', secretsRedacted: 1 },
  ],
  [
    'returns {unknown} when no path attribute is present',
    { 'http.request.method': 'GET', 'http.response.status_code': 200 },
    { route: '{unknown}', source: 'none', secretsRedacted: 0 },
  ],
];

describe('normalizeRoute', () => {
  it.each(cases)('%s', (_name, attributes, expected) => {
    expect(normalizeRoute(attributes)).toEqual(expected);
  });

  it('passes options through to path normalization', () => {
    expect(normalizeRoute({ 'url.path': '/a/b/c/d' }, { maxSegments: 2 }).route).toBe('/a/b/{…}');
  });
});
