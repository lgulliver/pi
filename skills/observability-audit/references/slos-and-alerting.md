# SLIs, SLOs, error budgets & alerting

Depth behind the reliability rules in SKILL.md.

## Vocabulary

- **SLI** (Indicator): a measured ratio of good events to valid events. 0–100%.
- **SLO** (Objective): a target for the SLI over a window. The line you commit to.
- **Error budget**: 100% − SLO. The failure you're allowed before you breach.
- **SLA**: the contractual promise to a customer. Internal SLOs sit *inside* the SLA.

## Pick the right SLI

Measure what the user experiences, not what's easy to graph. CPU is not an SLI;
"did the request succeed, quickly?" is.

| SLI type | good ÷ valid | Use for |
|---|---|---|
| Availability | non-5xx ÷ all valid responses | every request-driven service |
| Latency | requests under threshold ÷ all valid | anything users wait on |
| Quality | requests without degradation ÷ all valid | services with fallback modes (AI Agent) |
| Freshness | data within N min of source ÷ all reads | pipelines, Conversation Analytics |
| Coverage | records processed ÷ records received | batch/stream, transcription |

Rules: measure close to the user; define "valid" carefully (exclude client 4xx, but
don't exclude your way to green); latency SLIs are a **ratio on the histogram**, not
an average; one SLI per distinct user expectation.

Worked example: `call-setups under 2s ÷ all valid call-setups = 99.0%`.

## Set the target

- Start from observed performance, not aspiration. 100% is a lie that removes your budget.
- Pick the lowest target users accept — each extra nine is ~10× the effort.
- Default window: 28-day rolling. Calendar-month only when an SLA forces it.
- Differentiate by criticality — the dialler earns a tighter target than an admin tool.

Error budget per 28-day window: 99% = 6h43m · 99.5% = 3h22m · 99.9% = 40m · 99.95% = 20m.

## Implement in Grafana Cloud SLO

Define SLOs as code (Terraform / SLO API) where possible, built on the standard
golden-signal metrics so the same SLI query shape works across services. Grafana
Cloud SLO auto-generates the recording rules, burn-rate alerts and an SLO dashboard —
don't hand-roll them. Each SLO records an owner team and links runbook + dashboard.

Reference availability SLI (28-day ratio):

```
sum(rate(http_server_request_duration_seconds_count{job="ccaas-dialler-api", status_code!~"5.."}[28d]))
/
sum(rate(http_server_request_duration_seconds_count{job="ccaas-dialler-api"}[28d]))
```

## Use the error budget

- **Healthy:** ship. Spend it on velocity, risky changes, experiments. An untouched
  budget means you're over-investing in reliability.
- **Exhausted:** reliability work takes priority over features until it recovers —
  agreed in advance, not argued during an incident.
- Review monthly alongside the ops review.

## Minimum alerting (every production service)

- Availability / error-rate (SLO budget burn)
- Latency (p99 over SLO threshold)
- Traffic-absence (rate hits zero when traffic is expected — catches silent death)
- Saturation (the binding resource fills)
- Synthetic-check (critical journey fails from multiple probes)

Revenue-path services add a business-outcome alert (e.g. call-setup success rate).

## Burn-rate alerting

Don't page on a momentary dip; page when you're consuming budget fast enough to
breach. Multi-window: a fast and a slow window must both fire (kills flapping).

| Burn rate | Budget consumed | Windows | Severity |
|---|---|---|---|
| 14.4× | 2% in 1h | 1h & 5m | P1 page |
| 6× | 5% in 6h | 6h & 30m | P2 page (hours) |
| 1× | 10% in ~3 days | 3d & 6h | P3 ticket |

## What a good alert is

Urgent (needs action now), actionable (a human can do something), symptom-based
(user impact, not a cause like CPU), owned and routed (reaches the right team with a
runbook), trustworthy (rare enough to be believed). Every paging alert has a runbook,
an owner and a severity, or it can only ticket.

## What a bad alert is (anti-patterns → fix)

- Pages on CPU/memory → page on user impact (RED / SLO burn).
- No runbook → add one, or downgrade to a ticket.
- Fires on a momentary dip → multi-window burn-rate.
- Nothing to do until morning → P3 ticket, not a page.
- Lands in a shared firehose → route to the owning team.

Alert fatigue is a safety issue: the alert people learn to ignore is the one that
mattered.

## Severity & routing

| Severity | Meaning | Response |
|---|---|---|
| SEV / P1 | user-facing outage or fast SLO burn | page on-call 24×7 |
| P2 | degraded / slow burn, impact likely | page in hours, ticket out of hours |
| P3 | warning / approaching threshold | ticket, never pages |
