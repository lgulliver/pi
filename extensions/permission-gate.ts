/**
 * Permission Gate
 *
 * Pattern-matches bash commands against a risk table and confirms before
 * running anything that mutates shared/production state. This is best-effort
 * regex matching, not a sandbox — it catches the common cases, not every
 * possible way to spell a dangerous command.
 *
 * Posture (see README.md "Security model"):
 *   - destructive local ops (rm -rf, sudo, chmod/chown 777)  -> confirm
 *   - kubectl apply/delete/scale/rollout/drain/cordon        -> confirm
 *   - kubectl logs/describe/get/top                          -> allow
 *   - terraform apply/destroy                                -> confirm
 *   - terraform plan                                         -> allow
 *   - git push --force / push to main·master directly        -> confirm
 *   - cloud CLI delete/destroy (az/aws/gcloud ... delete)     -> confirm
 *
 * In non-interactive mode (no UI to confirm), risky commands are blocked
 * rather than silently allowed.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface RiskRule {
	pattern: RegExp;
	reason: string;
}

// Always active, regardless of role — these are about the command being
// dangerous, not about which hat you're wearing.
const CONFIRM_RULES: RiskRule[] = [
	{ pattern: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive)/i, reason: "recursive/forced delete" },
	{ pattern: /\bsudo\b/i, reason: "sudo" },
	{ pattern: /\b(chmod|chown)\b.*\b777\b/i, reason: "chmod/chown 777" },
	{ pattern: /\bkubectl\b.*\b(apply|delete|scale|rollout|drain|cordon|replace|patch)\b/i, reason: "kubectl mutation" },
	{ pattern: /\bterraform\b.*\b(apply|destroy)\b/i, reason: "terraform apply/destroy" },
	{ pattern: /\bgit\s+push\b.*(--force|-f\b)/i, reason: "force push" },
	{ pattern: /\bgit\s+push\b.*\b(origin\s+)?(main|master)\b/i, reason: "direct push to main/master" },
	{ pattern: /\b(az|aws|gcloud)\b.*\b(delete|destroy|terminate)\b/i, reason: "cloud resource delete" },
	{ pattern: /\bdrop\s+(table|database)\b/i, reason: "SQL drop" },
];

// Only active when the "oss" hat is on (see extensions/role.ts). OSS work is
// publicly visible the instant it lands, so push/PR/release get an extra
// confirm even though OSS is otherwise a freer posture than WORK.
const OSS_ONLY_RULES: RiskRule[] = [
	{ pattern: /\bgit\s+push\b/i, reason: "push (oss hat: confirm before publishing)" },
	{ pattern: /\bgh\s+pr\s+create\b/i, reason: "open PR (oss hat)" },
	{ pattern: /\bgh\s+release\s+create\b/i, reason: "publish release (oss hat)" },
];

let currentRole: "work" | "oss" = "work";

export default function permissionGate(pi: ExtensionAPI) {
	pi.events.on("role:change", (role) => {
		currentRole = role as "work" | "oss";
	});

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = String(event.input.command ?? "");
		const rules = currentRole === "oss" ? [...CONFIRM_RULES, ...OSS_ONLY_RULES] : CONFIRM_RULES;
		const hit = rules.find((r) => r.pattern.test(command));
		if (!hit) return undefined;

		if (!ctx.hasUI) {
			return { block: true, reason: `Blocked (${hit.reason}, no UI to confirm): ${command}` };
		}

		const choice = await ctx.ui.select(`⚠️ ${hit.reason}:\n\n  ${command}\n\nAllow?`, ["Yes", "No"]);
		if (choice !== "Yes") {
			return { block: true, reason: `Blocked by user (${hit.reason})` };
		}
		return undefined;
	});
}
