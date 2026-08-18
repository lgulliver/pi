# Logging & PII

Depth behind the logging rules in SKILL.md. Language- and framework-agnostic.

## Principles

- A log is an event with context, written for the on-call engineer at 3am who has
  no idea what your code does.
- Structured, always — machine-parseable key/value events, never free-form prose.
- Logs are for discrete events you read line by line. Aggregates are metrics;
  cross-service flow is traces.
- Cheap to write, expensive to store and to read. Log what earns its place.
- Safe by default: assume every log will be read by someone who should not see
  customer data.

## Structured format

- One structured event per line (JSON is the default wire format).
- Stable `message`, variable data in fields: `"campaign started"` + `campaign_id=123`,
  never `"campaign 123 started"`.
- Consistent field names across services (`campaign_id` everywhere).
- Use the framework's structured API, not string interpolation.

### Required fields

`timestamp` (ISO 8601, UTC), `level`, `message`, `service.name`,
`deployment.environment.name`, and `trace_id` + `span_id` when in request context.

### A good line

```json
{
  "timestamp": "2026-06-18T09:14:22.481Z",
  "level": "INFO",
  "message": "campaign started",
  "service.name": "ccaas-dialler-api",
  "deployment.environment.name": "prod",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "campaign_id": 12345
}
```

Bad: `"Campaign 12345 started for jane@acme.com in 412ms"` — interpolated,
unparseable, leaks PII, and stuffs a metric (duration) into a log.

## Levels

| Level | Use when… | Prod volume |
|---|---|---|
| `ERROR` | Operation failed, a human must look. Correlates with an error metric. | Near zero — every ERROR is signal |
| `WARN` | Survived but degraded — fallback taken, retry succeeded, nearing a limit. | Low; recurring WARNs become tickets |
| `INFO` | Significant state change or business event — not per request. | Moderate |
| `DEBUG`/`TRACE` | Diagnostic detail for development. | Off in prod; runtime-toggleable |

Pick the level by what the reader should *do*, not by how you feel about the event.
No per-request access logs at INFO — request rate/latency are RED metrics and traces.

## Levels by environment — and why

The minimum level a service emits should change per environment. Verbosity should
track how much you need to see versus what it costs and how sensitive it is.

The four environments are `dev`, `test`, `staging`, `prod`.

| Environment | Default level | Why |
|---|---|---|
| `dev` | `DEBUG` (`TRACE` when bug-hunting) | No cost or privacy concern. Max visibility shortens the inner loop. |
| `test` | `DEBUG` | Automated/integration tests; you want full detail when they fail. |
| `staging` | `INFO` | Mirrors prod for soak/perf tests so volume matches. Raise to `DEBUG` briefly to verify a release. |
| `prod` | `INFO` | Volume and the Loki bill are real. `DEBUG` buries the signal in an incident and risks leaking data. |

**Why not DEBUG everywhere:** cost (DEBUG can be 10–100× INFO volume), signal-to-noise
during incidents, and privacy (DEBUG dumps payloads where PII leaks).

**The escape hatch:** make the level runtime-configurable (e.g. ASP.NET Core
`IOptionsMonitor` reloading `appsettings`, or an env var / config flag) so you can
raise verbosity in prod without a redeploy. Scope it to one namespace, treat it like
a feature flag, and turn it off again. WARN/ERROR are environment-independent — only
the verbosity floor (DEBUG vs INFO) moves.

## No PII — non-negotiable

Never log: call recordings or transcript content; personal data (names, phone
numbers, emails, addresses, DOB); secrets, tokens, API keys, passwords; full
payment card numbers (PCI); any special-category data. Compliance requirement
(UK GDPR / PCI-DSS), not a style preference.

How to stay safe:

- **Log identifiers, not contents.** A `customer_id` joins to the record without
  putting the data in the log.
- **Allow-list, don't deny-list.** Log only the fields you've decided are safe.
- **Redaction is a backstop**, applied at the SDK and the Alloy/collector stage —
  not the primary control. The primary control is not logging it at all.
- **Watch the silent leaks:** whole-object/exception dumps, request/response
  bodies, URLs with PII in the query string, and DEBUG payload logging.
- If you find PII in logs, treat it as a data incident: raise it, get it purged,
  fix the source. Loki retention means it persists until it ages out.

## Loki: labels vs body

Loki indexes labels, not content. Keep stream labels tiny and bounded
(`service_name`, `environment`, `level`, `namespace`). Everything else —
`trace_id`, `customer_id`, `campaign_id` — goes in the body (or structured
metadata) and is queried with LogQL. Never label with `trace_id`, request IDs,
user/tenant IDs, or pod names.

## What to log / what not to

Log: errors and exceptions (type + stack), state changes and business events,
decisions with consequence (which provider/route chosen, fallback taken), external
dependency failures and retries, security events (authn/authz failures, without the
credentials).

Don't log: expected control flow (a validation 400 is a metric), per-request access
logs, "entering method X" noise, anything you'll aggregate (counts/rates/durations →
metrics), secrets/PII/transcript content.

Test: *would a future engineer act on this line, or is it just chatter?*

## Operational hygiene

- Logging is best-effort: async/non-blocking where possible; a logging failure must
  never crash the request path.
- Rate-limit or sample noisy events so one bug doesn't generate a Loki bill spike.
- Set the level by config, never hard-coded.
- Time is UTC, format is ISO 8601, everywhere.
