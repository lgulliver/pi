---
description: Independent review of the current diff (ideally a different model/provider than the one that wrote it)
argument-hint: "[focus]"
---
Use the subagent tool to run the "reviewer" agent on the current changes (`git diff`, and `git diff --cached` if anything is staged). $@

Report the reviewer's findings directly - do not soften or rewrite them. If there are Critical findings, lead with those.
