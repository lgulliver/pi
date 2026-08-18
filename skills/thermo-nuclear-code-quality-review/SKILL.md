---
description: Exhaustive code quality audit covering correctness, security, error handling, performance, observability, testability, architecture, and maintainability. Every issue rated by severity with specific file:line, impact, and fix.
when_to_use: Use when the user says "thermo-nuclear review", "tear this apart", "full code review", "don't hold back", "review this like your life depends on it", "pre-mortem this code", or "review this before it goes into prod". This is NOT a polite PR review — it is a systematic exhaustive audit.
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(grep *) Bash(find *)
---

# Thermo-Nuclear Code Quality Review

## Code under review

!`git diff main...HEAD --stat`
!`git diff main...HEAD`

Read the full diff before making any comments. Understand the whole thing first.

## Severity scale

- **CRITICAL** — data loss, security breach, crash, or incorrect behaviour under reachable conditions. Block merge.
- **HIGH** — will likely cause problems under normal use. Fix before merge.
- **MEDIUM** — problems under edge cases or at scale. Fix before production or ticket it.
- **LOW** — code quality, maintainability, clarity.
- **NOTE** — observation, question, suggestion. No obligation.

## Review dimensions

Work through each systematically:

**Correctness**
Off-by-one, boundary conditions, null/undefined dereferences, integer overflow, type coercion surprises, race conditions, TOCTOU bugs, incorrect error propagation, unexpected mutation side effects, unvalidated assumptions about input.

**Security**
Injection (SQL, command, path traversal), auth/authz bypasses, sensitive data in logs/errors/responses, hardcoded secrets, weak crypto (MD5/SHA1 for security, predictable seed), SSRF, unvalidated redirects, missing rate limiting, deps with known CVEs.

**Error handling**
All error paths handled? Errors logged with enough context to diagnose in prod? Panics on unexpected input? Graceful degradation? Retries safe/idempotent?

**Performance**
O(n²) or worse on large inputs? N+1 queries? Unbounded memory growth (caches without eviction)? Blocking I/O in async context? Missing DB indexes? Will it degrade at 10×/100× load?

**Observability**
Sufficient context in error logs (request ID, user ID, resource)? Slow paths instrumented? Structured logs? SLI/SLO-relevant ops tracked?

**Testability and test quality**
Is the code testable as written? Do tests cover important behaviour or just happy path? Edge cases? Brittle tests (testing implementation details)?

**Architecture**
Separation of concerns? Correct abstraction level? Coupling that will hurt later? Consistent with the rest of the codebase?

**Maintainability**
Readable in 6 months without the author? Complex decisions explained (why, not what)? Dead code? Honest names (no `data`, `temp`, `helper`, `stuff`)? Duplication that should be extracted?

## Output

```
THERMO-NUCLEAR CODE REVIEW
Target: {files/PR}
Language: {detected}

CRITICAL
--------
[SECURITY] {file}:{line}
  Finding: {specific and concrete}
  Impact:  {what could go wrong}
  Fix:     {specific}

[CORRECTNESS] {file}:{line}
  ...

HIGH
----
[PERFORMANCE] {file}:{line}
  ...

MEDIUM
------
[ARCHITECTURE] {file}:{line}
  ...

LOW / NOTES
-----------
[LOW]  {file}:{line} — {observation}
[NOTE] {file}:{line} — {question or suggestion}

SUMMARY
-------
Critical: N  |  High: N  |  Medium: N  |  Low/Notes: N

Verdict: DO NOT MERGE / MERGE WITH FIXES / CLEAN

Top 3 to fix first:
  1. {most critical}
  2. {second}
  3. {third}
```

**Be specific** — "this is bad" is not a finding. "SQL injection via `name` parameter at line 47" is.
**Don't pad with LOW findings** to look thorough. Clean code gets a short review.
**Separate bugs from taste** — label style preferences clearly as NOTE, not findings.
