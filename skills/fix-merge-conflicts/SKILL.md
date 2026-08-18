---
description: Resolve git merge conflicts, validate the result, and explain every decision so the developer understands what was applied and why.
when_to_use: Use when the user says "fix merge conflicts", "resolve the conflicts", "I've got conflicts", "help me merge this", or pastes code containing git conflict markers. Also trigger when the user says "I merged main and now everything is broken".
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(tsc *) Bash(npx *) Bash(go *) Bash(cargo *) Bash(python *) Bash(npm *)
---

# Fix Merge Conflicts

## Locate conflicts

!`git diff --name-only --diff-filter=U 2>/dev/null || echo "No repo or check pasted code"`
!`git status --short 2>/dev/null`

For each conflicted file: note filename, number of conflict blocks, brief read of what both sides do.

## Understand each conflict

Read both sides of every conflict block:

- **HEAD** = current branch (what you have)
- **Incoming** = what's being merged in

Before resolving: are they compatible? Can both coexist? Is there a clear winner?

If context is ambiguous, read the surrounding file. If still ambiguous: **escalate** — ask the user rather than guess.

## Resolve strategy per block

| Strategy | When to use |
|----------|------------|
| **Keep HEAD** | Incoming is superseded or already handled |
| **Keep incoming** | HEAD is being replaced by a better implementation |
| **Merge both** | Both add independent things (new imports, new methods) |
| **Blend** | Logic must be combined (both modified same function differently) |
| **Escalate** | Genuinely ambiguous — require human decision |

For blended resolutions: write the merged version explicitly.

Remove all conflict markers (the HEAD delimiter, separator, and branch delimiter) from the resolved output.

## Validate

After resolving each file:

```bash
# Syntax check
npx tsc --noEmit 2>/dev/null || go build ./... 2>/dev/null || python -m py_compile {file} 2>/dev/null

# Run relevant tests
npm test 2>/dev/null || go test ./... 2>/dev/null
```

Check imports still valid. Check no references to variables that no longer exist.

## Explain every decision

```
CONFLICT {N} — {file} (line {N})
Strategy: {Keep HEAD / Keep incoming / Merge both / Blend}
Reason: {semantic reasoning — not "it looked newer"}
Result: {Applied / Tests pass}
```

For escalated conflicts: state exactly what information is needed from the developer.

## Summary

```
MERGE CONFLICT RESOLUTION SUMMARY
Files resolved:   N
Conflict blocks:  N total
  Auto-resolved:  N
  Escalated:      N

Validation:
  Syntax:  {clean / errors}
  Tests:   {N passing / N failing / not run}
  Imports: {clean / issues}

Next: {Ready to commit / Resolve escalated conflicts first / Fix failing tests}
```

**Never guess at intent** when context is ambiguous — escalate.
**Never silently drop code** from either side without explaining why.
