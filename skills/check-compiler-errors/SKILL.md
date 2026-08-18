---
description: Run the project's compile and type-check commands, collect all errors, group by root cause, and report clearly so they can be fixed efficiently.
when_to_use: Use when the user says "check compiler errors", "run the type checker", "does this compile", "check for type errors", "check tsc", or "see if anything's broken before I push". Also trigger proactively after touching interfaces, types, or shared utilities.
disable-model-invocation: false
allowed-tools: Bash(npx *) Bash(tsc *) Bash(go *) Bash(cargo *) Bash(mypy *) Bash(pyright *) Bash(dotnet *) Bash(cat *) Bash(ls *)
---

# Check Compiler Errors

## Detect project type

!`ls package.json tsconfig.json go.mod Cargo.toml pyproject.toml setup.py 2>/dev/null`
!`cat package.json 2>/dev/null | python3 -c "import sys,json; s=json.load(sys.stdin).get('scripts',{}); [print(k) for k in s if 'type' in k or 'check' in k or 'build' in k]" 2>/dev/null || true`

## Run type check

Based on detected project type:

```bash
# TypeScript — prefer project script if it exists
npx tsc --noEmit 2>&1

# Go
go vet ./... 2>&1

# Rust
cargo check 2>&1

# Python (typed)
mypy . 2>&1
```

Capture full output including file, line, column, error code, message.

## Run build

```bash
npm run build 2>&1
# or: go build ./... / cargo build / dotnet build
```

## Group errors by root cause

**Cascade detection**: one broken type or missing export often causes dozens of downstream errors. Identify root errors vs cascade errors.

Group by:
1. **Root errors** — the broken declaration itself
2. **Cascade errors** — downstream usages that fail because of the root (auto-fix when root fixed)
3. **Independent errors** — unrelated issues needing separate fixes

## Report

```
COMPILER ERROR REPORT
Project:     {language/framework}
Command:     {exact command}

Results:
  Total errors:   N
  Root causes:    N  ← fix these to clear everything
  Cascade errors: N  ← auto-clear

ROOT ERRORS (fix in order)
--------------------------
[1] {file}:{line}:{col} — {error code}
    {error message}
    Cascades: ~N
    Fix: {brief}

INDEPENDENT ERRORS
------------------
[N] {file}:{line}:{col} — {error code}
    {error message}
    Fix: {brief}

VERDICT: {0 errors — clean} / {N errors to fix}
```

**Never suppress** with `@ts-ignore`, `@ts-nocheck`, or `// nolint` — fix the type.
**Never cast to `any`** to resolve a type error.
**If zero errors**: confirm clearly — "Type check: 0 errors. Clean."
