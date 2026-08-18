---
description: Generate a structured weekly recap of the team's shipped work, categorised into net-new features, bugfixes, and tech-debt reduction.
when_to_use: Use when the user says "weekly review", "end of week recap", "what did we ship this week", "weekly engineering update", "week in review", or wants a summary of merged PRs and team output for reporting.
disable-model-invocation: false
allowed-tools: Bash(git *) Bash(gh *) Bash(date *)
---

# Weekly Review

## Week window

!`date`

Calculate Monday → today (or Monday → Friday if end of week). Format as YYYY-MM-DD.

## Fetch merged PRs

```bash
gh pr list --state merged --search "merged:>={YYYY-MM-DD}" --json number,title,author,mergedAt,labels,body --limit 50
```

For each PR note: title, number, author, labels (bug/feature/chore), change size.

## Fetch direct commits (unreviewed work)

```bash
git log --all --no-merges --since="{monday}" --until="{friday+1}" --oneline --format="%h %an %s"
```

Deduplicate against PRs already captured.

## Categorise

**Net-new** (`feat:`, `feature` label, new files/endpoints)
**Bugfixes** (`fix:`, `bug`/`hotfix` label)
**Tech debt** (`refactor:`, `chore:`, `test:`, `ci:`, `deps` label)

## Highlights

Pick 3–5 most significant items:
- Largest user-visible change
- Most impactful bugfix
- Most significant technical investment
- Anything the team should know before next week

## Output

```
WEEKLY ENGINEERING REVIEW
Week: Mon {date} – Fri {date}
PRs merged: N  |  Contributors: N

HIGHLIGHTS
----------
★ {highlight — 1-2 sentences}
★ {highlight}
★ {highlight}

NET-NEW (N items)
-----------------
• {PR title} (#{N}) — @{author}

BUGFIXES (N items)
------------------
• {PR title} (#{N}) — @{author}

TECH DEBT & MAINTENANCE (N items)
----------------------------------
• {PR title} (#{N}) — @{author}

METRICS
-------
PRs merged:   N
Contributors: {names}

NEXT WEEK WATCH
---------------
{notable open PRs close to merging — optional}
```

Designed to paste directly into a Slack channel or Confluence page.
**Only include merged work** — open PRs go in Next Week Watch, not shipped sections.
**If it was a quiet week, say so** — three honest highlights beat five padded ones.
