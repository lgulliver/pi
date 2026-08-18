---
description: Watch CI runs on the current branch and autonomously iterate on failures until all checks pass — fetching logs, diagnosing, fixing, pushing, and re-watching.
when_to_use: Use when the user says "loop on CI", "fix CI until it passes", "keep going until green", "just make it pass", or "CI is red, sort it out". Stops at 5 iterations by default or when escalation is required.
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(gh *) Bash(npm *) Bash(npx *) Bash(go *) Bash(cargo *) Bash(python *) Bash(tsc *)
---

# Loop on CI

## Setup

!`git branch --show-current`
!`git remote -v`

Max iterations: **5**. Stop and report if exceeded.

## Loop

Repeat until all checks pass or a stop condition is hit:

### 1. Get CI status

```bash
gh run list --branch $(git branch --show-current) --limit 3
```

If still in progress, wait and poll. If already green, stop — nothing to do.

### 2. Fetch failure logs

```bash
gh run view {run-id} --log-failed
```

Find the first error (root cause, not downstream noise). Group failures sharing the same root cause.

### 3. Categorise and fix

| Category | Fix strategy |
|----------|-------------|
| Test failure | Fix the code under test — never delete/skip the test |
| Compile/type error | Fix the type; never use `@ts-ignore` or `as any` |
| Lint/format | Run auto-fixer (`npx eslint --fix`, `gofmt -w`, `ruff check --fix`) |
| Missing dep | `npm install` / `go get` / `pip install` |
| Env/config missing | **Escalate** — cannot fix in code |
| Flaky/infra | Retry once; escalate if it recurs |

Minimal change, one logical fix per iteration.

### 4. Commit and push

```bash
git add -A
git commit -m "fix: {one-line description of what was fixed}"
git push
```

Commit message describes what was fixed, not "fix CI".

### 5. Check iteration count

- **Continue** if still failing and iterations < 5
- **Stop** if: all green ✅, max iterations hit, escalation required, or same failure recurs after two different fix attempts

**Never push to a protected branch (main/master).** Never delete failing tests. Never add `continue-on-error: true` to CI config.

## End summary

```
LOOP-ON-CI SUMMARY
Branch:       {name}
Iterations:   N / 5
Final status: {green/red/escalated}

Fixes applied:
  1. {sha} — {what}

Remaining failures: {none / list}
Action required: {none / escalation notes}
```
