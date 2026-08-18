---
description: Create a correctly named branch from main, implement the requested work, and open a pull request — the full new-feature workflow.
when_to_use: Use when the user says "new branch and PR", "create a branch and do X", "start a new piece of work", "branch off and implement X", or gives a task and implies it should become a PR. Always branch first if currently on main.
disable-model-invocation: true
allowed-tools: Bash(git *) Bash(gh *) Bash(npm *) Bash(npx *) Bash(go *) Bash(cargo *) Bash(find *) Bash(grep *) Bash(cat *) Bash(ls *)
---

# New Branch and PR

## Current state

!`git branch --show-current`
!`git status --short`

**Stop if on main/master with uncommitted changes** — ask the user how to handle them first.

## Sync and branch

```bash
git checkout main && git pull origin main
```

Name the branch by matching the project's existing pattern:

```bash
git branch -r | head -10  # detect naming convention
```

Common: `feature/{desc}`, `fix/{desc}`, `chore/{desc}`, `{initials}/{desc}`.
Rules: lowercase kebab-case, ≤50 chars, descriptive, no dates/temp/wip.

```bash
git checkout -b {branch-name}
```

Tell the user the branch name before implementing.

## Understand first

Before writing code, read the relevant existing files:

```bash
find . -type f -name "*.ts" -o -name "*.go" -o -name "*.py" | grep -v node_modules | head -20
```

Match the project's patterns — types, error handling, naming, test structure.

## Implement

- Types correct (no `any` escapes)
- Error paths handled
- No debug code
- Consistent with surrounding style

## Tests

Find the test pattern:

```bash
find . -name "*.test.ts" -o -name "*.spec.ts" -o -name "*_test.go" 2>/dev/null | head -5
```

Write tests that match the project's existing structure. Run them:

```bash
npm test 2>/dev/null || go test ./... 2>/dev/null || python -m pytest 2>/dev/null
```

Don't push with failing tests.

## Commit and push

```bash
git add -A
git commit -m "{type}({scope}): {description}"
git push -u origin HEAD
```

## Open PR

```bash
gh pr create \
  --title "{type}({scope}): {description}" \
  --body "## What
{what this implements}

## Why
{why it's needed}

## Testing
{what tests were added}

## Checklist
- [ ] Tests added
- [ ] Types correct
- [ ] No debug code"
```

## Done

```
Branch: {name}
PR:     {URL}
{N commits, N files changed}
```

**If scope grows significantly during implementation** — stop and check with the user before continuing.
