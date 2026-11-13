import { env } from './env';
import { errorResponse } from './errors';
import type { SessionUser } from './server';
import { userFromRequest } from './server';

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

/** Same as withUser, but only for operators. Non-operators get 404, like a missing route. */
export function withOperator<P extends Params = Params>(handler: Handler<P>) {
  return withUser<P>(async (ctx) =>
    ctx.user.isOperator ? handler(ctx) : Response.json({ error: 'not_found' }, { status: 404 }),
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
