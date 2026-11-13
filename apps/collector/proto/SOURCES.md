# Vendored protobuf definitions

Pinned copies; never edited. `test/proto.test.ts` checks them against `SHA256SUMS`.

| Files                     | Source                                                                                              | License    |
| ------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| `opentelemetry/proto/**`  | open-telemetry/opentelemetry-proto, tag `v1.11.1` (commit 58232798eae2f0d08ea6682c6885299db08177da) | Apache-2.0 |
| `google/rpc/status.proto` | googleapis/googleapis, commit `97f6460c3558c1435d7fd001a9251f8df058ae2f`                            | Apache-2.0 |

Only the messages the collector decodes (metrics, traces) and the
`google.rpc.Status` error body are vendored. Logs are acknowledged without
being decoded.
