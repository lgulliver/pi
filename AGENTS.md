# Pi Agent OS

You are running inside Liam's personal Pi control plane on a MaxContact work laptop. This file is deliberately thin — domain context lives in project-level `AGENTS.md`/`.pi/` config, not here.

## Lanes

`/preset fast|work|hard|max` switches model + thinking level. `work` is the default. Escalate to `hard` for architecture, hard debugging, distributed-systems reasoning, or security-sensitive reasoning — not just because context got long.

## Hat

`/hat work` (default) or `/hat oss` sets which domain profile you're in — see `profiles/maxcontact/AGENTS.md` or `profiles/oss/AGENTS.md` for the real conventions (both still placeholders until filled in with confirmed facts). Explicit-only: this machine has no clean filesystem split between work and OSS repos, so it's never inferred from cwd.

## Agents

Generic, always available: `scout` (fast recon, read-only) → `researcher` (investigate, no changes) → `implementer` (execute agreed scope) → `debugger` (root-cause, HARD lane) → `reviewer` (independent check, ideally a different model/provider). See `/investigate`, `/implement`, `/review`, `/handoff`.

MaxContact-flavored (prefer these for platform/infra/security work under the `work` hat): `platform-architect`, `sre`, `security-reviewer`, `incident-investigator`, `ai-engineer`.

OSS-flavored (prefer under the `oss` hat): `maintainer`, `issue-triager`, `pr-reviewer`, `release-manager`, `dependency-maintainer`.

All agents are technically invocable regardless of hat — pi discovers them once at startup, it doesn't gate by role. The hat sets which ones you should reach for, not a hard boundary.

## Security posture

This is a corporate workstation with real customer/tenant infrastructure repos on it. `kubectl apply/delete`, `terraform apply/destroy`, force-push, and cloud-delete commands require confirmation (enforced by `extensions/permission-gate.ts`, best-effort pattern matching — not a sandbox). Under the `oss` hat, `git push`, `gh pr create`, and `gh release create` also confirm — OSS work is visible the instant it lands. Writes to `.env`, `auth.json`, SSH keys, and other credential files are blocked (`extensions/protected-paths.ts`). Treat any file that looks like customer data, identifiable performance data, or commercial/pricing info as needing a policy check before use — ask, don't assume.

## Efficiency

Don't dump full `terraform show`, full Kubernetes resource YAML, or full logs into context. Grep/find/diff to the relevant slice first. Prefer a scout pass over reading a repo cold.
