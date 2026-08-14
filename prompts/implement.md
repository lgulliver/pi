---
description: Scout finds context, implementer makes the change
argument-hint: "<task>"
---
Use the subagent tool with the chain parameter:

1. Use the "scout" agent to find all code relevant to: $@
2. Use the "implementer" agent to implement "$@" using the context from the previous step (use {previous} placeholder)

Execute as a chain, passing output via {previous}. If the scope is ambiguous, ask me before the implementer step rather than guessing.
