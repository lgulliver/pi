/**
 * Preset Extension
 *
 * Allows defining named presets that configure model, thinking level, tools,
 * and system prompt instructions. Presets are defined in JSON config files
 * and can be activated via CLI flag, /preset command, or Ctrl+Shift+U to cycle.
 *
 * Config files (merged, project takes precedence):
 * - ~/.pi/agent/presets.json (global)
 * - <cwd>/.pi/presets.json (project-local)
 *
 * Example presets.json:
 * ```json
 * {
 *   "plan": {
 *     "provider": "openai-codex",
 *     "model": "gpt-5.2-codex",
 *     "thinkingLevel": "high",
 *     "tools": ["read", "grep", "find", "ls"],
 *     "instructions": "You are in PLANNING MODE. Your job is to deeply understand the problem and create a detailed implementation plan.\n\nRules:\n- DO NOT make any changes. You cannot edit or write files.\n- Read files IN FULL (no offset/limit) to get complete context. Partial reads miss critical details.\n- Explore thoroughly: grep for related code, find similar patterns, understand the architecture.\n- Ask clarifying questions if requirements are ambiguous. Do not assume.\n- Identify risks, edge cases, and dependencies before proposing solutions.\n\nOutput:\n- Create a structured plan with numbered steps.\n- For each step: what to change, why, and potential risks.\n- List files that will be modified.\n- Note any tests that should be added or updated.\n\nWhen done, ask the user if they want you to:\n1. Write the plan to a markdown file (e.g., PLAN.md)\n2. Create a GitHub issue with the plan\n3. Proceed to implementation (they should switch to 'implement' preset)"
 *   },
 *   "implement": {
 *     "provider": "anthropic",
 *     "model": "claude-sonnet-4-5",
 *     "thinkingLevel": "high",
 *     "tools": ["read", "bash", "edit", "write"],
 *     "instructions": "You are in IMPLEMENTATION MODE. Your job is to make focused, correct changes.\n\nRules:\n- Keep scope tight. Do exactly what was asked, no more.\n- Read files before editing to understand current state.\n- Make surgical edits. Prefer edit over write for existing files.\n- Explain your reasoning briefly before each change.\n- Run tests or type checks after changes if the project has them (npm test, npm run check, etc.).\n- If you encounter unexpected complexity, STOP and explain the issue rather than hacking around it.\n\nIf no plan exists:\n- Ask clarifying questions before starting.\n- Propose what you'll do and get confirmation for non-trivial changes.\n\nAfter completing changes:\n- Summarize what was done.\n- Note any follow-up work or tests that should be added."
 *   }
 * }
 * ```
 *
 * Usage:
 * - `pi --preset plan` - start with plan preset
 * - `/preset` - show selector to switch presets mid-session
 * - `/preset implement` - switch to implement preset directly
 * - `Ctrl+Shift+U` - cycle through presets
 *
 * CLI flags always override preset values.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, DynamicBorder, getAgentDir } from "@earendil-works/pi-coding-agent";
import { Container, Key, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

/** Auto-applied at the start of every fresh session with no --preset flag
 * and nothing to restore from session state — see the session_start handler
 * for why this, not settings.json's defaultModel, is the real default. */
const DEFAULT_PRESET_NAME = "work";

interface Candidate {
	provider: string;
	model: string;
}

// Preset configuration
interface Preset {
	/** Provider name (e.g., "anthropic", "openai") — first/preferred candidate */
	provider?: string;
	/** Model ID (e.g., "claude-sonnet-4-5") — first/preferred candidate */
	model?: string;
	/**
	 * Ordered fallback candidates, tried in order after `provider`/`model` if
	 * that candidate has no resolvable auth. Lets a lane span providers (e.g.
	 * anthropic -> openai-codex -> opencode-go) so one account's outage or
	 * exhausted quota doesn't stall the lane. Also re-consulted reactively:
	 * a 429/529 from the currently active candidate advances to the next one
	 * (see the `after_provider_response` handler below).
	 */
	fallback?: Candidate[];
	/** Thinking level */
	thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	/** Tools to enable (replaces default set) */
	tools?: string[];
	/** Instructions to append to system prompt */
	instructions?: string;
}

interface PresetsConfig {
	[name: string]: Preset;
}

/**
 * Load presets from config files.
 * Project-local presets override global presets with the same name.
 */
function loadPresets(cwd: string): PresetsConfig {
	const globalPath = join(getAgentDir(), "presets.json");
	const projectPath = join(cwd, CONFIG_DIR_NAME, "presets.json");

	let globalPresets: PresetsConfig = {};
	let projectPresets: PresetsConfig = {};

	// Load global presets
	if (existsSync(globalPath)) {
		try {
			const content = readFileSync(globalPath, "utf-8");
			globalPresets = JSON.parse(content);
		} catch (err) {
			console.error(`Failed to load global presets from ${globalPath}: ${err}`);
		}
	}

	// Load project presets
	if (existsSync(projectPath)) {
		try {
			const content = readFileSync(projectPath, "utf-8");
			projectPresets = JSON.parse(content);
		} catch (err) {
			console.error(`Failed to load project presets from ${projectPath}: ${err}`);
		}
	}

	// Merge (project overrides global)
	return { ...globalPresets, ...projectPresets };
}

interface OriginalState {
	model: Model<Api> | undefined;
	thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
	tools: string[];
}

export default function presetExtension(pi: ExtensionAPI) {
	let presets: PresetsConfig = {};
	let activePresetName: string | undefined;
	let activePreset: Preset | undefined;
	let originalState: OriginalState | undefined;
	// Index into candidateChain(activePreset) that's currently applied, so a
	// live 429/529 knows which candidate to advance past.
	let activeCandidateIndex = 0;

	// Register --preset CLI flag
	pi.registerFlag("preset", {
		description: "Preset configuration to use",
		type: "string",
	});

	function candidateChain(preset: Preset): Candidate[] {
		const chain: Candidate[] = [];
		if (preset.provider && preset.model) chain.push({ provider: preset.provider, model: preset.model });
		if (preset.fallback) chain.push(...preset.fallback);
		return chain;
	}

	/**
	 * Auth-only availability check — does NOT call setModel, so checking a
	 * candidate has no side effect on the ones we don't end up choosing.
	 * `getProviderAuth` resolves current API key/OAuth/env auth without
	 * requiring the model to be loaded (see extensions.md, ctx.modelRegistry).
	 */
	function isCandidateAuthed(candidate: Candidate, ctx: ExtensionContext): boolean {
		const model = ctx.modelRegistry.find(candidate.provider, candidate.model);
		if (!model) return false;
		try {
			return Boolean(ctx.modelRegistry.getProviderAuth(candidate.provider));
		} catch {
			return false;
		}
	}

	/**
	 * Apply a preset configuration, walking its candidate chain (primary +
	 * fallback) and using the first one with resolvable auth. This handles
	 * "availability" (no credentials) and "provider" (the chain can span
	 * providers) fallback. "Usage" fallback (a live 429/529 mid-session) is
	 * handled separately below, reactively, in `after_provider_response` —
	 * NOT here, since Anthropic's overage headers show a request *succeeding*
	 * even when a quota window reports "rejected" (overage silently covers
	 * it); only an actual failed request is treated as "unavailable due to
	 * usage". A quota window being exhausted-but-covered-by-overage is a cost
	 * signal for you to see in the status line and decide about manually —
	 * not something this treats as a fallback trigger, since that's a cost
	 * tolerance call, not an availability one.
	 */
	async function applyPreset(name: string, preset: Preset, ctx: ExtensionContext): Promise<boolean> {
		// Snapshot state before the first preset is applied (i.e. only when transitioning from no-preset)
		if (activePresetName === undefined) {
			originalState = {
				model: ctx.model,
				thinkingLevel: pi.getThinkingLevel(),
				tools: pi.getActiveTools(),
			};
		}

		// Apply model: walk the candidate chain, first authed one wins.
		const chain = candidateChain(preset);
		if (chain.length > 0) {
			let applied = false;
			for (let i = 0; i < chain.length; i++) {
				const candidate = chain[i];
				if (!isCandidateAuthed(candidate, ctx)) continue;
				const model = ctx.modelRegistry.find(candidate.provider, candidate.model);
				if (!model) continue;
				const success = await pi.setModel(model);
				if (success) {
					activeCandidateIndex = i;
					applied = true;
					if (i > 0) {
						ctx.ui.notify(
							`Preset "${name}": using fallback ${candidate.provider}/${candidate.model} (candidate ${i} of ${chain.length})`,
							"warning",
						);
					}
					break;
				}
			}
			if (!applied) {
				ctx.ui.notify(
					`Preset "${name}": no authed candidate available (tried ${chain.map((c) => `${c.provider}/${c.model}`).join(", ")})`,
					"error",
				);
			}
		}

		// Apply thinking level if specified
		if (preset.thinkingLevel) {
			pi.setThinkingLevel(preset.thinkingLevel);
		}

		// Apply tools if specified
		if (preset.tools && preset.tools.length > 0) {
			const allToolNames = pi.getAllTools().map((t) => t.name);
			const validTools = preset.tools.filter((t) => allToolNames.includes(t));
			const invalidTools = preset.tools.filter((t) => !allToolNames.includes(t));

			if (invalidTools.length > 0) {
				ctx.ui.notify(`Preset "${name}": Unknown tools: ${invalidTools.join(", ")}`, "warning");
			}

			if (validTools.length > 0) {
				pi.setActiveTools(validTools);
			}
		}

		// Store active preset for system prompt injection
		activePresetName = name;
		activePreset = preset;

		return true;
	}

	/**
	 * Build description string for a preset.
	 */
	function buildPresetDescription(preset: Preset): string {
		const parts: string[] = [];

		if (preset.provider && preset.model) {
			parts.push(`${preset.provider}/${preset.model}`);
		}
		if (preset.thinkingLevel) {
			parts.push(`thinking:${preset.thinkingLevel}`);
		}
		if (preset.tools) {
			parts.push(`tools:${preset.tools.join(",")}`);
		}
		if (preset.instructions) {
			const truncated =
				preset.instructions.length > 30 ? `${preset.instructions.slice(0, 27)}...` : preset.instructions;
			parts.push(`"${truncated}"`);
		}

		return parts.join(" | ");
	}

	/**
	 * Show preset selector UI using custom SelectList component.
	 */
	async function showPresetSelector(ctx: ExtensionContext): Promise<void> {
		const presetNames = Object.keys(presets);

		if (presetNames.length === 0) {
			ctx.ui.notify(
				`No presets defined. Add presets to ${join(getAgentDir(), "presets.json")} or ${join(ctx.cwd, CONFIG_DIR_NAME, "presets.json")}`,
				"warning",
			);
			return;
		}

		// Build select items with descriptions
		const items: SelectItem[] = presetNames.map((name) => {
			const preset = presets[name];
			const isActive = name === activePresetName;
			return {
				value: name,
				label: isActive ? `${name} (active)` : name,
				description: buildPresetDescription(preset),
			};
		});

		// Add "None" option to clear preset
		items.push({
			value: "(none)",
			label: "(none)",
			description: "Clear active preset, restore defaults",
		});

		const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const container = new Container();
			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			// Header
			container.addChild(new Text(theme.fg("accent", theme.bold("Select Preset"))));

			// SelectList with themed styling
			const selectList = new SelectList(items, Math.min(items.length, 10), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});

			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);

			container.addChild(selectList);

			// Footer hint
			container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));

			container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		});

		if (!result) return;

		if (result === "(none)") {
			// Clear preset and restore original state
			activePresetName = undefined;
			activePreset = undefined;
			if (originalState) {
				if (originalState.model) {
					await pi.setModel(originalState.model);
				}
				pi.setThinkingLevel(originalState.thinkingLevel);
				pi.setActiveTools(originalState.tools);
			} else {
				pi.setActiveTools(["read", "bash", "edit", "write"]);
			}
			ctx.ui.notify("Preset cleared, defaults restored", "info");
			updateStatus(ctx);
			return;
		}

		const preset = presets[result];
		if (preset) {
			await applyPreset(result, preset, ctx);
			ctx.ui.notify(`Preset "${result}" activated`, "info");
			updateStatus(ctx);
		}
	}

	/**
	 * Update status indicator.
	 */
	function updateStatus(ctx: ExtensionContext) {
		if (activePresetName) {
			ctx.ui.setStatus("preset", ctx.ui.theme.fg("accent", `preset:${activePresetName}`));
		} else {
			ctx.ui.setStatus("preset", undefined);
		}
	}

	function getPresetOrder(): string[] {
		return Object.keys(presets).sort();
	}

	async function cyclePreset(ctx: ExtensionContext): Promise<void> {
		const presetNames = getPresetOrder();
		if (presetNames.length === 0) {
			ctx.ui.notify(
				`No presets defined. Add presets to ${join(getAgentDir(), "presets.json")} or ${join(ctx.cwd, CONFIG_DIR_NAME, "presets.json")}`,
				"warning",
			);
			return;
		}

		const cycleList = ["(none)", ...presetNames];
		const currentName = activePresetName ?? "(none)";
		const currentIndex = cycleList.indexOf(currentName);
		const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % cycleList.length;
		const nextName = cycleList[nextIndex];

		if (nextName === "(none)") {
			activePresetName = undefined;
			activePreset = undefined;
			if (originalState) {
				if (originalState.model) {
					await pi.setModel(originalState.model);
				}
				pi.setThinkingLevel(originalState.thinkingLevel);
				pi.setActiveTools(originalState.tools);
			} else {
				pi.setActiveTools(["read", "bash", "edit", "write"]);
			}
			ctx.ui.notify("Preset cleared, defaults restored", "info");
			updateStatus(ctx);
			return;
		}

		const preset = presets[nextName];
		if (!preset) return;

		await applyPreset(nextName, preset, ctx);
		ctx.ui.notify(`Preset "${nextName}" activated`, "info");
		updateStatus(ctx);
	}

	pi.registerShortcut(Key.ctrlShift("u"), {
		description: "Cycle presets",
		handler: async (ctx) => {
			await cyclePreset(ctx);
		},
	});

	// Register /preset command
	pi.registerCommand("preset", {
		description: "Switch preset configuration",
		handler: async (args, ctx) => {
			// If preset name provided, apply directly
			if (args?.trim()) {
				const name = args.trim();
				const preset = presets[name];

				if (!preset) {
					const available = Object.keys(presets).join(", ") || "(none defined)";
					ctx.ui.notify(`Unknown preset "${name}". Available: ${available}`, "error");
					return;
				}

				await applyPreset(name, preset, ctx);
				ctx.ui.notify(`Preset "${name}" activated`, "info");
				updateStatus(ctx);
				return;
			}

			// Otherwise show selector
			await showPresetSelector(ctx);
		},
	});

	// Reactive "usage/availability" fallback: an actual failed request (rate
	// limited or upstream overloaded) on the currently active candidate
	// advances to the next authed candidate in the chain for subsequent
	// calls. Does not retry the failed turn itself — that's a bigger, riskier
	// change (resubmitting a partially-failed turn correctly) left for if
	// this proves to actually be needed in practice.
	pi.on("after_provider_response", async (event, ctx) => {
		if (!activePreset) return;
		if (event.status !== 429 && event.status !== 529) return;

		const chain = candidateChain(activePreset);
		for (let i = activeCandidateIndex + 1; i < chain.length; i++) {
			const candidate = chain[i];
			if (!isCandidateAuthed(candidate, ctx)) continue;
			const model = ctx.modelRegistry.find(candidate.provider, candidate.model);
			if (!model) continue;
			const success = await pi.setModel(model);
			if (success) {
				activeCandidateIndex = i;
				ctx.ui.notify(
					`Preset "${activePresetName}": ${event.status === 429 ? "rate limited" : "upstream overloaded"} on previous candidate — switched to ${candidate.provider}/${candidate.model}. Your next message will use it; this failed turn was not auto-retried.`,
					"warning",
				);
				return;
			}
		}
	});

	// Inject preset instructions into system prompt
	pi.on("before_agent_start", async (event) => {
		if (activePreset?.instructions) {
			return {
				systemPrompt: `${event.systemPrompt}\n\n${activePreset.instructions}`,
			};
		}
	});

	// Initialize on session start
	pi.on("session_start", async (_event, ctx) => {
		// Load presets from config files
		presets = loadPresets(ctx.cwd);

		// Check for --preset flag
		const presetFlag = pi.getFlag("preset");
		if (typeof presetFlag === "string" && presetFlag) {
			const preset = presets[presetFlag];
			if (preset) {
				await applyPreset(presetFlag, preset, ctx);
				ctx.ui.notify(`Preset "${presetFlag}" activated`, "info");
			} else {
				const available = Object.keys(presets).join(", ") || "(none defined)";
				ctx.ui.notify(`Unknown preset "${presetFlag}". Available: ${available}`, "warning");
			}
		}

		// Restore preset from session state
		const entries = ctx.sessionManager.getEntries();
		const presetEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "preset-state")
			.pop() as { data?: { name: string } } | undefined;

		if (presetEntry?.data?.name && !presetFlag) {
			const preset = presets[presetEntry.data.name];
			if (preset) {
				activePresetName = presetEntry.data.name;
				activePreset = preset;
				// Don't re-apply model/tools on restore, just keep the name for instructions
			}
		}

		// Fresh session, no --preset flag, nothing to restore: auto-apply
		// DEFAULT_PRESET_NAME. This exists because pi persists whatever model/
		// thinking-level is currently active back into the live settings.json
		// (defaultProvider/defaultModel/defaultThinkingLevel) on every change —
		// including changes this extension makes for fallback. That makes
		// those settings.json fields drift into "whatever was last active",
		// not a stable pin — so presets.json's DEFAULT_PRESET_NAME lane,
		// re-applied here every fresh session, is the actual source of truth
		// for "what's the default", not settings.json's defaultModel.
		if (!presetFlag && !presetEntry?.data?.name) {
			const defaultPreset = presets[DEFAULT_PRESET_NAME];
			if (defaultPreset) {
				await applyPreset(DEFAULT_PRESET_NAME, defaultPreset, ctx);
			}
		}

		updateStatus(ctx);
	});

	// Persist preset state
	pi.on("turn_start", async () => {
		if (activePresetName) {
			pi.appendEntry("preset-state", { name: activePresetName });
		}
	});
}
