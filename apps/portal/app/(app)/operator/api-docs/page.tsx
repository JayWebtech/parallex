import { FileJson } from 'lucide-react';
import { CodeBlock } from '@/components/code-block';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { openApiDocument } from '@/lib/openapi';
import { getDeps, requireOperator } from '@/lib/server';

export const metadata = { title: 'Operator API docs' };

/** Rendered from the same OpenAPI document served at /api/v1/openapi.json. */
export default async function ApiDocsPage() {
  await requireOperator();
  const origin = new URL(getDeps().publicUrl).origin;
  const doc = openApiDocument;

  return (
    <>
      <PageHeader
        title="Operator API"
        description={doc.info.description}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<a href="/api/v1/openapi.json" />}
            nativeButton={false}
          >
            <FileJson data-icon="inline-start" />
            OpenAPI {doc.openapi}
          </Button>
        }
      />
      {Object.entries(doc.paths).map(([path, item]) => {
        const op = item.get;
        return (
          <Card key={path}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
                <Badge>GET</Badge>
                {path}
              </CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">{op.summary}.</span> {op.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {op.parameters.map((p) => (
                      <TableRow key={p.name} className="align-top">
                        <TableCell className="font-mono text-xs">{p.name}</TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          {p.description}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <CodeBlock
                label="Example"
                code={`curl -H "Authorization: Bearer $PARALLAX_OPERATOR_KEY" \\\n  "${origin}${path}?range=30d"`}
              />
            </CardContent>
            <CardFooter className="flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(op.responses).map(([code, r]) => (
                <Badge key={code} variant="outline">
                  {code} {r.description}
                </Badge>
              ))}
            </CardFooter>
          </Card>
        );
      })}
    </>
  );
}
