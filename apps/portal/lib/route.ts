import { env } from './env';
import { errorResponse } from './errors';
import type { OperatorContext } from './operator';
import { operatorFromApiKey } from './operator';
import type { SessionUser } from './server';
import { getDeps, userFromRequest } from './server';

type Params = Record<string, string>;
type Handler<P extends Params> = (ctx: {
  request: Request;
  user: SessionUser;
  params: P;
}) => Promise<Response>;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Wraps an API route: requires a session (401), rejects cross-origin
 * mutations (403, CSRF defense on top of SameSite cookies), and maps service
 * errors to JSON (NotFoundError → 404 for anything the user may not see).
 */
export function withUser<P extends Params = Params>(handler: Handler<P>) {
  return async (request: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    if (!SAFE_METHODS.has(request.method)) {
      const origin = request.headers.get('origin');
      if (origin !== new URL(env().PUBLIC_URL).origin) {
        return Response.json({ error: 'bad_origin' }, { status: 403 });
      }
    }
    const user = await userFromRequest(request);
    if (!user) return Response.json({ error: 'unauthenticated' }, { status: 401 });
    try {
      return await handler({ request, user, params: await ctx.params });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

type OperatorHandler<P extends Params> = (ctx: {
  request: Request;
  user: SessionUser;
  op: OperatorContext;
  params: P;
}) => Promise<Response>;

/**
 * Operator-only API route (session). Non-operators get 404, like a missing
 * route. `write: true` routes also refuse read-only operators (403).
 */
export function withOperator<P extends Params = Params>(
  handler: OperatorHandler<P>,
  options: { write?: boolean } = {},
) {
  return withUser<P>(async (ctx) => {
    const op = ctx.user.operator;
    if (!op) return Response.json({ error: 'not_found' }, { status: 404 });
    if (options.write && op.readOnly) return Response.json({ error: 'read_only' }, { status: 403 });
    return handler({ ...ctx, op });
  });
}

/**
 * Machine access for operators: `Authorization: Bearer plx_op_…`. Read-only
 * by construction (GET only). Sessions are not accepted here.
 */
export function withOperatorKey(
  handler: (ctx: { request: Request; op: OperatorContext }) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    const op = await operatorFromApiKey(getDeps(), request.headers.get('authorization'));
    if (!op) {
      return Response.json(
        { error: 'unauthenticated', message: 'Send an operator API key as a Bearer token.' },
        { status: 401, headers: { 'www-authenticate': 'Bearer' } },
      );
    }
    try {
      return await handler({ request, op });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
