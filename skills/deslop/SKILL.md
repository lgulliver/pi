---
description: Remove AI-generated code patterns that erode human reviewer trust — unnecessary comments, defensive try/catch around safe operations, dead variables, redundant type casts, and style inconsistency with the surrounding codebase.
when_to_use: Use when the user says "deslop this", "clean up the AI crud", "this looks too AI-written", "remove the AI patterns", "tidy before review", or asks to make code look like a human wrote it. Trigger for any cleanup pass before a PR is raised.
disable-model-invocation: false
allowed-tools: Bash(git *)
---

# Deslop

## Get the diff

!`git diff main...HEAD --stat`
!`git diff main...HEAD`

Focus only on code introduced in this branch. Do not deslop pre-existing code.

## Patterns to remove

**Unnecessary comments** — restate what the code obviously does:
```
// Get the user by ID        ← remove: states the obvious
const user = getUser(id);

// Needed before permission check — getUser is lazy-loaded  ← keep: explains why
```

Remove: section headers in short functions, placeholders left unrealised, TODO without tracking.
Keep: comments explaining *why*, not *what*.

**Defensive try/catch around safe operations:**
```
// Remove: JSON.parse of a guaranteed-valid internal string with catch that only logs
// Keep: try/catch around external input, network calls, file I/O
```

Remove when: operation cannot realistically throw in context, catch only logs + returns null, wrapped code is pure computation.

**Dead variables and imports** — assigned but never read, imported but unused.

**Redundant type casts:**
- Value already typed as the cast target
- `as any` to bypass a type error → **flag, don't silently remove** — the underlying type issue needs fixing properly

**Unnecessary nesting** — pyramid of doom that could use early returns.

**Style inconsistency** — compare against files in the same module. Match semicolons, quotes, arrow vs function style. Don't impose a new style; match what's already there.

## Apply

Minimal, focused edits. **Behaviour must not change.** If removing something would change behaviour, flag it rather than remove.

Fix one concern at a time. If a bug is spotted: note it separately, don't fix inline.

## Summary

```
DESLOP SUMMARY
Removed: {N} unnecessary comments, {N} defensive try/catch, {N} dead variables, {N} redundant casts
Flagged: {N} items for author review
Behaviour change: None
```

List each flagged item with a one-line explanation.
**If the code is genuinely clean, say so** — don't invent slop to justify running the skill.
