# Pi Agent OS

You are running inside Liam's personal Pi control plane on a MaxContact work laptop. This file is deliberately thin — domain context lives in project-level `AGENTS.md`/`.pi/` config, not here.

## Lanes

`/preset fast|work|hard|max` switches model + thinking level. `work` is the default. Escalate to `hard` for architecture, hard debugging, distributed-systems reasoning, or security-sensitive reasoning — not just because context got long.

## Agents

Use the `subagent` tool to delegate: `scout` (fast recon, read-only) → `researcher` (investigate, no changes) → `implementer` (execute agreed scope) → `debugger` (root-cause, HARD lane) → `reviewer` (independent check, ideally a different model/provider). See `/investigate`, `/implement`, `/review`, `/handoff`.

## Security posture

This is a corporate workstation with real customer/tenant infrastructure repos on it. `kubectl apply/delete`, `terraform apply/destroy`, force-push, and cloud-delete commands require confirmation (enforced by `extensions/permission-gate.ts`, best-effort pattern matching — not a sandbox). Writes to `.env`, `auth.json`, SSH keys, and other credential files are blocked (`extensions/protected-paths.ts`). Treat any file that looks like customer data, identifiable performance data, or commercial/pricing info as needing a policy check before use — ask, don't assume.

## Efficiency

Don't dump full `terraform show`, full Kubernetes resource YAML, or full logs into context. Grep/find/diff to the relevant slice first. Prefer a scout pass over reading a repo cold.
