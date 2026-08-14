/**
 * Protected Paths
 *
 * Blocks write/edit tool calls against secret files and credential stores.
 * Read is intentionally NOT blocked here — pi's own `read` tool is how you'd
 * inspect a file to decide if it's safe; blocking reads of your own dotfiles
 * would just be friction. This only stops the agent from writing/editing
 * files that look like secrets.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const PROTECTED_PATTERNS: RegExp[] = [
	/(^|\/)\.env(\..+)?$/,
	/(^|\/)auth\.json$/,
	/(^|\/)\.aws\/credentials$/,
	/(^|\/)\.azure\//,
	/(^|\/)\.kube\/config$/,
	/(^|\/)id_rsa(\.pub)?$/,
	/(^|\/)id_ed25519(\.pub)?$/,
	/\.pem$/,
	/\.p12$/,
	/(^|\/)\.netrc$/,
	/(^|\/)\.npmrc$/,
	/(^|\/)\.git-credentials$/,
];

export default function protectedPaths(pi: ExtensionAPI) {
	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") return undefined;

		const path = String(event.input.path ?? "");
		const hit = PROTECTED_PATTERNS.some((p) => p.test(path));
		if (!hit) return undefined;

		if (ctx.hasUI) {
			ctx.ui.notify(`Blocked write to protected path: ${path}`, "warning");
		}
		return { block: true, reason: `"${path}" looks like a secret/credential file — write blocked` };
	});
}
