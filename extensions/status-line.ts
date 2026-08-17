/**
 * Status Line
 *
 * Full custom footer (replaces pi's default multi-line footer via
 * `ctx.ui.setFooter`) — a single OpenCode-styled row: dir:branch dim on the
 * left, colored bullet (•)-prefixed segments right-aligned, matching
 * OpenCode's own session footer (`packages/tui/src/routes/session/footer.tsx`
 * in `sst/opencode`) rather than pi's native stacked footer.
 *
 * Segments: which model, which reasoning level, how full is context, and —
 * for Anthropic specifically — subscription usage against the 5-hour/7-day
 * windows.
 *
 * Anthropic-only: its API returns `anthropic-ratelimit-unified-5h-*` /
 * `-7d-*` / `-overage-*` response headers (confirmed empirically via
 * `after_provider_response` — not documented anywhere pi ships, and not
 * the same thing as `ctx.getContextUsage()`, which is this session's
 * context-window fill, not the account-level subscription cap). This is
 * the same data Claude Code's own statusline shows via its native
 * `rate_limits.five_hour`/`seven_day` payload fields — pi doesn't expose
 * that composed object, so this reads the same underlying headers itself.
 *
 * openai-codex exposes no headers at all here ("Providers that abstract
 * HTTP responses may not expose headers" — confirmed, not just undocumented).
 * github-copilot and opencode-go return headers but nothing usage-related.
 * So this segment only ever appears while the active model is Anthropic.
 */

import { basename } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

interface AnthropicUsage {
	fiveHourPct?: number;
	fiveHourReset?: string;
	sevenDayPct?: number;
	sevenDayReset?: string;
	overageInUse: boolean;
}

function parsePct(value: string | undefined): number | undefined {
	if (value === undefined) return undefined;
	const n = Number.parseFloat(value);
	return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

function formatReset(epochSeconds: string | undefined): string | undefined {
	if (!epochSeconds) return undefined;
	const n = Number.parseInt(epochSeconds, 10);
	if (!Number.isFinite(n)) return undefined;
	const d = new Date(n * 1000);
	const sameDay = d.toDateString() === new Date().toDateString();
	return sameDay
		? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
		: d.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

export default function statusLine(pi: ExtensionAPI) {
	let anthropicUsage: AnthropicUsage | undefined;
	let requestRender: (() => void) | undefined;

	function usageColor(pct: number): "success" | "warning" | "error" {
		if (pct >= 90) return "error";
		if (pct >= 70) return "warning";
		return "success";
	}

	function install(ctx: Parameters<Parameters<ExtensionAPI["on"]>[1]>[1]) {
		ctx.ui.setFooter((tui, theme, footerData) => {
			requestRender = () => tui.requestRender();
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const dot = (color: "accent" | "success" | "warning" | "error" | "dim", label: string) =>
						`${theme.fg(color, "•")} ${label}`;

					const model = ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : "no-model";
					const thinking = pi.getThinkingLevel();
					const repo = basename(ctx.cwd);
					const branch = footerData.getGitBranch();

					const segments: string[] = [dot("accent", `${model} ${thinking}`)];

					const usage = ctx.getContextUsage?.();
					if (usage && ctx.model?.contextWindow) {
						const pct = Math.round((usage.tokens / ctx.model.contextWindow) * 100);
						segments.push(dot(usageColor(pct), `ctx ${pct}%`));
					}

					if (ctx.model?.provider === "anthropic" && anthropicUsage) {
						if (anthropicUsage.fiveHourPct !== undefined) {
							let s = `5h ${anthropicUsage.fiveHourPct}%`;
							if (anthropicUsage.fiveHourReset) s += ` (${anthropicUsage.fiveHourReset})`;
							segments.push(dot(usageColor(anthropicUsage.fiveHourPct), s));
						}
						if (anthropicUsage.sevenDayPct !== undefined) {
							let s = `wk ${anthropicUsage.sevenDayPct}%`;
							if (anthropicUsage.sevenDayReset) s += ` (${anthropicUsage.sevenDayReset})`;
							if (anthropicUsage.overageInUse) s += " overage!";
							segments.push(dot(anthropicUsage.overageInUse ? "error" : usageColor(anthropicUsage.sevenDayPct), s));
						}
					}

					const left = theme.fg("dim", branch ? `${repo}:${branch}` : repo);
					const right = segments.join(theme.fg("dim", "  "));
					const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
					return [truncateToWidth(left + pad + right, width)];
				},
			};
		});
	}

	pi.on("session_start", async (_event, ctx) => install(ctx));
	pi.on("turn_end", async () => requestRender?.());
	pi.on("model_select", async (_event, ctx) => {
		if (ctx.model?.provider !== "anthropic") anthropicUsage = undefined;
		requestRender?.();
	});

	pi.on("after_provider_response", (event, ctx) => {
		if (ctx.model?.provider !== "anthropic") return;
		const h = event.headers ?? {};
		const fiveHourPct = parsePct(h["anthropic-ratelimit-unified-5h-utilization"]);
		const sevenDayPct = parsePct(h["anthropic-ratelimit-unified-7d-utilization"]);
		if (fiveHourPct === undefined && sevenDayPct === undefined) return;

		anthropicUsage = {
			fiveHourPct,
			fiveHourReset: formatReset(h["anthropic-ratelimit-unified-5h-reset"]),
			sevenDayPct,
			sevenDayReset: formatReset(h["anthropic-ratelimit-unified-7d-reset"]),
			overageInUse: h["anthropic-ratelimit-unified-overage-in-use"] === "true",
		};
		requestRender?.();
	});
}
