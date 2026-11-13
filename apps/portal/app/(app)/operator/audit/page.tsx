import { AuditFilter } from '@/components/audit-filter';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AUDIT_ACTIONS, listAudit } from '@/lib/audit-log';
import { getDeps, requireOperator } from '@/lib/server';

export const metadata = { title: 'Audit log' };

export default async function AuditPage(props: { searchParams: Promise<{ action?: string }> }) {
  const { operator } = await requireOperator();
  const { action } = await props.searchParams;
  const valid = (AUDIT_ACTIONS as readonly string[]).includes(action ?? '') ? action : undefined;
  const entries = await listAudit(getDeps(), operator, { action: valid });

  return (
    <>
      <PageHeader
        title="Audit log"
        description={`Append-only record of operator and system actions. Latest ${entries.length}.`}
        actions={<AuditFilter actions={AUDIT_ACTIONS} value={valid ?? 'all'} />}
      />
      <Card>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>When (UTC)</TableHead>
                  <TableHead>Who</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className="align-top">
                    <TableCell className="whitespace-nowrap">
                      {e.at.replace('T', ' ').slice(0, 19)}
                    </TableCell>
                    <TableCell>{e.actor}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {e.action}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-56 truncate font-mono text-xs"
                      title={e.targetId ?? undefined}
                    >
                      {e.targetType ? `${e.targetType}:${e.targetId}` : '–'}
                    </TableCell>
                    <TableCell
                      className="max-w-72 truncate font-mono text-xs text-muted-foreground"
                      title={e.details ? JSON.stringify(e.details) : undefined}
                    >
                      {e.details ? JSON.stringify(e.details) : ''}
                    </TableCell>
                  </TableRow>
                ))}
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No entries.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
