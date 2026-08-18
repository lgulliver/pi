# Dashboards

Depth behind the dashboard rules in SKILL.md.

## Principles

- A dashboard answers a question for an audience. Name both before building.
- Top-down: symptom first, cause below. RED at the top, dependencies and USE
  resources beneath. The eye lands on "is it broken?" before "why?".
- Built from the standard metrics, so one template works across every service —
  swap a `service` variable.
- **Dashboards in Git.** Grafana **Git Sync** went GA in 2026: author in the Grafana
  UI and have it saved straight to a GitHub/GitLab/Bitbucket repo with a PR workflow
  (bidirectional), or commit the dashboard JSON yourself. Terraform / file
  provisioning are still fine if preferred. Production dashboards are not hand-edited
  without going through Git.
- Fewer, better panels. If a panel hasn't been looked at in an incident in six
  months, cut it.

## Tiers

| Tier | Audience | Answers |
|---|---|---|
| Service overview (mandatory, one per service) | on-call, owner | is my service healthy, and where? |
| Deep-dive / resource | engineer debugging | why is it broken? |
| Product / business | leads, product | how is the product performing? |
| Fleet / platform | platform/SRE | how is the estate? |

Every service has the overview tier from the shared template. Others as need arises.

## Standard overview layout (top to bottom)

1. **Header** — SLO status / error budget, current error rate, current p99, deploy markers.
2. **RED row** — Rate (by route), Errors (rate and %), Duration (p50/p90/p99 from the histogram).
3. **Dependencies** — latency/error of downstream calls (DB, queues, services, LLM providers).
4. **Saturation (USE)** — the binding resources: pool utilisation, queue depth, memory, CPU.
5. **Links** — deep-dive dashboard, runbook, Tempo traces, Pyroscope profiles, Loki logs.

Put **exemplars** on the Duration panel — clicking a p99 spike to an example trace is
the single most useful link on the dashboard.

## Build rules

- **Template variables** for `environment`, `service`/`namespace`, `instance` — one
  dashboard serves all environments and instances, no per-env copies.
- **Library panels** for repeated panels (the RED row) so a fix propagates.
- **Units and thresholds** on every panel; red above the SLO threshold tells the
  story without reading axes.
- **Rates and percentiles**, never averages or raw counters.
- Keep default-panel queries cheap — avoid high-cardinality `group by`; heavy
  breakdowns go on the deep-dive tier behind a variable.
- **Deploy annotations** on every time-series so "what changed?" is visible inline.
- **Data links** from panels to traces/profiles/logs filtered by the same labels.

## Hygiene

- Don't rely on colour alone; use thresholds and labels (colour-blind safe).
- Every dashboard has a title, owner and short description linking the runbook.
- Sensible default time range per audience (overview ~6h, business ~30d).
- Prune regularly — an unowned, unviewed dashboard is misleading in an incident.

## Anti-patterns

The wall of 50 panels with no hierarchy; cause-only dashboards (all CPU, no RED);
per-environment copies instead of variables; hand-edited prod dashboards; averages
and raw counters; vanity panels never used in an incident.
