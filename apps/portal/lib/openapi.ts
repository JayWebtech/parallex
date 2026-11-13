import { PRODUCT_NAME, product } from '@parallax/shared';

const rangeParams = [
  {
    name: 'range',
    in: 'query',
    description: 'Preset (UTC): 24h, 7d (default), 30d, or custom with from/to.',
    schema: { type: 'string', enum: ['24h', '7d', '30d', 'custom'], default: '7d' },
  },
  {
    name: 'from',
    in: 'query',
    description: 'With range=custom: first day, YYYY-MM-DD (UTC, inclusive). Max 366 days.',
    schema: { type: 'string', format: 'date' },
  },
  {
    name: 'to',
    in: 'query',
    description: 'With range=custom: last day, YYYY-MM-DD (UTC, inclusive).',
    schema: { type: 'string', format: 'date' },
  },
  {
    name: 'project',
    in: 'query',
    description:
      'A project ID: returns full detail (series, breakdowns / routes) for that project only.',
    schema: { type: 'string', format: 'uuid' },
  },
] as const;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const nullable = (schema: object) => ({ oneOf: [schema, { type: 'null' }] });

/**
 * OpenAPI 3.1 description of the operator machine API. Served at
 * /api/v1/openapi.json and rendered on the operator "API docs" page.
 */
export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: `${PRODUCT_NAME} operator API`,
    version: '1.0.0',
    description:
      'Read-only, aggregate metrics for every enrolled project. Authenticate with an operator API key ' +
      `(${product.keyPrefixes.operator}…) as a Bearer token. Keys are created by operators in the portal. ` +
      'All times are UTC. Values are aggregates only: no individual visits, IP addresses or request payloads exist.',
  },
  security: [{ operatorKey: [] }],
  paths: {
    '/api/v1/metrics/web': {
      get: {
        operationId: 'getWebMetrics',
        summary: 'Web analytics per project',
        description:
          'Without `project`: totals for every project. With `project`: totals, previous-period totals, ' +
          'a time series and top pages, referrers, countries, devices, browsers and operating systems.',
        parameters: rangeParams,
        responses: {
          '200': {
            description: 'Web metrics',
            content: {
              'application/json': {
                schema: { oneOf: [ref('WebMetricsList'), ref('WebMetricsDetail')] },
              },
            },
          },
          '401': { description: 'Missing, malformed or revoked key' },
          '404': { description: 'Unknown project' },
        },
      },
    },
    '/api/v1/metrics/api': {
      get: {
        operationId: 'getApiMetrics',
        summary: 'API analytics per project',
        description:
          'Without `project`: request count, 5xx rate and p95 latency for every project. With `project`: ' +
          'totals, a time series and per-route request counts, status mix and p50/p95.',
        parameters: rangeParams,
        responses: {
          '200': {
            description: 'API metrics',
            content: {
              'application/json': {
                schema: { oneOf: [ref('ApiMetricsList'), ref('ApiMetricsDetail')] },
              },
            },
          },
          '401': { description: 'Missing, malformed or revoked key' },
          '404': { description: 'Unknown project' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      operatorKey: {
        type: 'http',
        scheme: 'bearer',
        description: `${product.keyPrefixes.operator}…`,
      },
    },
    schemas: {
      Range: {
        type: 'object',
        required: ['key', 'start', 'end', 'unit'],
        properties: {
          key: { type: 'string' },
          start: { type: 'string', format: 'date-time' },
          end: { type: 'string', format: 'date-time' },
          unit: { type: 'string', enum: ['hour', 'day'] },
        },
      },
      Project: {
        type: 'object',
        required: ['id', 'name', 'domains', 'status', 'stellarId', 'isDemo'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          domains: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['pending', 'active'] },
          stellarId: { type: 'string', description: 'G… account or C… contract' },
          stellarNetwork: nullable({ type: 'string', enum: ['mainnet', 'testnet'] }),
          isDemo: { type: 'boolean' },
        },
      },
      WebTotals: {
        type: 'object',
        required: ['pageviews', 'visitors', 'visits', 'bounceRate', 'avgVisitSeconds'],
        properties: {
          pageviews: { type: 'integer' },
          visitors: {
            type: 'integer',
            description: 'Unique visitors (daily-rotating anonymous hash)',
          },
          visits: { type: 'integer' },
          bounceRate: { type: 'number', minimum: 0, maximum: 1 },
          avgVisitSeconds: { type: 'number' },
        },
      },
      ApiTotals: {
        type: 'object',
        required: ['requests', 'errorRate', 'p95'],
        properties: {
          requests: { type: 'integer' },
          errorRate: {
            type: 'number',
            minimum: 0,
            maximum: 1,
            description: 'Share of 5xx responses',
          },
          p95: nullable({ type: 'number', description: 'Milliseconds' }),
        },
      },
      WebMetricsList: {
        type: 'object',
        required: ['range', 'projects'],
        properties: {
          range: ref('Range'),
          projects: {
            type: 'array',
            items: { allOf: [ref('Project'), { properties: { web: nullable(ref('WebTotals')) } }] },
          },
        },
      },
      WebMetricsDetail: {
        type: 'object',
        required: ['range', 'project', 'web'],
        properties: {
          range: ref('Range'),
          project: {
            type: 'object',
            properties: { id: { type: 'string' }, name: { type: 'string' } },
          },
          web: {
            type: 'object',
            properties: {
              totals: ref('WebTotals'),
              previous: ref('WebTotals'),
              series: { type: 'array', items: { type: 'object' } },
              breakdowns: { type: 'object' },
            },
          },
        },
      },
      ApiMetricsList: {
        type: 'object',
        required: ['range', 'projects'],
        properties: {
          range: ref('Range'),
          projects: {
            type: 'array',
            items: { allOf: [ref('Project'), { properties: { api: nullable(ref('ApiTotals')) } }] },
          },
        },
      },
      ApiMetricsDetail: {
        type: 'object',
        required: ['range', 'project', 'api'],
        properties: {
          range: ref('Range'),
          project: {
            type: 'object',
            properties: { id: { type: 'string' }, name: { type: 'string' } },
          },
          api: {
            type: 'object',
            properties: {
              totals: { type: 'object' },
              previous: { type: 'object' },
              series: { type: 'array', items: { type: 'object' } },
              routes: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
    },
  },
} as const;
