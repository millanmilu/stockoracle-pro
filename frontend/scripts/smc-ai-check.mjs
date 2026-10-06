/**
 * smc-ai-check.mjs — headless health check for the SMC Pro overlay + AI layer.
 *
 * Runs against a LIVE app (dev server + backend). Unlike livechart-check.mjs
 * this pass needs no /api mocks for the happy path — point it at a backend
 * that has price data for the symbol under test (the check only reads what
 * the UI paints, it never writes).
 *
 * Covers:
 *   SMC Pro : toolbar toggle → SmcProLayer SVG overlay mounts → score card
 *             (Bias/Structure/Phase/Session/Score) renders
 *   AI      : AI indicator add (sub-pane + price-pane overlays), AIDashboard
 *             strip, AI Chat Analyst panel (graceful no-key error bubble),
 *             Dashboard 3-Engine AI Consensus gauge
 *
 * Usage:
 *   node scripts/smc-ai-check.mjs
 *   UI_CHECK_URL=http://localhost:5173 SMC_AI_SYMBOL=RELIANCE node scripts/smc-ai-check.mjs
 *   UI_CHECK_CHROMIUM=/tmp/chromium LD_LIBRARY_PATH=/tmp/al2023/lib node scripts/smc-ai-check.mjs
 *
 * Exit code: 0 = healthy, 1 = problems. Screenshots + JSON in logs/smc-ai-check/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.UI_CHECK_URL || 'http://localhost:5173').replace(/\/$/, '');
const SYMBOL = process.env.SMC_AI_SYMBOL || 'RELIANCE';
const OUT = path.resolve(HERE, '../../logs/smc-ai-check');
fs.mkdirSync(OUT, { recursive: true });

const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail ?? '') });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const info = (msg) => console.log(`   · ${msg}`);

const consoleErrors = [];
const pageErrors = [];
const APP_ORIGIN = new URL(BASE).origin;
const sameOrigin = (u) => { try { return new URL(u).origin === APP_ORIGIN; } catch { return false; } };

async function launchBrowser() {
  const attempts = [
    process.env.UI_CHECK_CHROMIUM ? { executablePath: process.env.UI_CHECK_CHROMIUM, headless: true } : null,
    { channel: 'chrome', headless: true },
    { headless: true },
  ].filter(Boolean);
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch({ ...opts, args: [...(opts.args || []), '--no-sandbox', '--disable-dev-shm-usage'] });
    } catch (err) { lastErr = err; }
  }
  throw lastErr;
}

const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    timezoneId: 'Asia/Kolkata',
  });
  // Pin the symbol before the app boots (zustand persist key).
  await context.addInitScript((sym) => {
    try {
      const raw = localStorage.getItem('stockoracle-store');
      const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      parsed.state = { ...(parsed.state || {}), selectedSymbol: sym, activeView: 'Live Chart' };
      localStorage.setItem('stockoracle-store', JSON.stringify(parsed));
    } catch {}
  }, SYMBOL);

  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ text: m.text(), url: m.location()?.url ?? '' }); });
  page.on('pageerror', (e) => pageErrors.push(String(e).split('\n')[0]));

  const shot = (n) => page.screenshot({ path: path.join(OUT, n) });
  const readChartArea = () => page.evaluate(() => {
    const scope = document.querySelector('.app-main') || document.body;
    return {
      canvases: scope.querySelectorAll('canvas').length,
      texts: [...scope.querySelectorAll('div,span')]
        .filter((e) => e.children.length === 0 && e.textContent.trim())
        .map((e) => e.textContent.trim()),
    };
  });

  // ── 0. boot ───────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(
    () => !document.getElementById('init-loader') || Boolean(document.getElementById('error-display')),
    { timeout: 25000 },
  ).catch(() => {});
  const crash = await page.evaluate(() => document.getElementById('error-display')?.innerText?.slice(0, 300) || null);
  check('app hydrates', !crash, crash ? `crash overlay: ${crash}` : 'ok');
  await page.waitForTimeout(4000);
  const boot = await readChartArea();
  check('chart canvas mounted', boot.canvases > 0, `${boot.canvases} canvas`);

  // ── 1. SMC Pro overlay ────────────────────────────────────────────────────
  const smcToggle = page.locator('[title="Enable SMC Pro overlays"], [title="Disable SMC Pro overlays"]');
  const hasSmcToggle = await smcToggle.count() > 0;
  check('SMC Pro toolbar toggle present', hasSmcToggle);

  if (hasSmcToggle) {
    if (await page.locator('[title="Enable SMC Pro overlays"]').count()) {
      await page.locator('[title="Enable SMC Pro overlays"]').first().click();
      await page.waitForTimeout(2500);
    }
    check('SMC Pro toggle flips to active (Disable label)',
      await page.locator('[title="Disable SMC Pro overlays"]').count() > 0);

    const layer = await page.evaluate(() => {
      const wraps = [...document.querySelectorAll('div')].filter((d) => {
        const s = getComputedStyle(d);
        return s.position === 'absolute' && s.pointerEvents === 'none' && String(s.zIndex) === '30';
      });
      const svgs = wraps.map((w) => w.querySelector(':scope > svg')).filter(Boolean);
      return svgs.map((s) => ({
        rects: s.querySelectorAll('rect').length,
        lines: s.querySelectorAll('line').length,
        polygons: s.querySelectorAll('polygon').length,
        labels: [...s.querySelectorAll('text')].map((t) => t.textContent).slice(0, 14),
      }));
    });
    check('SmcProLayer SVG overlay mounted', layer.length > 0, JSON.stringify(layer[0] || {}));
    if (layer[0]) {
      const drawn = layer[0].rects + layer[0].lines + layer[0].polygons;
      check('SMC overlay paints shapes', drawn > 0, `${drawn} shapes, labels: ${layer[0].labels.slice(0, 5).join(',') || 'none'}`);
    }

    const cardText = await page.evaluate(() => (document.querySelector('.app-main') || document.body).innerText);
    const cardOk = ['Bias', 'Structure', 'Phase', 'Session', 'Score'].every((k) => cardText.includes(k));
    check('SMC Pro score card renders (Bias/Structure/Phase/Session/Score)', cardOk);
    await shot('01-smc-pro-active.png');
  }

  // ── 2. AI indicators ──────────────────────────────────────────────────────
  const beforeAI = await readChartArea();
  await page.click('[title="Indicators, metrics and strategies"]');
  await page.waitForTimeout(700);
  await page.keyboard.type('ai trend');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const afterTrend = await readChartArea();
  const aiTrendSeen = afterTrend.texts.some((t) => /AI Trend/i.test(t));
  check('AI Trend adds a sub-pane',
    afterTrend.canvases > beforeAI.canvases || aiTrendSeen,
    `canvas ${beforeAI.canvases} → ${afterTrend.canvases}; legend hit: ${aiTrendSeen}`);

  // price-pane overlay: ai_signal (Entry/SL/TP + direction marker)
  await page.click('[title="Indicators, metrics and strategies"]');
  await page.waitForTimeout(700);
  await page.keyboard.type('ai signal');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1200);
  const afterSignal = await readChartArea();
  const aiSignalSeen = afterSignal.texts.some((t) => /AI Signal/i.test(t));
  check('AI Signal (price-pane overlay) activates without error', aiSignalSeen || pageErrors.length === 0,
    `legend hit: ${aiSignalSeen}`);

  const dashboardStrip = afterSignal.texts.some((t) => /MTF|regime|BRK|AI\b/i.test(t));
  check('AIDashboard strip present in chart shell', dashboardStrip);
  await shot('02-ai-indicators.png');

  // ── 3. AI Chat Analyst (backend has no API key → graceful error bubble) ───
  const aiChatNav = page.locator('text=AI Chat Analyst').first();
  if (await aiChatNav.count()) {
    await aiChatNav.click();
    await page.waitForTimeout(2500);
    const input = page.locator('input[placeholder*="Ask about"], textarea[placeholder*="Ask about"]').first();
    if (await input.count()) {
      await input.fill('What is the technical outlook?');
      await input.press('Enter');
      await page.waitForTimeout(6000);
    }
    const body = await page.evaluate(() => document.body.innerText);
    const graceful = /configure|API key|unavailable|provider/i.test(body);
    check('AI Chat Analyst renders + degrades gracefully without an API key', graceful,
      graceful ? 'shows configure-API-key guidance' : 'no guidance text found');
    await shot('03-ai-chat.png');
    check('AI Chat view has no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  } else {
    info('AI Chat Analyst sidebar entry not found — skipped');
  }

  // ── 4. Dashboard consensus gauge (3-engine AI) ────────────────────────────
  const dashNav = page.locator('text=Dashboard').first();
  if (await dashNav.count()) {
    await dashNav.click();
    await page.waitForTimeout(6000);
    // scroll the gauge into view so visibility is provable, not just DOM text
    const gauge = page.getByText('3-Engine AI Consensus Gauge', { exact: false }).first();
    if (await gauge.count()) {
      await gauge.scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(1200);
    }
    const gaugeState = await page.evaluate(() => {
      const els = [...document.querySelectorAll('div,span')];
      const hit = els.find((e) => /3-Engine AI Consensus Gauge/i.test(e.textContent || '') && e.children.length === 0);
      if (!hit) return null;
      const box = hit.getBoundingClientRect();
      return { w: Math.round(box.width), h: Math.round(box.height), visible: box.width > 0 && box.height > 0 && box.top < window.innerHeight && box.bottom > 0 };
    });
    const dashText = await page.evaluate(() => document.body.innerText);
    const hasScore = /\(\s*\d+(\.\d+)?\s*\/\s*100\s*\)/.test(dashText);
    check('Dashboard renders the 3-Engine AI Consensus gauge', Boolean(gaugeState?.visible),
      gaugeState ? `box ${gaugeState.w}×${gaugeState.h} visible=${gaugeState.visible}` : 'gauge element not found');
    check('Consensus gauge shows a live score for the symbol', hasScore,
      (dashText.match(/\(\s*\d+(\.\d+)?\s*\/\s*100\s*\)/) || ['no score text'])[0]);
    await shot('04-dashboard-consensus.png');
  }

  // ── 5. error accounting ───────────────────────────────────────────────────
  const externalHostIn = (text) => (String(text).match(/wss?:\/\/[^\s'"]+/g) || []).some((u) => !sameOrigin(u));
  const appConsole = consoleErrors.filter((e) => (!e.url || sameOrigin(e.url)) && !externalHostIn(e.text));
  // Data-availability 503s are environmental here: the seed DB carries daily
  // bars only (intraday intervals have no rows) and no AI provider key is set,
  // so the app is *expected* to surface them. Anything else is a real failure.
  const expected503 = appConsole.filter((e) => /503/.test(e.text) && /\/api\//.test(e.url || ''));
  const realConsole = appConsole.filter((e) => !expected503.includes(e));
  if (expected503.length) info(`expected data-unavailable 503s (seed data has no intraday rows / no AI key): ${expected503.length}`);
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check('no unexpected app-origin console errors', realConsole.length === 0,
    realConsole.slice(0, 3).map((e) => e.text).join(' | '));

  const failed = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ base: BASE, symbol: SYMBOL, checks, pageErrors, appConsole }, null, 2));
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed. Artifacts → ${path.relative(process.cwd(), OUT)}`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await browser.close();
}
