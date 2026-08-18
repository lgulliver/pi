# Operating a live service

Depth behind RED/USE and day-2 operations. Read when the task is about running,
debugging or being on-call for a service rather than instrumenting it.

## RED & USE — two lenses

- **RED** (request-driven services): **R**ate, **E**rrors, **D**uration. The basis
  of overview dashboards and most SLOs. If you instrument only three things, these.
- **USE** (finite resources — pools, queues, CPU, memory): **U**tilisation,
  **S**aturation, **E**rrors.
- **RED is the symptom; USE is the cause.** "API p99 spiked" (RED) because "DB pool
  saturated" (USE). **Page on RED, diagnose with USE.** Resource saturation rarely
  warrants waking someone, but it's the first thing you look at once awake.
- For the AI Agent, extend RED with LLM outcome signals (token spend, finish reasons,
  tool-loop counts) — a call can be fast and error-free yet looping or hallucinating.

## You build it, you run it

The team that ships a service owns its pager. Operability is a feature, not someone
else's job. The people who know the code get paged; the pain of a bad alert or a
telemetry gap lands on them, so they fix it; SLOs, dashboards and runbooks are built
in, not bolted on. Platform provides Grafana, Alloy and IRM; teams run their services
on top.

## The daily / on-call loop

- Start at the service overview dashboard — RED at the top, USE below. Five seconds
  tells you if it's healthy.
- Check the SLO and error budget. Burning budget faster than planned is the
  early-warning before it pages.
- Scan deploy annotations for anything shipped recently that correlates with a wobble.

## The investigation loop (alert fired → root cause)

1. **Metric** — RED dashboard: which signal broke? Rate, errors, or latency? Which route?
2. **Exemplar** — jump from the p99 spike to an example trace in Tempo.
3. **Trace** — see where the time/error went across services; open the slow/failing span.
4. **Log** — same `trace_id` in Loki for the detailed error context.
5. **Profile** — USE signals / Pyroscope confirm the resource cause (saturated pool,
   GC pressure, a hot code path).

This is the single-pane payoff of consistent instrumentation: metric → trace → log →
profile, all linked, no tool-hopping.

## Incidents (Grafana IRM)

- Each team owns an on-call schedule and an escalation policy mapped to severity;
  alerts route to the team's rotation, not a shared firehose.
- **Declare early** — declaring is cheap, a missed SEV is expensive. It spins up the
  channel, roles and timeline automatically.
- Roles: Incident Commander (coordinates, owns comms) + tech lead (drives the fix);
  separate for SEV1.
- Ask **"what changed?"** first — read the deploy annotations.
- **Blameless postmortem** for every SEV1 (and SEV2 with customer impact) within five
  working days. Focus on systemic causes; output is a few tracked, owned actions. A
  postmortem that doesn't change a runbook or an alert probably missed something.
- IRM data is operational telemetry too: no customer PII or conversation content in
  channels, timelines or screenshots.

## Capacity & cost as routine ops

- Use USE utilisation trends for capacity planning — scale before saturation.
- Review the Cardinality Management and usage dashboards monthly; observability cost
  is an operational metric like any other.
- Re-tune sampling and Adaptive Metrics recommendations quarterly as traffic shifts.

## The rest of the toolkit

- **Synthetics** (Grafana Cloud Synthetic Monitoring): scripted k6 journeys for
  critical flows from multiple probes. A green health check on a broken login is worse
  than none.
- **RUM** (Grafana Faro): Core Web Vitals, JS errors, and frontend-to-backend trace
  propagation so a slow click becomes an API trace. Same rules: no PII, bounded
  attributes, sample by volume.
- **Profiling** (Pyroscope): continuous CPU/memory flame graphs, default-on for
  performance-critical services, with span-to-profile linking.
