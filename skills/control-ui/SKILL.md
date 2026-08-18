---
description: Build a local Playwright/CDP harness to drive and inspect a web or Electron UI — for UX verification, screenshots, accessibility checks, performance profiling, and visual regression.
when_to_use: Use when the user says "test the UI", "check the UI works", "take a screenshot", "verify the page after this change", "reproduce the UI bug", "profile the page", "check accessibility", or "visual regression check". Use for browser-based UIs and Electron apps — use /control-cli for terminal CLIs.
disable-model-invocation: false
allowed-tools: Bash(*) Bash(npx *) Bash(node *) Bash(cat *) Bash(find *) Bash(ls *) Bash(kill *)
---

# Control UI

## Discover setup

!`find . -name "playwright.config.*" 2>/dev/null | head -3`
!`cat package.json 2>/dev/null | python3 -c "import sys,json; s=json.load(sys.stdin).get('scripts',{}); [print(k,':',v) for k,v in s.items() if k in ['dev','start','serve']]" 2>/dev/null || true`

Determine: target type (local dev / staging URL / Electron), auth required, Playwright available.

## Install Playwright if needed

```bash
npx playwright install --with-deps chromium 2>/dev/null
```

## Start dev server if needed

```bash
npm run dev &
DEV_PID=$!
sleep 3
```

**Ask if target environment is not obvious. Never assume production.**

## Base harness

```typescript
import { chromium } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  
  try {
    // Navigate
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    
    // Screenshot
    await page.screenshot({ path: 'screenshots/baseline.png', fullPage: true });
    
    // Core checks
    const title = await page.title();
    console.log(title ? 'PASS title present' : 'FAIL no title');
    
    // Check key elements using role-based selectors (preferred over CSS)
    const nav = await page.locator('nav').isVisible();
    console.log(nav ? 'PASS nav visible' : 'FAIL nav missing');
    
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
```

## Performance metrics

```typescript
const metrics = await page.evaluate(() => ({
  ttfb: performance.timing.responseStart - performance.timing.navigationStart,
  fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
  totalLoad: performance.timing.loadEventEnd - performance.timing.navigationStart,
}));
if (metrics.fcp > 2500) console.warn('WARN FCP > 2.5s');
if (metrics.totalLoad > 5000) console.warn('WARN Total load > 5s');
```

## Accessibility check

```typescript
// Manual checks (no extra deps)
const imgsMissingAlt = await page.locator('img:not([alt])').count();
const inputsMissingLabel = await page.locator('input:not([aria-label]):not([id])').count();
console.log(`Images without alt: ${imgsMissingAlt}`);
console.log(`Inputs without label: ${inputsMissingLabel}`);
```

## Visual regression (optional)

```bash
# With Playwright snapshots:
# await expect(page).toHaveScreenshot('homepage.png', { threshold: 0.05 });
```

## Cleanup

```bash
kill $DEV_PID 2>/dev/null || true
```

## Report

```
UI CONTROL REPORT
Target: {URL}
Viewport: 1280x720

CHECKS
------
PASS {check}
FAIL {check} — {expected vs got}

ACCESSIBILITY
-------------
Images without alt: N
Inputs without label: N

PERFORMANCE
-----------
TTFB:       {Nms}
FCP:        {Nms}  {ok / SLOW}
Total load: {Nms}  {ok / SLOW}

SCREENSHOTS
-----------
screenshots/baseline.png

ISSUES
------
CRITICAL {issue}
MEDIUM   {issue}
NOTE     {observation}

VERDICT: UI behaving correctly / Issues found
```

**Use role-based selectors** (`getByRole`, `getByText`) before CSS selectors.
**Never test against production** without explicit confirmation.
**Use env vars for credentials** — never hardcode.
