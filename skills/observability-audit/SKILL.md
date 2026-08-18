---
name: observability-audit
description: >-
  House observability and instrumentation standards for services shipping
  telemetry to Grafana Cloud (OpenTelemetry: metrics, logs, traces, profiles,
  RUM, SLOs, dashboards, alerting). Use this skill WHENEVER the user is
  instrumenting or operating a service's telemetry: adding or changing metrics,
  logs, traces or spans; wiring up OpenTelemetry (especially .NET); choosing
  metric or log labels or worried about cardinality / Grafana Cloud cost;
  deciding a log level or whether something contains PII; defining SLIs, SLOs or
  error budgets; building Grafana dashboards; writing or reviewing alerts; or
  reviewing a pull request for observability. Trigger even when the user does not
  say "observability" — e.g. "add a metric for X", "why is our Grafana bill so
  high", "what should this alert be", "is it ok to log this", "set an SLO for the
  payments API", "instrument this endpoint". Applies the house rules so telemetry
  is consistent, correlated, and cheap.
---

# Observability Standards

This skill encodes how we instrument and operate services. The goal
is simple: any engineer can open Grafana and answer "is my service healthy, and
if not, why?" without tribal knowledge — and we do it without drowning in
Grafana Cloud cardinality costs.

Apply these rules when writing or reviewing instrumentation. They are defaults,
not dogma: if you deviate, do it deliberately and say why.

## Core principles

- **Instrument for questions, not data.** Every metric, log field, and span should
  help answer a question someone will actually ask in an incident, a capacity
  review, or a product decision. Telemetry that answers nothing is pure cost.
- **OpenTelemetry first.** New instrumentation uses OTel SDKs and semantic
  conventions. No vendor SDKs or bespoke formats for new code.
- **Correlate by design.** Metrics, logs and traces must share identifying
  attributes (`service.name`, `trace_id`, environment) so you can pivot between
  them. This is what makes Grafana a single pane rather than three tools.
- **Cardinality is a budget.** Labels are a deliberate choice reviewed like a
  schema change. Grafana Cloud bills on active series; one bad label can dominate
  the bill and slow every query in the tenant.
- **Telemetry is part of Done.** A change isn't shipped until its golden signals
  are observable and alertable.

## The three signals — pick the right one

- **Metric** (Mimir): anything you would `count()` or `avg()` — rates, latency,
  saturation, business counters. The basis of alerting and SLOs.
- **Log** (Loki): a discrete event you would read line by line — an error with a
  stack trace, a state change, an audit event.
- **Trace** (Tempo): anything that crosses a service boundary — request flow,
  latency breakdown, dependency analysis.

If you reach for a log to count something, make it a metric. If you reach for a
metric to capture per-request detail, put it on a span or a log.

## Required resource attributes (the taxonomy)

Every telemetry-emitting process sets these. They are the backbone — dashboards,
alert routing and cost attribution all key off them. Because they are identical
across services, one dashboard template and one query work fleet-wide.

| Attribute | Convention | Example |
|---|---|---|
| `service.name` | kebab-case, globally unique, stable | `ccaas-dialler-api` |
| `service.namespace` | the product line | `ccaas` |
| `service.version` | semver or git SHA, set at build | `2.14.3` |
| `deployment.environment.name` | fixed enum, never free text | `dev`, `test`, `staging`, `prod` |

## When to read which reference

This file holds the high-frequency rules. For depth, read the reference for the
task at hand — don't load them all:

- **Adding/reviewing metrics, choosing labels, cardinality or cost questions** →
  `references/metrics-and-cardinality.md`
- **Logging, log levels, log levels per environment, PII/secrets in logs** →
  `references/logging-and-pii.md`
- **Tracing, spans, context propagation, sampling, exemplars** →
  `references/tracing.md`
- **Wiring up OpenTelemetry in .NET (ASP.NET Core, the reference Program.cs)** →
  `references/otel-dotnet.md`
- **SLIs, SLOs, error budgets, alerting and burn-rate** →
  `references/slos-and-alerting.md`
- **Building or reviewing Grafana dashboards** → `references/dashboards.md`
- **RED/USE, operating a live service, incidents, the investigation loop** →
  `references/operating.md`

## Non-negotiable rules (the ones that prevent the worst mistakes)

These are inline because they are the high-frequency, high-cost errors. The
references explain the why in full.

### Cardinality — the one test

Before adding any label (metric or Loki stream), ask: **can you enumerate every
possible value in a code comment?** If not, it is not a label.

- **Fine as labels** (bounded): `environment`, `route` (templated `/x/{id}`),
  `method`, `status_code`, `error_type`, domain enums like `queue`, `direction`,
  `model`, `provider`.
- **Never a label**: `call_id`, `session_id`, `trace_id`, user IDs, phone
  numbers, emails, raw URLs, full error message text, timestamps, IPs.
- **`tenant_id` / `customer_id`**: not a label by default — it grows with the
  business. Per-tenant metrics need platform sign-off on a small dedicated metric.
- High-cardinality detail belongs on a **span attribute** or a **log field**,
  never a metric label.

### No PII in logs — ever

Never log: call recordings or transcript content; personal data (names, phone
numbers, emails, addresses); secrets, tokens, passwords; full card numbers (PCI).
This is a UK GDPR / PCI compliance requirement, not a style preference. Log a
surrogate identifier (e.g. `customer_id`) and join to the record instead of
logging the data itself. Allow-list the fields you log rather than trying to strip
PII after the fact.

### Metric naming

Prometheus conventions: `snake_case`, base units always (`_seconds` not `_ms`,
`_bytes` not `_mb`), counters end `_total`. The metric name describes *what is
measured*, not who measures it — the service is identified by labels, never baked
into the name. Good: `calls_connected_total`. Bad: `diallerApiLatencyMs`.

### Golden signals on every service

Expose Traffic (rate), Errors (count by `status_code`/`error_type`), Latency
(duration **histogram** on every external interface) and Saturation (queue depth,
pool use). Use auto-instrumentation for HTTP/gRPC/DB; hand-write only the business
metrics.

### Structured, correlated logs

Structured JSON, one event per line. Stable `message`, variable data in fields
(`"campaign started"` + `campaign_id=123`, never `"campaign 123 started"`).
Always carry `trace_id`/`span_id` when in request context. Prod default level is
`INFO`; `DEBUG` is off in prod but runtime-toggleable. See the logging reference
for level-by-environment.

## Definition of Done — instrumentation checklist

Use this when finishing or reviewing a change. A service is not done until:

- [ ] OTel SDK + auto-instrumentation; OTLP export to the local Alloy/collector (not direct to cloud)
- [ ] Resource attributes set (`service.name`, `service.namespace`, `service.version`, environment)
- [ ] Golden-signal metrics exposed; histograms for every external interface
- [ ] All metric labels bounded and enumerated; no unbounded labels
- [ ] Structured JSON logs, trace-correlated, no PII/secrets
- [ ] Trace context propagated across all boundaries, including queues
- [ ] LLM features: GenAI spans, token/cost metrics; no prompt/completion content in telemetry
- [ ] SLO defined for user-facing capability, with burn-rate alerts and a runbook
- [ ] Dashboard from the shared template; dashboards in Git
- [ ] Every paging alert has a runbook, an owner and a severity
- [ ] Instrumentation reviewed in the PR (labels, log fields, span names) like any other interface

## How to use this skill in a review

When reviewing code or a PR, walk the diff against the checklist and the
non-negotiable rules. Flag concretely: name the metric/label/log line, say which
rule it breaks and why it matters, and give the fix. Praise good instrumentation
too — the goal is to make the standard the path of least resistance, not to nag.
