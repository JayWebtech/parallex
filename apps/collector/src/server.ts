import { Transform } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { createCardinalityGuard } from '@parallax/path-normalizer';
import type { CardinalityGuard } from '@parallax/path-normalizer';
import { hashKey, isKeyOfKind, product } from '@parallax/shared';
import Fastify from 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { aggregate } from './aggregate.js';
import type { CollectorConfig } from './config.js';
import { DEFAULT_CONFIG } from './config.js';
import { DeltaTracker } from './delta.js';
import type { ExtractContext, ExtractResult } from './extract.js';
import { extractMetrics, extractTraces } from './extract.js';
import { RateLimiter, TtlCache } from './limits.js';
import type { MetricsRequest, TraceRequest } from './otlp.js';
import { decode, encode, types } from './proto.js';
import type { IngestKeyRecord, Store } from './store.js';

const PROTOBUF = 'application/x-protobuf';
const JSON_TYPE = 'application/json';

/** google.rpc.Status codes used by OTLP/HTTP error bodies. */
const RPC = { INVALID_ARGUMENT: 3, UNAUTHENTICATED: 16, RESOURCE_EXHAUSTED: 8, UNAVAILABLE: 14 };

declare module 'fastify' {
  interface FastifyRequest {
    ingest?: IngestKeyRecord;
  }
}

export interface ServerOptions {
  store: Store;
  config?: Partial<CollectorConfig>;
  now?: () => number;
  logger?: boolean;
}

const isProtobuf = (req: FastifyRequest) =>
  (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase() === PROTOBUF;

/** Error body per OTLP/HTTP: a google.rpc.Status in the request's encoding. */
function fail(
  req: FastifyRequest,
  reply: FastifyReply,
  http: number,
  code: number,
  message: string,
) {
  if (isProtobuf(req)) {
    return reply.code(http).type(PROTOBUF).send(encode(types.status, { code, message }));
  }
  return reply.code(http).type(JSON_TYPE).send({ code, message });
}

function readKey(req: FastifyRequest): string | null {
  const header = req.headers[product.ingestKeyHeader];
  const value = Array.isArray(header) ? header[0] : header;
  if (value) return value.trim();
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
}

export function buildServer(options: ServerOptions) {
  const config: CollectorConfig = { ...DEFAULT_CONFIG, ...options.config };
  const now = options.now ?? Date.now;
  const store = options.store;
  const keys = new TtlCache<IngestKeyRecord | null>(config.keyCacheTtlMs);
  const limiter = new RateLimiter(config.rateLimit.perSecond, config.rateLimit.burst);
  const deltas = new DeltaTracker(now());
  const routeGuards = new Map<string, Promise<CardinalityGuard>>();
  const serviceGuards = new Map<string, CardinalityGuard>();
  const touched = new Map<string, number>();

  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: config.bodyLimitBytes,
    // OTLP clients never need these; keep the attack surface small.
    onProtoPoisoning: 'error',
    onConstructorPoisoning: 'error',
  });

  // Only OTLP's two encodings; anything else (incl. Fastify's default text/plain) → 415.
  app.removeContentTypeParser('text/plain');
  app.addContentTypeParser(PROTOBUF, { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

  // gzip (the only compression OTel SDKs use). bodyLimit then applies to the
  // decompressed stream, which caps zip bombs.
  app.addHook('preParsing', async (req, reply, payload) => {
    const encoding = (req.headers['content-encoding'] ?? 'identity').toLowerCase();
    if (encoding === 'identity') return payload;
    if (encoding !== 'gzip') {
      await fail(req, reply, 415, RPC.INVALID_ARGUMENT, `unsupported content-encoding ${encoding}`);
      return payload;
    }
    let received = 0;
    const counter = new Transform({
      transform(chunk: Buffer, _enc, cb) {
        received += chunk.length;
        cb(null, chunk);
      },
    });
    const gunzip = createGunzip();
    const out = payload.pipe(counter).pipe(gunzip) as typeof gunzip & {
      receivedEncodedLength?: number;
    };
    gunzip.on('end', () => {
      out.receivedEncodedLength = received;
    });
    return out;
  });

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/')) return;
    const key = readKey(req);
    if (!key || !isKeyOfKind(key, 'ingest')) {
      return fail(
        req,
        reply,
        401,
        RPC.UNAUTHENTICATED,
        `missing or malformed ${product.ingestKeyHeader}`,
      );
    }
    const hash = hashKey(key);
    const t = now();
    let record = keys.get(hash, t);
    if (record === undefined) {
      record = await store.findKey(hash);
      keys.set(hash, record, t);
    }
    if (!record) return fail(req, reply, 401, RPC.UNAUTHENTICATED, 'unknown or revoked ingest key');

    const wait = limiter.take(record.keyId, t);
    if (wait > 0) {
      reply.header('retry-after', String(wait));
      return fail(req, reply, 429, RPC.RESOURCE_EXHAUSTED, 'rate limit exceeded');
    }
    req.ingest = record;
    if ((touched.get(record.keyId) ?? 0) < t - 60_000) {
      touched.set(record.keyId, t);
      store.touchKey(record.keyId).catch(() => undefined);
    }
  });

  async function routeGuard(projectId: string): Promise<CardinalityGuard> {
    let guard = routeGuards.get(projectId);
    if (!guard) {
      guard = store
        .knownRoutes(projectId)
        .then((known) => createCardinalityGuard({ maxRoutes: config.maxRoutesPerProject, known }));
      routeGuards.set(projectId, guard);
      guard.catch(() => routeGuards.delete(projectId));
    }
    return guard;
  }

  function serviceGuard(projectId: string): CardinalityGuard {
    let guard = serviceGuards.get(projectId);
    if (!guard) {
      guard = createCardinalityGuard({ maxRoutes: config.maxServicesPerProject });
      serviceGuards.set(projectId, guard);
    }
    return guard;
  }

  async function ingest(
    req: FastifyRequest,
    reply: FastifyReply,
    signal: 'metrics' | 'traces',
  ): Promise<FastifyReply> {
    const projectId = req.ingest!.projectId;
    let body: unknown;
    try {
      body = isProtobuf(req)
        ? decode(
            signal === 'metrics' ? types.metricsRequest : types.traceRequest,
            req.body as Buffer,
          )
        : req.body;
      if (typeof body !== 'object' || body === null) throw new Error('not an object');
    } catch {
      return fail(req, reply, 400, RPC.INVALID_ARGUMENT, `malformed ${signal} payload`);
    }

    const routes = await routeGuard(projectId);
    const overflowBefore = routes.rejected;
    const ctx: ExtractContext = {
      projectId,
      nowMs: now(),
      acceptPastMs: config.acceptPastMs,
      acceptFutureMs: config.acceptFutureMs,
      admitRoute: (r) => routes.admit(r),
      admitService: (s) => serviceGuard(projectId).admit(s),
      deltas,
    };
    let result: ExtractResult;
    try {
      result =
        signal === 'metrics'
          ? extractMetrics(body as MetricsRequest, ctx)
          : extractTraces(body as TraceRequest, ctx);
    } catch {
      return fail(req, reply, 400, RPC.INVALID_ARGUMENT, `malformed ${signal} payload`);
    }

    try {
      await store.writeMinutes(projectId, aggregate(result.samples));
      const overflow = routes.rejected - overflowBefore;
      await store.addWarnings(
        projectId,
        new Date(ctx.nowMs).toISOString().slice(0, 10),
        result.secretsRedacted,
        overflow,
      );
    } catch (error) {
      req.log.error({ err: error }, 'write failed');
      reply.header('retry-after', '5');
      return fail(req, reply, 503, RPC.UNAVAILABLE, 'temporarily unable to store data');
    }

    const field = signal === 'metrics' ? 'rejectedDataPoints' : 'rejectedSpans';
    const response: Record<string, unknown> =
      result.rejected > 0
        ? {
            partialSuccess: {
              [field]: result.rejected,
              errorMessage: `${result.rejected} ${signal === 'metrics' ? 'data points' : 'spans'} outside the accepted time window or malformed`,
            },
          }
        : {};
    if (isProtobuf(req)) {
      const type = signal === 'metrics' ? types.metricsResponse : types.traceResponse;
      return reply.code(200).type(PROTOBUF).send(encode(type, response));
    }
    return reply.code(200).type(JSON_TYPE).send(response);
  }

  app.post('/v1/metrics', (req, reply) => ingest(req, reply, 'metrics'));
  app.post('/v1/traces', (req, reply) => ingest(req, reply, 'traces'));

  // Logs are authenticated and acknowledged, never decoded or stored.
  app.post('/v1/logs', async (req, reply) =>
    isProtobuf(req)
      ? reply.code(200).type(PROTOBUF).send(Buffer.alloc(0))
      : reply.code(200).type(JSON_TYPE).send({}),
  );

  app.get('/healthz', async () => ({ ok: true }));

  app.setErrorHandler((error: { statusCode?: number; message: string }, req, reply) => {
    const status = error.statusCode ?? 500;
    if (status === 413) return fail(req, reply, 413, RPC.INVALID_ARGUMENT, 'payload too large');
    if (status === 415)
      return fail(req, reply, 415, RPC.INVALID_ARGUMENT, 'unsupported content type');
    if (status >= 400 && status < 500)
      return fail(req, reply, status, RPC.INVALID_ARGUMENT, 'bad request');
    req.log.error({ err: error }, 'unhandled');
    return fail(req, reply, 500, RPC.UNAVAILABLE, 'internal error');
  });

  return app;
}
