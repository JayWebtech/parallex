import { fileURLToPath } from 'node:url';
import path from 'node:path';
import protobuf from 'protobufjs';

/** Vendored, checksummed protos (see proto/SOURCES.md). */
export const PROTO_DIR = fileURLToPath(new URL('../proto/', import.meta.url));

const root = new protobuf.Root();
root.resolvePath = (_origin, target) =>
  // google/protobuf/* (Any, …) ship with protobufjs.
  target.startsWith('google/protobuf/') ? target : path.join(PROTO_DIR, target);
root.loadSync(
  [
    'opentelemetry/proto/collector/metrics/v1/metrics_service.proto',
    'opentelemetry/proto/collector/trace/v1/trace_service.proto',
    'google/rpc/status.proto',
  ],
  { keepCase: false },
);
root.resolveAll();

export const types = {
  metricsRequest: root.lookupType(
    'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceRequest',
  ),
  metricsResponse: root.lookupType(
    'opentelemetry.proto.collector.metrics.v1.ExportMetricsServiceResponse',
  ),
  traceRequest: root.lookupType('opentelemetry.proto.collector.trace.v1.ExportTraceServiceRequest'),
  traceResponse: root.lookupType(
    'opentelemetry.proto.collector.trace.v1.ExportTraceServiceResponse',
  ),
  status: root.lookupType('google.rpc.Status'),
};

/**
 * Same shape the OTLP/JSON encoding produces: lowerCamelCase fields, 64-bit
 * integers as decimal strings, enums as numbers. Extraction code then handles
 * one shape for both encodings.
 */
const TO_OBJECT: protobuf.IConversionOptions = {
  longs: String,
  enums: Number,
  bytes: String,
  defaults: false,
  arrays: true,
};

export function decode(type: protobuf.Type, body: Uint8Array): unknown {
  return type.toObject(type.decode(body), TO_OBJECT);
}

export function encode(type: protobuf.Type, value: Record<string, unknown>): Buffer {
  return Buffer.from(type.encode(type.fromObject(value)).finish());
}
