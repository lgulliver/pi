---
description: Investigate an unfamiliar system or bug without changing anything - scout finds context, researcher explains it
argument-hint: "<question>"
---
Use the subagent tool with the chain parameter:

1. Use the "scout" agent to locate all code relevant to: $@
2. Use the "researcher" agent to analyze the findings from the previous step (use {previous} placeholder) and answer: $@

Execute as a chain, passing output via {previous}. Do NOT implement anything - this is investigation only. End by telling me the researcher's recommended next action.
