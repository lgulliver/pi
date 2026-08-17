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

| Lane | Primary | Fallback chain (in order) | Thinking | Use for |
|---|---|---|---|---|
| `fast` | `opencode-go/deepseek-v4-flash` | `openai-codex/gpt-5.4-mini` | low | recon, search, summaries, mechanical work |
| `work` (default) | `anthropic/claude-sonnet-5` | `opencode-go/deepseek-v4-pro` → `openai-codex/gpt-5.5` | medium | normal engineering, implementation, everyday debugging |
| `hard` | `anthropic/claude-opus-5` | `opencode-go/deepseek-v4-pro` → `openai-codex/gpt-5.6-terra` | high | architecture, hard debugging, distributed-systems/security-sensitive reasoning |
| `max` | `anthropic/claude-opus-5` | same as `hard` | xhigh | explicit-invoke only, never a default |
| `review` | `openai-codex/gpt-5.6-terra` | `opencode-go/deepseek-v4-pro` → `anthropic/claude-sonnet-5` (last resort) | high | independent second opinion — different model family on purpose |

Flipped from the original build: Anthropic is now the WORK/HARD/MAX primary (Codex was), Codex is now REVIEW's primary (Anthropic was) — Liam's call, made with the overage state above already known. `/preset work` returns to baseline.

Escalate to `hard` on evidence (repeated unexplained failure, conflicting evidence, ambiguous root cause, multiple subsystems, security-sensitive reasoning, high cost of a wrong answer) — not just because a task feels big or context got long.

### Fallback

Each lane above has an ordered fallback chain (`extensions/preset.ts`, extended beyond the vendored example). Two independent mechanisms:

- **Preflight (availability/provider):** at apply time, walks primary → fallback candidates, uses the first one with resolvable auth (`ctx.modelRegistry.getProviderAuth`) — checked, not assumed. Chains deliberately span providers so one account's problem doesn't stall a lane.
- **Reactive (usage, mid-session):** a live `429`/`529` on the active candidate advances to the next authed one for subsequent calls, with a visible notify. It does **not** retry the failed turn itself — only the next message uses the fallback. This hasn't been tested against a real 429 (forcing one deliberately would waste quota/money); the logic is straightforward and the underlying event is confirmed real, but treat it as logically-verified, not battle-tested, until one happens naturally.

**Deliberately not a fallback trigger:** Anthropic's overage state (7d window "rejected" but request succeeding via paid overage). That's a *cost* signal, not an *availability* one — whether to keep paying overage or manually switch lanes is your call, shown in the status line, not something this silently decides for you.

**A real gap found while proving this works:** `getProviderAuth` confirms you're logged into a provider, not that your account is entitled to a specific model. `gpt-5.3-codex-spark` passed the auth check and was picked as a candidate, then failed at the actual request: *"not supported when using Codex with a ChatGPT account"* — a real account-tier restriction our availability check can't see in advance. None of the models actually used in `presets.json` above are known to have this problem, but if a fallback ever visibly fails immediately after being selected, this is why — worth an eyes-on check before adding any new model to a fallback chain.

**Gotcha that would have silently corrupted this file:** pi persists whatever model/thinking-level is currently active back into `settings.json`'s `defaultProvider`/`defaultModel`/`defaultThinkingLevel` on every change — including changes made internally by this preset extension's own fallback logic, not just `/model`. Confirmed by triggering a fallback and watching those three keys rewrite themselves. That makes `settings.json`'s defaults drift into "whatever ran last", not a stable pin — so `extensions/preset.ts` now auto-applies the `work` preset at the start of every fresh session with nothing else to restore, making `presets.json`'s `work` lane the actual source of truth for "the default", independent of whatever `settings.json` currently says. Confirmed by deliberately drifting it via `/preset test-fallback`, then watching a fresh session reset it correctly.

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

## Theme — `opencode`

`themes/opencode.json` (symlinked to `~/.pi/agent/themes/`, active via `settings.json`'s `"theme": "opencode"`) is a straight port of OpenCode's own default `opencode` theme palette — pulled from the real source (`packages/tui/src/theme/assets/opencode.json` in `sst/opencode` on GitHub, not guessed), remapped onto pi's 51-token theme schema (`~/.pi/agent/docs/themes.md`). Same accent orange (`#fab283`), purple/blue/cyan secondaries, and near-black background steps OpenCode ships by default.

`extensions/status-line.ts` uses `ctx.ui.setFooter` to fully replace pi's own multi-line default footer with a single OpenCode-styled row — `dir:branch` dim on the left, colored bullet (`•`)-prefixed segments right-justified, mirroring OpenCode's real session footer (`packages/tui/src/routes/session/footer.tsx`). Content is unchanged from before — model/thinking, context %, the Anthropic 5h/7d usage segments described below — only the layout moved from a supplemental status line (`setStatus`, stacked under pi's own footer) to a full footer replacement.

Note: OpenCode's `opencode.json` config file has no theme/statusline keys itself — its TUI theme is selected via a separate `tui.json` (`{"theme": "..."}`) or `/theme`, with palettes shipped as compiled-in JSON. There was nothing to copy config-shape-wise; this port is palette + layout only.

**What isn't achievable, and why (checked against pi's own extension docs, not assumed):** OpenCode's right-hand sidebar panel and its condensed one-line-per-step trace (`+ Thought…`, `→ Read …`) are OpenCode's own multi-pane SolidJS TUI renderer — a different architecture, not a config surface. Pi's extension API only exposes `setWidget` (above/below the input editor, single column, no split-pane/sidebar concept) and `setFooter` (one full-width row) — confirmed via `docs/tui.md` and `docs/extensions.md`, not inferred. Built-in tool calls (`Read`, `Bash`, etc.) render as pi's own bordered/backgrounded boxes; that's core rendering, not something an extension can override to a bare `→ label` line — only tools an extension itself defines get fully custom rendering. So the footer above is the ceiling for visual parity, not a step toward the sidebar.

## Efficiency

- **Output size**: pi's built-in tools already cap output at 50KB / 2000 lines (whichever hits first) before it reaches context. This is a platform guarantee, not something this config adds — verified against the `DEFAULT_MAX_BYTES`/`DEFAULT_MAX_LINES` constants pi ships.
- **Context monitoring**: `extensions/status-line.ts` shows a live `provider/model | thinking | ctx%% | repo` line, plus a `5h X% wk Y%` segment **when the active model is Anthropic** — that's subscription-usage against the 5-hour/7-day windows, not context fill. `extensions/context-guard.ts` proactively nudges once per threshold (75%, 90% context) suggesting `/handoff` — not a nag on every turn.
- **Recon before reading**: `AGENTS.md` and the `scout` agent both push "grep/find before reading whole files," "don't dump full `terraform show`/K8s YAML/logs."
- **Tool schema footprint**: no MCP servers or third-party extensions added globally beyond the one pre-existing, inspected, low-risk package (`@gotgenes/pi-anthropic-auth` — see commit history for why it's trusted). Keeping it that way is a decision, not an oversight — add integrations when there's a concrete need, not preemptively.
- **RTK**: `extensions/rtk-rewrite.ts` reuses Liam's existing `rtk` CLI (the same one the Claude Code `PreToolUse` hook calls) to transparently rewrite bash commands to their token-saving equivalent. All rewrite logic lives in the `rtk` binary — this extension just calls it and applies its exit-code protocol, same as the Claude Code hook. One deliberate difference: rtk's "ask" exit code (3) fires for nearly everything it recognizes, so here it rewrites and allows silently rather than confirming every call — see the file's top comment for the full reasoning and how to flip it back to confirm-every-time if that's wrong in practice.
- **Caveman skill**: pi already auto-discovers `~/.agents/skills/` by default, so Liam's `caveman` skill (and anything else in that directory) is available with no config change. `AGENTS.md` explicitly tells the model to invoke it by default, matching the always-on behavior configured in his Claude Code `CLAUDE.md` — otherwise pi has no reason to know it should be automatic rather than just available.

## Subscription usage in the status line

Anthropic's API returns real usage headers per request — `anthropic-ratelimit-unified-5h-*` / `-7d-*` / `-overage-*` — confirmed empirically by probing `after_provider_response` on a live call, not documented in pi's own docs. This is the same underlying data Claude Code's native statusline shows as `rate_limits.five_hour`/`seven_day`; pi doesn't expose that composed object, so `extensions/status-line.ts` reads the headers itself.

**Provider-specific, checked directly, not assumed:**
- `anthropic` — full usage data (5h/7d %, reset time, overage flag). Shown in the status line.
- `openai-codex` — **no headers exposed at all** to `after_provider_response` ("Providers that abstract HTTP responses may not expose headers" per pi's docs — confirmed, this isn't just undocumented, Codex genuinely doesn't fire the event with headers). No usage visibility possible this way for your primary WORK-lane provider.
- `github-copilot` / `opencode-go` — headers present, nothing usage-related in them.

So the usage segment only ever appears while you're actively on an Anthropic model (`review` lane, or `/model` into one manually).

**Found while building this, worth knowing:** at the time of writing, the 7-day unified window was at 100% utilization with `overage-in-use: true` — meaning Anthropic usage (via pi, and presumably Claude Code on the same account) is currently billing as paid extra usage, not plan quota. Check `claude.ai/settings/usage` for the real picture; the status line will now show it going forward without needing to check manually.

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
- **Writing a `tool_call` extension that mutates `event.input` and it silently doesn't apply**: use an async child-process call (`execFile` + `promisify`), not `execFileSync`, before mutating. Confirmed on pi 0.84.2: `execFileSync` let the mutation read back correctly on the same object inside the handler, but it never reached actual execution — verified via an external, independently-timestamped log (`rtk gain --history`), not just pi's own output. Switching to async `execFile` fixed it outright. Root cause not chased further than that; treat it as a known gotcha, not a fully explained one.
