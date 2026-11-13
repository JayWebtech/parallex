import { OperatorKeys } from '@/components/operator-keys';
import { PageHeader } from '@/components/page-header';
import { listOperatorKeys } from '@/lib/operator';
import { getDeps, requireOperator } from '@/lib/server';

export const metadata = { title: 'Operator API keys' };

export default async function OperatorKeysPage() {
  const { operator } = await requireOperator();
  const deps = getDeps();
  // Demo operators never see real keys.
  const keys = operator.scope === 'all' ? await listOperatorKeys(deps) : [];
  const origin = new URL(deps.publicUrl).origin;

  return (
    <>
      <PageHeader
        title="API keys"
        description={
          <>
            Machine access to <code className="font-mono">/api/v1/metrics/web</code> and{' '}
            <code className="font-mono">/api/v1/metrics/api</code>. Keys are read-only by design.
          </>
        }
      />
      <OperatorKeys
        keys={keys}
        readOnly={operator.readOnly}
        curlExample={`curl -H "Authorization: Bearer KEY" "${origin}/api/v1/metrics/web?range=7d"`}
      />
    </>
  );
}
