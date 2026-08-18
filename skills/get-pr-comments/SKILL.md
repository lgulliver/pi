---
description: Fetch all review comments from the active pull request and produce a structured, prioritised action list.
when_to_use: Use when the user says "get PR comments", "what did the reviewer say", "fetch the review feedback", "what do I need to address", "show me the review", or "what's blocking the PR".
disable-model-invocation: false
allowed-tools: Bash(gh *)
---

# Get PR Comments

## Fetch review data

!`gh pr view --json number,title,state,reviewDecision,reviews,comments 2>/dev/null`
!`gh pr review list 2>/dev/null`

Get all inline comments:

```bash
gh api repos/{owner}/{repo}/pulls/{pr-number}/comments --jq '.[] | {path, line: .original_line, body, user: .user.login, resolved: .resolved}'
```

Get the repo and PR number from the context:
```bash
gh pr view --json number,headRepository
```

## Categorise each comment

| Category | Criteria | Priority |
|----------|----------|----------|
| **Blocking** | "changes requested" decision, "must fix", "this will crash/break", explicit required change | High |
| **Suggestion** | "consider", "maybe", "nit", "could" — optional | Medium |
| **Question** | reviewer wants to understand something | Medium |
| **Praise** | "nice", "good call", "LGTM" | None |
| **Resolved** | thread already marked resolved | Skip |

Infer category from text when not explicit — "this will crash if null" is Blocking even without the label.

## Output

```
PR REVIEW ACTION LIST
PR: #{number} — {title}
Reviewer(s): {names}
Decision: {Approved / Changes Requested / Commented}

BLOCKING
--------
[ ] {file}:{line} — {reviewer} — {summary}
    Action: {what to do}

SUGGESTIONS
-----------
[ ] {file}:{line} — {reviewer} — {summary}
    Options: address / reply explaining why not / resolve as-is

QUESTIONS
---------
[ ] {location} — {reviewer} — {question}
    Suggested reply: {if inferable}

SUMMARY
-------
Blocking: N  ← must clear to merge
Suggestions: N
Questions: N
Resolved: N
```

## Offer to address

After the list: offer to work through blocking items file by file.

**Don't auto-resolve threads** without making the change first.
**Don't apply a suggested fix that's worse** — flag it and counter-propose.
