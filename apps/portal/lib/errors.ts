/** Thrown for anything the caller may not see. Always rendered as 404, never 403, so IDs can't be probed. */
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super(Object.values(fieldErrors).join(' '));
    this.name = 'ValidationError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/** Maps service errors to JSON responses in route handlers. */
export function errorResponse(error: unknown): Response {
  if (error instanceof NotFoundError) return Response.json({ error: 'not_found' }, { status: 404 });
  if (error instanceof ValidationError) {
    return Response.json({ error: 'invalid', fields: error.fieldErrors }, { status: 400 });
  }
  if (error instanceof ForbiddenError)
    return Response.json({ error: 'forbidden' }, { status: 403 });
  console.error(error);
  return Response.json({ error: 'internal' }, { status: 500 });
}
