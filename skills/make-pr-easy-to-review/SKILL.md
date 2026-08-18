---
description: Clean up a PR's commit history, write a proper description, and add reviewer guidance so the PR is fast to review rather than a wall of diffs.
when_to_use: Use when the user says "make this PR easier to review", "clean up the PR", "improve the PR description", "the commits are a mess", "tidy up before review", or "this PR is too big". Trigger even if the code is fine — presentation matters.
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(gh *)
---

# Make PR Easy to Review

## Current state

!`git branch --show-current`
!`git log main..HEAD --oneline`
!`git diff main..HEAD --stat`
!`gh pr view 2>/dev/null || echo "No PR open yet"`

## Assess

**Commit history problems to fix:**
- WIP/fixup commits ("wip", "fix", "more fixes", "stuff")
- Commits that partially implement then immediately fix
- Single giant commit for a multi-part change

**Description problems to fix:**
- Empty or branch-name-only description
- No What/Why/Testing sections
- No callouts for reviewers on tricky parts

**Structural issues to flag (don't fix without asking):**
- >400 lines / >10 files of real changes → suggest splitting
- Unrelated concerns mixed in → note for reviewer
- Large generated files in diff → add a note

## Clean commit history (if needed)

**Ask first** — this requires a force push:

> "Your commit history has [N fixup commits]. Want me to clean it up with an interactive rebase? This requires a force push."

If yes:
```bash
git rebase -i main
# Squash fixup commits into their logical parent
# Write clean conventional commit messages for each result
```

Target: 1 commit for simple changes, 2–4 for larger ones.

## Write the PR description

```bash
gh pr edit --body "## What
{one paragraph: what does this PR do?}

## Why
{one paragraph: why is this change needed?}

## How (optional)
{only if approach is non-obvious}

## Walkthrough for reviewer
{optional but valuable: 'start at X, the tricky part is Z'}

## Testing
{how was this tested? what should the reviewer try?}

## Notes / risks
{anything deserving extra scrutiny}

## Checklist
- [ ] Tests added / updated
- [ ] No debug code
- [ ] Docs updated if needed"
```

Don't fabricate information — ask the user to fill in sections you can't infer from the diff.

## Force push (if rebased)

```bash
git push --force-with-lease
```

## Report

```
PR REVIEW READINESS
PR: #{N} — {title}

Changes made:
  - Description: {written/improved}
  - Commits: {N squashed into N} / {unchanged}
  - Notes: {any structural flags}
```

**Never force push without explicit user confirmation.**
