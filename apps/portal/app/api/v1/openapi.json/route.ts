import { openApiDocument } from '@/lib/openapi';

/** Public: the API description contains no data. */
export const dynamic = 'force-static';

export function GET() {
  return Response.json(openApiDocument);
}
