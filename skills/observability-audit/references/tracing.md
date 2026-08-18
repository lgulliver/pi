# Tracing

Depth behind the tracing rules in SKILL.md.

## Rules

- **Propagate W3C Trace Context** (`traceparent`) across every boundary, including
  queues and event buses (carry context in message headers/metadata). A trace that
  dies at a queue is half a trace.
- **Auto-instrument** inbound/outbound HTTP, gRPC, DB and messaging. Add manual
  spans only for significant internal units of work (`transcribe_segment`,
  `dial_attempt`, `llm_completion`).
- **Span names are low-cardinality** operation names: `HTTP GET /campaigns/{id}`,
  `queue.publish calls.events`. IDs go in attributes, never span names.
- **Attributes**: follow OTel semantic conventions first; custom attributes use a
  company-specific prefix (`org.tenant_id`, `org.call_id`).
  High-cardinality values are fine on spans.
- **Status & errors**: set span status to `ERROR` and record the exception on
  failure — error rate by span comes from this.

## Sampling

- Head sampling at the SDK (start ~10% on high-volume paths, 100% in non-prod),
  plus tail sampling in the collector to always keep error and slow traces.
- Tune per service against Tempo ingest cost.

## Correlation payoff

- Enable **span metrics** and **service graphs** in Tempo for topology and rates
  derived from spans.
- Enable **exemplars** on latency histograms so a dashboard p99 spike links straight
  to an example trace. Requires `OTEL_METRICS_EXEMPLAR_FILTER=trace_based` and that
  tracing is sampling.
- Logs carry `trace_id`/`span_id`, so trace ↔ log pivots work both ways.

## AI Agent / LLM tracing

LLM features have failure modes golden signals miss (200-OK while looping or
hallucinating). Trace the whole agent loop, not just the model call:

- Parent span per agent turn; child spans for each model call, tool invocation,
  retrieval/RAG lookup and guardrail check.
- Use OTel **GenAI semantic conventions** (`gen_ai.system`, `gen_ai.request.model`,
  `gen_ai.usage.input_tokens`/`output_tokens`, finish reason).
- Add `org.prompt_version` / `org.agent_config_version` so behaviour
  changes correlate with prompt/config releases.
- **Never** put prompt or completion content in span attributes, logs or metrics —
  it is customer conversation data. Telemetry carries metadata (tokens, models,
  versions, outcomes); content lives only in the approved eval/audit pipeline.
