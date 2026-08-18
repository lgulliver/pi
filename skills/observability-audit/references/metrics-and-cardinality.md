# Metrics & cardinality

Depth behind the metric and labelling rules in SKILL.md.

## Naming

- Prometheus conventions: `snake_case`, structured `<domain>_<noun>_<unit>[_total]`.
- Base units always: `_seconds` not `_milliseconds`, `_bytes` not `_megabytes`.
- Counters end in `_total`. Gauges describe current state (`_current`, `_active`).
  Histograms take the unit suffix (`_seconds`, `_bytes`).
- The name says *what is measured*, not who measures it. The service is in labels,
  never the name.

```
Good:  calls_connected_total{queue="sales", direction="outbound"}
Good:  http_server_request_duration_seconds_bucket{route="/api/v2/campaigns", method="POST"}
Bad:   salesQueueOutboundConnectedCalls   (camelCase, labels baked into name)
Bad:   request_latency_ms                 (non-base unit)
```

## Metric types

- **Counter** — monotonic; always query with `rate()`/`increase()`.
- **Gauge** — point-in-time (active calls, queue depth, pool usage).
- **Histogram** — durations and sizes. Prefer OTel exponential/native histograms
  over fixed buckets; if fixed, ≤ 12 buckets aligned to SLO thresholds.
- Avoid summaries — they can't be aggregated across instances.

## Golden signals (every service)

- **Traffic** — request/message/call rate per route or operation.
- **Errors** — count with `status_code` or `error_type` label.
- **Latency** — duration histogram for every external interface (HTTP, gRPC, queue consume).
- **Saturation** — queue depth, pool utilisation, concurrency limits.

Auto-instrument HTTP/gRPC/DB; hand-write only business metrics (calls connected,
agent state transitions, jobs processed).

## Cardinality — why it bites

A label is an index dimension. Grafana Cloud stores a separate series for every
unique combination of label values, and bills on active series. Cardinality is
multiplicative: `route`(20) × `method`(4) × `status_code`(6) = 480 series. Add one
unbounded label like `call_id` on a metric seeing 50,000 calls/day and you create
50,000 new series a day, forever — which can dwarf the service's entire legitimate
metric volume and slow every query in the tenant.

### The test (apply to every label)

1. **Bounded?** Can you enumerate every possible value in a comment?
2. **Queried?** Will you actually group or filter by it?
3. **Low-churn?** Does the value stay stable, not change every event?

A "no" to any means it is not a label.

### Never a metric label

`call_id`, `session_id`, `trace_id`, request IDs, `tenant_id`/`customer_id` (by
default), phone numbers, emails, user names, raw URLs/paths with IDs (use
templated routes `/campaigns/{id}`), full error message text (use `error_type`),
timestamps, IP addresses.

### Where high-cardinality detail goes instead

- Per-request identifiers → **span attributes** (Tempo handles them cheaply).
- Searchable detail → **log fields** (Loki body / structured metadata).
- Per-tenant views → a small dedicated metric **with platform sign-off**, or the
  analytics pipeline — never on golden-signal metrics.

## Controls

- Check the Grafana Cloud Cardinality Management / usage dashboards monthly; top
  series producers are almost always a bad label.
- Use **Adaptive Metrics** to aggregate away unused label dimensions.
- Drop unused metrics at the collector/Alloy stage (`metric_relabel_configs` / OTel
  filter processor) rather than paying to store them.

## Metric lifecycle (renaming / deprecation)

Metrics are an interface — dashboards, alerts and SLOs depend on them. Treat a
rename like a breaking API change:

- Dual-emit old and new names for at least one release cycle (≥ 30 days in prod).
- Find consumers first (grep dashboards-as-code, alert rules, SLOs, recording rules).
- Announce the deprecation and cutover date; tag the old metric `DEPRECATED: use <new>`.
- After cutover, remove the old emission and add a temporary collector drop rule.
- The same applies to renaming or removing a **label** — it breaks queries just as hard.

## Labelling consistency

Use the same label *names* across services (`route` everywhere, not `path` here and
`endpoint` there) so one dashboard template and one query work fleet-wide. Keep
keys `snake_case`. Adding a new Loki stream label is a tenant-wide cost decision —
get platform sign-off.
