---
description: Find failing CI jobs on the current PR or branch, fetch and read the actual logs, diagnose the root cause, and apply focused fixes without touching unrelated code.
when_to_use: Use when the user says "fix CI", "CI is broken", "the checks are failing", "fix the pipeline", "sort out the CI failures", "what's failing in CI", or pastes a failing CI run URL. Always fetch the actual logs before diagnosing — never diagnose from the summary line alone.
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(gh *) Bash(npm *) Bash(npx *) Bash(go *) Bash(cargo *) Bash(python *) Bash(ruff *) Bash(gofmt *) Bash(tsc *)
---

# Fix CI

## Current branch

!`git branch --show-current`

## CI status

Fetch failing jobs with `gh run list --branch $(git branch --show-current) --limit 5` then `gh run view {run-id} --log-failed` for each failing job.

Get the full log — the summary line shows the symptom, not the cause. Find the first error.

## Diagnose

Map the failure:

| Type | Examples | Fix |
|------|----------|-----|
| Compile/type error | tsc error, go build error | Fix the type or syntax |
| Test failure | assertion error, wrong value | Fix the code under test (preferred) or the test if it's wrong |
| Lint/format | ESLint, Prettier, golangci-lint, ruff | Run auto-fixer then fix remainders |
| Missing dep | module not found, go mod tidy needed | Add the dep or run tidy |
| Env/secret missing | missing env var, 401 on CI | Cannot fix in code — report what's missing and stop |
| Workflow YAML error | invalid key, wrong action version | Fix the YAML |

## Fix

Minimal change to resolve the root cause only. Don't touch unrelated code.

Validate before pushing where possible:
- TypeScript: `npx tsc --noEmit`
- Go: `go build ./...`
- Lint: `npx eslint .` / `ruff check .`

Never suppress with `// @ts-ignore`, `as any`, or `catch (e) {}` without handling.
Never delete a failing test to make CI pass.

## Explain

For each change:

```
FIX: {filename}
FAILURE: {what was failing and why}
CHANGE: {what was changed}
REASONING: {why this resolves it}
```

## Commit and push

```bash
git add {changed files}
git commit -m "fix(ci): {description}"
git push
```

## Summary

```
FIX-CI SUMMARY
Branch: {name}
Jobs fixed: N
Changes:
  1. {file} — {what}
Next: watch CI rerun or use /loop-on-ci to iterate automatically
```

**Stop and escalate** if the failure is in an env var or secret — a code change won't fix it.
