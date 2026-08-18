/**
 * Role ("hat") switching
 *
 * Explicit-only role selection — deliberately NOT filesystem/cwd-based.
 * This machine has no clean ~/work vs ~/src split (everything lives under
 * ~/repos/*), so the signal is you telling pi which hat you're wearing.
 *
 * What role actually changes, given pi's real architecture:
 *   - System-prompt framing (via before_agent_start) — points the model at
 *     the right profile AGENTS.md instead of dumping its content every turn.
 *   - Status line segment.
 *   - Additional permission-gate rules for "oss" (push/PR/release confirm).
 *
 * What it does NOT change: which skills/agents are *discoverable* — pi scans
 * skill/agent locations once at startup, not per role. Both profiles' agents
 * are always technically invocable via the subagent tool; role sets which
 * ones the model should reach for, not a hard access boundary. Real per-repo
 * skill scoping is done the way pi actually supports it: project-level
 * `.pi/settings.json` in each repo, not a global toggle.
 *
 * Default role is "work" — this is a MaxContact laptop first.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export type Role = "work" | "oss";

const ROLE_INSTRUCTIONS: Record<Role, string> = {
	work: [
		"Hat: WORK (MaxContact).",
		"Domain context lives in profiles/work/AGENTS.md — read it if you haven't this session and the task is infrastructure/platform/security related.",
		"Prefer platform-architect, sre, security-reviewer, incident-investigator, ai-engineer agents for MaxContact-specific work; scout/researcher/implementer/debugger/reviewer for everything else.",
		"Strict posture: this is a corporate workstation with real customer/tenant infrastructure. Confirm before anything that mutates shared state (see extensions/permission-gate.ts).",
	].join("\n"),
	oss: [
		"Hat: OSS.",
		"Domain context lives in profiles/oss/AGENTS.md — read it if you haven't this session.",
		"Prefer maintainer, issue-triager, pr-reviewer, release-manager, dependency-maintainer agents for OSS-specific work.",
		"Freer posture on edits/tests/branches than WORK, but push, opening a PR, and publishing a release still confirm — those are visible to others the moment they happen.",
	].join("\n"),
};

interface RoleState {
	role: Role;
}

export default function roleExtension(pi: ExtensionAPI) {
	let role: Role = "work";

	function updateStatus(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]) {
		const theme = ctx.ui.theme;
		ctx.ui.setStatus("role", theme.fg("accent", `role:${role}`));
	}

	function applyRole(r: Role, ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]) {
		role = r;
		pi.events.emit("role:change", role);
		pi.appendEntry("role-state", { role } satisfies RoleState);
		updateStatus(ctx);
	}

	pi.registerCommand("hat", {
		description: "Switch role context: work (MaxContact, default) or oss",
		handler: async (args, ctx) => {
			const arg = args?.trim().toLowerCase();

			if (arg === "work" || arg === "oss") {
				applyRole(arg, ctx);
				ctx.ui.notify(`Hat: ${arg}`, "info");
				return;
			}

			if (!arg) {
				ctx.ui.notify(`Current hat: ${role}. Use "/hat work" or "/hat oss" to switch.`, "info");
				return;
			}

			ctx.ui.notify(`Unknown hat "${arg}". Use "work" or "oss".`, "warning");
		},
	});

	pi.on("before_agent_start", async (event) => {
		return { systemPrompt: `${event.systemPrompt}\n\n${ROLE_INSTRUCTIONS[role]}` };
	});

	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();
		const roleEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "role-state")
			.pop() as { data?: RoleState } | undefined;

		if (roleEntry?.data?.role) role = roleEntry.data.role;

		pi.events.emit("role:change", role);
		updateStatus(ctx);
	});
}
