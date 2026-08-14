/**
 * Status Line
 *
 * Always-visible answer to: which model, which reasoning level, how full is
 * context, which repo. Role (work/oss) is added by the role extension in
 * Phase 3 — this file stays generic so it works before that exists.
 */

import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function statusLine(pi: ExtensionAPI) {
	function render(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]) {
		const theme = ctx.ui.theme;
		const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no-model";
		const thinking = pi.getThinkingLevel();
		const repo = basename(ctx.cwd);

		let ctxStr = "";
		const usage = ctx.getContextUsage?.();
		if (usage && ctx.model?.contextWindow) {
			const pct = Math.round((usage.tokens / ctx.model.contextWindow) * 100);
			ctxStr = ` | ctx ${pct}%`;
		}

		const text = `${model} | ${thinking}${ctxStr} | ${repo}`;
		ctx.ui.setStatus("status-line", theme.fg("dim", text));
	}

	pi.on("session_start", async (_event, ctx) => render(ctx));
	pi.on("turn_end", async (_event, ctx) => render(ctx));
	pi.on("model_select", async (_event, ctx) => render(ctx));
}
