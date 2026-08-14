/**
 * Context Guard
 *
 * Proactively flags when context is getting full, instead of only showing a
 * passive percentage in the status line. One nudge per threshold crossing,
 * not a nag on every turn.
 *
 * Note on output size: pi's built-in tools already cap output at 50KB/2000
 * lines (whichever hits first) before it reaches context — see
 * DEFAULT_MAX_BYTES/DEFAULT_MAX_LINES in the pi-coding-agent package. That's
 * the platform's own output-filtering guarantee; this extension is about the
 * cumulative session total, not any single tool call.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const THRESHOLDS: Array<{ pct: number; message: string }> = [
	{
		pct: 90,
		message: "Context 90%+ full. Auto-compaction will likely trigger soon. If you're between phases, /handoff now for a clean summary instead.",
	},
	{
		pct: 75,
		message: "Context past 75%. If you're between phases (investigation -> implementation, diagnosis -> fix), consider /handoff.",
	},
];

export default function contextGuard(pi: ExtensionAPI) {
	let lastWarnedPct = 0;

	pi.on("turn_end", async (_event, ctx) => {
		const usage = ctx.getContextUsage?.();
		if (!usage || !ctx.model?.contextWindow) return;

		const pct = (usage.tokens / ctx.model.contextWindow) * 100;

		if (pct < 75) {
			lastWarnedPct = 0;
			return;
		}

		const hit = THRESHOLDS.find((t) => pct >= t.pct && lastWarnedPct < t.pct);
		if (!hit) return;

		lastWarnedPct = hit.pct;
		if (ctx.hasUI) {
			ctx.ui.notify(hit.message, "warning");
		}
	});
}
