---
description: Run Playwright smoke tests against a target environment, triage failures into product/test-infra/environment categories, and give a clear promote/don't-promote verdict.
when_to_use: Use when the user says "run smoke tests", "run the smoke suite", "are the smokes green", "smoke test this build", or "verify the deployment". Also trigger when validating a deployment before promotion.
disable-model-invocation: false
allowed-tools: Bash(npx *) Bash(node *) Bash(find *) Bash(cat *) Bash(ls *) Bash(export *)
---

# Run Smoke Tests

## Locate tests

!`find . -name "playwright.config.*" 2>/dev/null | head -3`
!`find . -name "*.spec.ts" | grep -i smoke | head -5`
!`cat playwright.config.ts 2>/dev/null | head -40`

If no smoke tests found: ask the user where they live before proceeding.

## Configure target

Ask if not provided — **never assume production**.

```bash
export BASE_URL="${BASE_URL:-http://localhost:3000}"
```

Note any auth requirements or feature flags needed.

## Run

```bash
npx playwright test --project=smoke --reporter=list --retries=1 2>&1
# or if no smoke project:
npx playwright test tests/smoke/ --reporter=list --retries=1 2>&1
# or by tag:
npx playwright test --grep @smoke --reporter=list --retries=1 2>&1
```

Capture stdout and generate HTML report:
```bash
npx playwright test --project=smoke --reporter=list,html --output=playwright-results/ 2>&1
```

## Triage failures

For each failure, categorise:

**A — Product failure** (the feature is actually broken)
- Test is correctly testing something and product broke it
- Screenshot/video shows wrong UI state or error response

**B — Test infrastructure** (the test is broken, not the product)
- Selector out of date, timing issue, missing test data fixture

**C — Environment issue** (neither test nor product is broken)
- Target URL not responding, auth config wrong, third-party dep down

```
TEST: {name}
FILE: {path:line}
CATEGORY: {Product / Test infra / Environment}
EVIDENCE: {screenshot, error message}
ROOT CAUSE: {one sentence}
ACTION: {who fixes what}
```

## Report

```
SMOKE TEST REPORT
Environment: {URL}
Duration: {Ns}

Results:
  Passed:  N
  Failed:  N
  Skipped: N
  Flaky:   N (passed on retry)

Overall: GREEN / RED / DEGRADED

FAILURES
--------
{per-failure blocks}

RECOMMENDATION
--------------
{Safe to promote} / {Promote with caution — N non-blocking issues} / {Do not promote — N product failures}
```

Full report: `playwright-results/index.html`

**Never run against production without explicit confirmation.**
**Don't retry more than once automatically** — flakiness beyond one retry is worth surfacing.
