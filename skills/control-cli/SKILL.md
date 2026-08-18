---
description: Build a local harness to drive, inspect, and profile an interactive CLI or TUI — for UX checks, startup regressions, memory leaks, hangs, and prompt flow validation.
when_to_use: Use when the user says "test the CLI", "check the CLI UX", "does the CLI still work", "profile CLI startup", "the CLI is hanging", "verify the prompt flow", or wants to validate CLI behaviour before a release. Use for CLIs and TUIs — use /control-ui for browser-based UIs.
disable-model-invocation: false
allowed-tools: Bash(*) Bash(node *) Bash(python3 *) Bash(go *) Bash(time *) Bash(cat *) Bash(find *) Bash(ls *)
---

# Control CLI

## Discover the CLI

!`cat package.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); [print(k,':',v) for k,v in d.get('bin',{}).items()]" 2>/dev/null || true`
!`ls bin/ 2>/dev/null || true`
!`cat package.json 2>/dev/null | python3 -c "import sys,json; s=json.load(sys.stdin).get('scripts',{}); [print(k,':',v) for k,v in s.items() if k in ['start','dev','cli']]" 2>/dev/null || true`

Determine: invocation command, interactive or flag-driven, TUI or not, expected startup time.

## Strategy

| CLI type | Approach |
|----------|----------|
| Flag-driven, non-interactive | Direct subprocess, capture stdout/stderr |
| Interactive prompts (readline) | Pipe stdin with timing, capture stdout |
| TUI (Ink, Bubble Tea, Textual) | pseudo-TTY / `expect` / `pexpect` harness |

## Basic harness (flag-driven)

```bash
#!/bin/bash
CLI="node dist/cli.js"  # adapt to actual invocation
PASS=0; FAIL=0

run_test() {
  local desc="$1"; shift; local expected="$1"; shift
  local actual; actual=$("$CLI" "$@" 2>&1)
  if echo "$actual" | grep -q "$expected"; then
    echo "PASS $desc"; ((PASS++))
  else
    echo "FAIL $desc"; echo "  Expected: $expected"; echo "  Got: $(echo "$actual" | head -3)"; ((FAIL++))
  fi
}

run_test "help flag"    "Usage:"   --help
run_test "version flag" "v[0-9]"  --version
run_test "missing arg"  "required"

echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

## Interactive harness (Python pexpect)

```python
import pexpect

def test_prompt_flow():
    child = pexpect.spawn('node dist/cli.js init', timeout=10)
    child.expect('Project name:')
    child.sendline('test-project')
    child.expect(pexpect.EOF, timeout=30)
    assert 'Created successfully' in child.before.decode()
    print("PASS prompt flow")

test_prompt_flow()
```

Install if needed: `pip install pexpect`

## Startup profiling

```bash
for i in {1..5}; do { time node dist/cli.js --help > /dev/null; } 2>&1 | grep real; done
```

Flag if cold start > 1s for a simple command.

## Memory check (Node)

```bash
node --expose-gc -e "
  gc(); const b = process.memoryUsage().heapUsed;
  require('./dist/cli.js');
  gc(); const a = process.memoryUsage().heapUsed;
  console.log('Heap delta:', ((a-b)/1024/1024).toFixed(1)+'MB');
"
```

## Report

```
CLI CONTROL REPORT
CLI: {invocation}
Type: {flag-driven / interactive / TUI}

TESTS
-----
PASS {test}
FAIL {test} — {expected vs got}

PERFORMANCE
-----------
Startup (mean): {Xs}
Peak memory: {NMB}

ISSUES
------
CRITICAL {issue}
MEDIUM   {issue}
NOTE     {observation}

VERDICT: CLI behaves correctly / Issues found (see above)
```

**Never run destructive commands** (delete, drop, wipe) without sandboxing.
**Never hardcode real credentials** — use test values.
