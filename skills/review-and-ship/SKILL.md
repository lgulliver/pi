---
description: Run a structured self-review of current changes, commit cleanly, and open a pull request — the full ship sequence in one command.
when_to_use: Use when the user says "review and ship", "ship this", "commit and PR", "open a PR", "get this up for review", or "I'm done, ship it". Always runs the review step even if not explicitly asked.
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *) Bash(npm *) Bash(npx *) Bash(go *) Bash(cargo *) Bash(python *) Bash(tsc *)
---

# Review and Ship

## Current state

!`git branch --show-current`
!`git diff main...HEAD --stat`
!`git status --short`
!`git log main..HEAD --oneline`

## Self-review

Check the diff before committing:

- **Debug code**: `console.log`, `print`, `debugger`, hardcoded values, commented-out blocks
- **AI slop**: unnecessary try/catch around safe ops, comments that restate what code does, dead vars
- **Tests**: new behaviour covered? any tests left broken/skipped?
- **Docs**: if a public interface changed, does the docstring reflect it?

Fix anything found. Minor: fix inline. Significant: surface to user before proceeding.

## Run checks

Detect and run the project's build + test commands:

```bash
# Check for scripts
cat package.json 2>/dev/null | python3 -c "import sys,json; s=json.load(sys.stdin).get('scripts',{}); [print(k,':',v) for k,v in s.items() if k in ['build','test','typecheck','type-check','check']]" 2>/dev/null
ls Makefile justfile 2>/dev/null
```

Run what's available. **Don't ship with failing checks.**

## Commit

```bash
git add -A
git commit -m "{type}({scope}): {description}"
```

Conventional commits: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`.
Subject: imperative mood, ≤72 chars, no trailing period.

**Never push to main/master.** Stop and tell the user to create a feature branch first.

## Push

```bash
git push -u origin HEAD
```

If rejected: `git pull --rebase origin {base-branch}` then push again.

## Open PR

```bash
gh pr create \
  --title "{title}" \
  --body "## What
{what this PR does}

## Why
{why it's needed}

## Testing
{how it was tested}

## Checklist
- [ ] Tests added / updated
- [ ] No debug code
- [ ] Docs updated if needed"
```

## Done

```
PR opened: {URL}
{N files changed, N insertions, N deletions}
```
