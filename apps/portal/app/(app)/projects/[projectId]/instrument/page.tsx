import { Clock } from 'lucide-react';
import { IngestKeys } from '@/components/ingest-keys';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { listIngestKeys } from '@/lib/ingest-keys';
import { KEY_PLACEHOLDER, collectorConfig, nodeEnvSnippet } from '@/lib/instrument';
import { loadOwnedProject, orNotFound } from '@/lib/page-data';
import { getDeps } from '@/lib/server';

export const metadata = { title: 'API setup' };

export default async function InstrumentPage(props: { params: Promise<{ projectId: string }> }) {
  const { user, project } = await loadOwnedProject(props.params);
  const deps = getDeps();
  const keys = await listIngestKeys(deps, user.id, project.id).catch(orNotFound);
  const endpoint = new URL(deps.publicUrl).origin;

  return (
    <>
      <PageHeader
        title={project.name}
        badge={<StatusBadge status={project.status} />}
        description={
          <>
            API setup · OTLP/HTTP endpoint <code className="font-mono">{endpoint}</code> (protobuf
            or JSON, gzip). Only aggregates are kept: spans, logs and payloads are dropped on
            arrival.
          </>
        }
      />
      {project.status === 'active' ? (
        <IngestKeys
          projectId={project.id}
          keys={keys}
          placeholder={KEY_PLACEHOLDER}
          snippets={{
            node: nodeEnvSnippet(endpoint),
            collector: collectorConfig(endpoint, KEY_PLACEHOLDER),
          }}
        />
      ) : (
        <Alert>
          <Clock />
          <AlertTitle>Waiting for approval</AlertTitle>
          <AlertDescription>
            API analytics can be enabled once the project is approved.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
