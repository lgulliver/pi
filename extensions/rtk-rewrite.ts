/**
 * RTK Rewrite
 *
 * Mirrors the Claude Code `rtk-rewrite.sh` PreToolUse hook: rewrites bash
 * commands to their RTK-proxied equivalent for token savings (e.g. `git
 * status` -> `rtk git status`). All rewrite logic lives in the `rtk` binary
 * itself (single source of truth) — this extension just calls it and applies
 * the same exit-code protocol, the same way the Claude Code hook does.
 *
 * `rtk rewrite <cmd>` exit codes (from `rtk rewrite --help` and observed
 * behavior — the built-in `--help` only documents 0/1, the Claude Code hook
 * comments document 2/3):
 *   0   rewrite found, no permission rule attached  -> rewrite, allow
 *   1   no RTK equivalent                            -> pass through
 *   2   rtk's own deny rule matched                  -> block
 *   3   rtk's own "ask" rule matched                 -> see below
 *
 * Deliberate deviation from the Claude Code hook for exit code 3: that hook
 * forwards to Claude Code's own native per-command permission system, which
 * already has these patterns pre-approved from prior use, so it's invisible
 * in practice. Pi has no equivalent persistent approval store, and testing
 * showed exit 3 fires for nearly everything rtk recognizes (`git status`,
 * `ls -la`, `curl ...`) — prompting on every one of those would defeat the
 * "transparent, 0 token overhead" point of rtk entirely. So here, exit 3
 * rewrites and allows silently, same as exit 0. Genuine danger is still
 * caught separately by permission-gate.ts, which isn't rtk-aware and checks
 * the (possibly rewritten) command regardless. If this feels wrong in
 * practice, the fix is a one-line change to the `case 3` branch below.
 *
 * Gotcha that cost real debugging time: the rewrite call MUST be async
 * (`execFile` + promisify), not `execFileSync`. With `execFileSync` here,
 * `event.input.command` mutation was confirmed set (verified by reading it
 * straight back) but silently did not reach actual execution — verified via
 * rtk's own `rtk gain --history` log gaining no new entry despite the
 * mutation "succeeding". Switching to async `execFile` fixed it outright,
 * confirmed by a fresh timestamped entry appearing in that same log
 * immediately after a test run. Root cause not confirmed further than that;
 * treat "no sync blocking calls in a tool_call handler before mutating
 * event.input" as the operating rule for this pi version (0.84.2).
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { type ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";

const execFileAsync = promisify(execFile);

let rtkAvailable: boolean | undefined;

async function checkRtkAvailable(): Promise<boolean> {
	if (rtkAvailable !== undefined) return rtkAvailable;
	try {
		await execFileAsync("rtk", ["--version"]);
		rtkAvailable = true;
	} catch {
		rtkAvailable = false;
	}
	return rtkAvailable;
}

async function rtkRewriteCommand(command: string): Promise<{ exitCode: number; rewritten: string }> {
	try {
		const { stdout } = await execFileAsync("rtk", ["rewrite", command], { encoding: "utf-8" });
		return { exitCode: 0, rewritten: stdout.trim() };
	} catch (err) {
		const e = err as { code?: number; stdout?: string };
		return { exitCode: e.code ?? 1, rewritten: (e.stdout ?? "").trim() };
	}
}

export default function rtkRewrite(pi: ExtensionAPI) {
	pi.on("tool_call", async (event) => {
		if (!isToolCallEventType("bash", event)) return undefined;
		if (!(await checkRtkAvailable())) return undefined;

		const original = event.input.command;
		const { exitCode, rewritten } = await rtkRewriteCommand(original);

		switch (exitCode) {
			case 0:
			case 3:
				if (rewritten && rewritten !== original) {
					event.input.command = rewritten;
				}
				return undefined;
			case 2:
				return { block: true, reason: "Blocked by rtk deny rule" };
			default:
				// 1 (no equivalent) or anything unexpected: pass through unchanged.
				return undefined;
		}
	});
}
