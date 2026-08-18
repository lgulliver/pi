---
description: Summarise your authored commits over a given time period into a concise, human-readable status update — useful for standups, async check-ins, or weekly reports.
when_to_use: Use when the user says "what did I get done", "what did I ship", "summarise my commits", "what have I done today", "what did I do this week", or "standup update from my commits".
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(date *)
---

# What Did I Get Done

## Setup

!`date`
!`git config user.name`
!`git config user.email`

## Fetch commits

Default window: **last 7 days** unless the user specified otherwise ("today" = since midnight, "this week" = since Monday).

```bash
git log \
  --author="$(git config user.name)" \
  --since="7 days ago" \
  --until="now" \
  --oneline \
  --no-merges \
  --all
```

For each commit, get files changed:

```bash
git show --stat --no-patch {sha}
```

Exclude commits from `lgulliver/*` personal repos — work output only.

## Group and synthesise

Group into themes (don't list raw commit messages — synthesise them):

- **Features shipped** — `feat:` commits, new files, new capabilities
- **Bugs fixed** — `fix:` commits, corrections
- **Tests** — test file changes
- **Refactoring / cleanup** — `refactor:`, `chore:`
- **Infrastructure / config** — CI, deps, tooling

Write natural-language summaries per group: "Added pagination to the search API" not five separate commit messages.

## Output

```
WHAT I GOT DONE
Period:  {Mon date – Fri date / today}
Commits: N

SHIPPED
-------
• {accomplishment} (N commits)
• {accomplishment} (N commits)

FIXED
-----
• {bug fix} (N commits)

OTHER
-----
• {chore/refactor} (N commits)

Full commit list:
  {sha} {message} ({date})
```

If zero commits: say so clearly.

**Standup format** (if requested):

```
This week:
- {bullet}
- {bullet}
```

Keep bullet points honest — don't make "fixed a typo" sound like "overhauled the auth system".
