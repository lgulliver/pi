# Pi Agent OS

Liam's personal Pi ([pi.dev](https://pi.dev), `@earendil-works/pi-coding-agent`) control-plane config for a MaxContact work laptop. Covers two contexts only — MaxContact/work and Open Source — deliberately nothing else.

This file describes what's actually built and verified, not the original spec. Where the two differ, this file is correct.

## Architecture

```
~/repos/pi/                  <- this repo, git-tracked, the source of truth
  settings.json               global settings (model defaults, resource paths)
  presets.json                fast/work/hard/max/review lane definitions
  AGENTS.md                   thin global instructions
  agents/                     15 subagent definitions (.md, YAML frontmatter)
  extensions/                 TypeScript extensions (see below)
  prompts/                    /investigate /implement /review /handoff
  profiles/{maxcontact,oss}/  role-specific AGENTS.md + skills (placeholders)

~/.pi/agent/                  <- pi's real config dir; everything above is
  settings.json -> repo         symlinked in from the repo except:
  AGENTS.md -> repo
  agents/ -> repo
  extensions/ -> repo
  prompts/ -> repo
  presets.json -> repo
  profiles/ -> repo
  auth.json                   NOT in the repo. Credentials only. Never git-tracked.
  sessions/                   session history. Not tracked.
  models-store.json           pi's own model-catalog cache. Not tracked.
```

Symlinked, not copied, so editing the repo takes effect immediately (extensions hot-reload with `/reload`; settings/presets/agents/prompts are re-read at the relevant point — model presets on next `/preset`, agents on next subagent dispatch).

## Starting pi

```bash
cd ~/repos/pi   # or any project directory
pi
```

Global config loads regardless of cwd. Project-specific config layers on top automatically if the project has a `.pi/` directory (see "Adding a project" below).

## Compute lanes — `/preset <name>`

Four pools authenticated on this machine, verified via `pi --list-models`: `openai-codex` (ChatGPT Plus/Pro), `anthropic` (Claude, via a `claude setup-token` subscription token — the Team-plan browser OAuth flow doesn't work, this does), `opencode-go` (bundled multi-model plan), `github-copilot` (MaxContact seat — available via `/model`, not wired into a preset yet, no evidence yet on where it beats the other three).

| Lane | Provider/model | Thinking | Use for |
|---|---|---|---|
| `fast` | `opencode-go/deepseek-v4-flash` | low | recon, search, summaries, mechanical work |
| `work` (default) | `openai-codex/gpt-5.5` | medium | normal engineering, implementation, everyday debugging |
| `hard` | `openai-codex/gpt-5.6-terra` | high | architecture, hard debugging, distributed-systems/security-sensitive reasoning |
| `max` | `openai-codex/gpt-5.6-terra` | xhigh | explicit-invoke only, never a default |
| `review` | `anthropic/claude-sonnet-5` | high | independent second opinion — different model family on purpose |

`/preset work` returns to baseline. Escalate to `hard` on evidence (repeated unexplained failure, conflicting evidence, ambiguous root cause, multiple subsystems, security-sensitive reasoning, high cost of a wrong answer) — not just because a task feels big or context got long.

**Known flake:** `opencode-go/deepseek-v4-flash` occasionally (~1 in 6 calls, observed) returns `RegionError: ... only available hosted in China and requires explicit opt in`, then succeeds normally on retry seconds later with no config change. Looks like intermittent upstream routing to a China-only replica, not a persistent account restriction — confirmed by immediately retrying the exact same call. If you ever see this and a retry *doesn't* clear it, treat that as new information (a real opt-in gate, not a flake) and don't click through the opt-in link without treating it as the data-residency decision it'd be.

Presets set the model, thinking level, and inject a short lane-identity instruction into the system prompt — they don't restrict tools (unlike agents, below, which do).

## Hat — `/hat work|oss`

Explicit only, defaults to `work`. This machine has no clean filesystem split between MaxContact and OSS repos (everything lives flat under `~/repos/*`), so it's never inferred from cwd — you say which one you're in.

What it actually changes:
- System-prompt framing (points the model at the right profile doc, suggests the right agents)
- Status line segment
- Permission posture: under `oss`, `git push` / `gh pr create` / `gh release create` also require confirmation, on top of the always-on rules below

What it does **not** change: which agents/skills are *discoverable*. Pi scans agent/skill locations once at startup — there's no per-role filtering mechanism to hook into. All 15 agents are always technically invocable; the hat sets which ones you should reach for, not a hard boundary.

**Limitation, not a bug:** role state persists across turns in a session, but only survives `pi --resume` if a real message (not just the `/hat` command itself) triggered a turn before you quit. Same limitation the underlying pattern has for presets — cosmetic, matters only if you set a hat and quit without saying anything else.

## Agents (subagent tool)

Each agent runs in an **isolated subprocess** — a separate `pi` process, not sharing your context window. Verified: dispatching `scout` against a 35KB file produced a session delta of ~58KB total (full transcript overhead + a 3-bullet summary), not the ~95KB you'd see if the raw file had leaked into the main context.

Generic (always relevant):

| Agent | Model | Purpose |
|---|---|---|
| `scout` | `deepseek-v4-flash` (fast) | read-only recon — locate, don't solve |
| `researcher` | inherits caller's lane | investigate, no changes, returns findings + recommendation |
| `implementer` | `gpt-5.5` (work) | execute agreed scope, run targeted checks |
| `debugger` | `gpt-5.6-terra` (hard) | root cause before fix, symptom vs cause |
| `reviewer` | `claude-sonnet-5` (review) | independent check — different model family on purpose |

MaxContact-flavored (`work` hat): `platform-architect`, `sre`, `security-reviewer`, `incident-investigator`, `ai-engineer`.

OSS-flavored (`oss` hat): `maintainer`, `issue-triager`, `pr-reviewer`, `release-manager`, `dependency-maintainer`.

Workflow prompts chain agents: `/investigate <q>` (scout → researcher, no changes), `/implement <task>` (scout → implementer), `/review [focus]` (reviewer on current diff), `/handoff [next]` (structured summary for a new session/phase — objective, evidence, decisions, constraints, files, open questions, next action).

## Security model

Two extensions, both **pattern-matching, not a sandbox** — say so plainly rather than overclaiming:

- `extensions/permission-gate.ts` — confirms before: `rm -rf`, `sudo`, `chmod/chown 777`, `kubectl apply/delete/scale/rollout/drain/cordon/replace/patch`, `terraform apply/destroy`, force-push, direct push to `main`/`master`, cloud-CLI delete/destroy, SQL `DROP`. Under the `oss` hat, also: plain `git push`, `gh pr create`, `gh release create`. In non-interactive mode (no UI to confirm), these **block** rather than silently proceed.
- `extensions/protected-paths.ts` — blocks `write`/`edit` (not `read`) to `.env*`, `auth.json`, `.aws/credentials`, `.azure/`, `.kube/config`, SSH private keys, `.pem`/`.p12`, `.netrc`, `.npmrc`, `.git-credentials`.

Pi's own project-trust model adds a layer underneath: project-local `.pi/extensions` only load after you trust that project, so a malicious repo can't auto-run code just by you `cd`-ing into it.

Treat anything resembling real customer data, identifiable performance data, or commercial/pricing info as needing a policy check before use, per the MaxContact AI policy — ask, don't assume.

## Efficiency

- **Output size**: pi's built-in tools already cap output at 50KB / 2000 lines (whichever hits first) before it reaches context. This is a platform guarantee, not something this config adds — verified against the `DEFAULT_MAX_BYTES`/`DEFAULT_MAX_LINES` constants pi ships.
- **Context monitoring**: `extensions/status-line.ts` shows a live `provider/model | thinking | ctx%% | repo` line. `extensions/context-guard.ts` proactively nudges once per threshold (75%, 90%) suggesting `/handoff` — not a nag on every turn.
- **Recon before reading**: `AGENTS.md` and the `scout` agent both push "grep/find before reading whole files," "don't dump full `terraform show`/K8s YAML/logs."
- **Tool schema footprint**: no MCP servers or third-party extensions added globally beyond the one pre-existing, inspected, low-risk package (`@gotgenes/pi-anthropic-auth` — see commit history for why it's trusted). Keeping it that way is a decision, not an oversight — add integrations when there's a concrete need, not preemptively.

## Adding a project

Global config (this repo) applies everywhere automatically. For project-specific domain context or resource overrides, add to the project itself — pi merges project settings over global, and loads project `AGENTS.md`/`CLAUDE.md` alongside the global one:

```
your-repo/
  AGENTS.md              project-specific conventions (loaded alongside global)
  .pi/
    settings.json         project overrides (e.g. narrower default tools)
    agents/                project-only subagents (need agentScope: "both" in the
                            subagent tool call to activate — off by default, confirmed
                            per-use even then, since project agents are repo-controlled
                            prompts that can instruct arbitrary bash)
```

Don't put MaxContact-specific architecture in the *global* config (this repo) — it belongs in `profiles/maxcontact/` here (shared across all MaxContact repos) or in the individual repo's own `AGENTS.md` (repo-specific).

## Updating model mappings

Model availability changes; check before trusting a lane:

```bash
pi --list-models              # everything currently authenticated
pi --list-models <search>     # fuzzy filter, e.g. `pi --list-models opus`
```

Then edit `presets.json` (lane defaults) and/or the relevant `agents/*.md` frontmatter `model:` field. No restart needed for presets (`models.json`/`presets.json` reload on next use); extensions need `/reload` or a session restart.

Don't hand-guess Anthropic model IDs — pi fetches that catalog live from Anthropic, nothing is hardcoded to check a guess against. Always confirm via `--list-models` first.

## Troubleshooting

- **`pi --list-models` shows nothing for a provider**: not authenticated in *pi's own* auth store (`~/.pi/agent/auth.json`), separate from Codex CLI's or Claude Code's own auth. Run `/login` inside an interactive `pi` session.
- **Claude Team-plan `/login` hangs or rejects**: use `claude setup-token` (your own `claude` CLI) instead, then `security add-generic-password` + export `ANTHROPIC_OAUTH_TOKEN` from Keychain. Pi checks this env var before `ANTHROPIC_API_KEY`. The `@gotgenes/pi-anthropic-auth` package (already installed) improves compatibility for exactly this token type.
- **`RegionError` on `deepseek-v4-flash`**: known intermittent flake (see "Compute lanes" above) — retry once before assuming anything's actually broken. Only treat it as a real opt-in gate if a retry doesn't clear it.
- **A preset/extension change doesn't seem to apply**: `presets.json`/`models.json` reload on next use automatically; extension `.ts` changes need `/reload` or a fresh session.
- **Config seems to have vanished**: check `~/.pi/agent/*` are still symlinks (`ls -la ~/.pi/agent`) — something (a `pi update` migration, an install script) could in principle replace a symlink with a real file. If so, diff it against the repo before deciding which is authoritative; don't just re-symlink over unreviewed changes.
