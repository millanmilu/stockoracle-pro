/**
 * ui-check.mjs — Headless browser health check for the frontend.
 *
 * Loads the app in real (headless) Chrome, waits for React hydration, then
 * reports console errors, uncaught exceptions, failed network requests and
 * HTTP >= 400 responses. Saves a full-page screenshot for visual review.
 *
 * Usage:
 *   node scripts/ui-check.mjs            # checks http://localhost:5173/
 *   node scripts/ui-check.mjs /screener  # checks a specific route
 *   UI_CHECK_URL=http://localhost:5173 node scripts/ui-check.mjs
 *   UI_CHECK_CHROMIUM=/path/to/chrome node scripts/ui-check.mjs   # explicit browser binary
 *
 * Exit code: 0 = healthy, 1 = problems found (CI friendly).
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = (process.env.UI_CHECK_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const ROUTE = process.argv[2] ?? '/';
const TARGET = `${BASE_URL}${ROUTE.startsWith('/') ? ROUTE : `/${ROUTE}`}`;
const APP_ORIGIN = new URL(BASE_URL).origin;
const OUT_DIR = path.resolve(import.meta.dirname, '../../logs/ui-check');

fs.mkdirSync(OUT_DIR, { recursive: true });

const consoleErrors = []; // { text, url }
const pageErrors = []; // uncaught exceptions
const failedRequests = []; // { url, failure, sameOrigin }
const badResponses = []; // { url, status, sameOrigin }

const isSameOrigin = (url) => {
  try {
    return new URL(url).origin === APP_ORIGIN;
  } catch {
    return false;
  }
};

async function launchBrowser() {
  // Prefer system Chrome (no browser download needed); fall back to the
  // Playwright-bundled Chromium, and finally retry with --no-sandbox for
  // restricted CI containers.
  const attempts = [
    // Explicit binary wins: CI images / sandboxes often ship Chrome (or a
    // sparticuz-style build) outside Playwright's registry paths.
    process.env.UI_CHECK_CHROMIUM ? { executablePath: process.env.UI_CHECK_CHROMIUM, headless: true } : null,
    { channel: 'chrome', headless: true },
    { headless: true },
    { channel: 'chrome', headless: true, args: ['--no-sandbox'] },
    { headless: true, args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] },
  ].filter(Boolean);
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch(opts);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

const browser = await launchBrowser();
try {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    userAgent: 'StockOracle-UiCheck/1.0',
  });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), url: msg.location()?.url ?? '' });
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    const failure = req.failure()?.errorText ?? 'unknown';
    failedRequests.push({ url: req.url(), failure, sameOrigin: isSameOrigin(req.url()) });
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      badResponses.push({ url: res.url(), status: res.status(), sameOrigin: isSameOrigin(res.url()) });
    }
  });

  console.log(`→ Loading ${TARGET}`);
  const nav = await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });

  // Wait for React mount: the #init-loader placeholder is replaced on mount,
  // or the global crash overlay (#error-display) appears.
  let hydrated = false;
  try {
    await page.waitForFunction(
      () => !document.getElementById('init-loader') || Boolean(document.getElementById('error-display')),
      { timeout: 20000 },
    );
    hydrated = true;
  } catch {
    // stays false — reported below
  }

  // Give APIs / WebSocket a moment to push data into the UI.
  await page.waitForTimeout(2500);

  const crashText = await page.evaluate(() => {
    const el = document.getElementById('error-display');
    return el ? el.innerText.slice(0, 600) : null;
  });
  const stats = await page.evaluate(() => ({
    title: document.title,
    rootChildren: document.getElementById('root')?.children.length ?? 0,
    hasLoader: Boolean(document.getElementById('init-loader')),
    bodyTextLength: document.body?.innerText?.length ?? 0,
    canvasCount: document.querySelectorAll('canvas').length,
    svgCount: document.querySelectorAll('svg').length,
  }));

  const screenshotPath = path.join(OUT_DIR, 'home.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // ---- Report ----
  // A failed off-origin socket (upstream market-data feeds like Binance) is
  // attributed by Chrome to the originating module URL, i.e. looks same-origin.
  // Classify by the URL inside the message so blocked third-party feeds stay
  // warnings instead of failing an otherwise healthy app.
  const externalHostIn = (text) => (String(text).match(/wss?:\/\/[^\s'"]+/g) || []).some((u) => !isSameOrigin(u));
  const sameOriginConsole = consoleErrors.filter((e) => (!e.url || isSameOrigin(e.url)) && !externalHostIn(e.text));
  const extConsole = consoleErrors.filter((e) => !sameOriginConsole.includes(e));
  const sameOriginFailed = failedRequests.filter((r) => r.sameOrigin);
  const extFailed = failedRequests.filter((r) => !r.sameOrigin);
  const sameOriginBad = badResponses.filter((r) => r.sameOrigin);
  const extBad = badResponses.filter((r) => !r.sameOrigin);
  const aborted = sameOriginFailed.filter((r) => r.failure.includes('ERR_ABORTED'));
  const realFailed = sameOriginFailed.filter((r) => !r.failure.includes('ERR_ABORTED'));

  console.log('\n===== UI CHECK REPORT =====');
  console.log(`URL:            ${page.url()} (HTTP ${nav?.status() ?? 'n/a'})`);
  console.log(`Title:          ${stats.title}`);
  console.log(`Hydrated:       ${hydrated && !crashText ? 'YES' : 'NO'}`);
  console.log(
    `DOM:            rootChildren=${stats.rootChildren} loader=${stats.hasLoader} bodyText=${stats.bodyTextLength}ch canvas=${stats.canvasCount} svg=${stats.svgCount}`,
  );
  console.log(`Screenshot:     ${screenshotPath}`);

  const block = (label, items, fmt) => {
    if (items.length) console.log(`\n${label} (${items.length}):\n${items.map(fmt).join('\n')}`);
  };
  block('CRASH OVERLAY', crashText ? [crashText] : [], (t) => `  ${t}`);
  block('UNCAUGHT PAGE ERRORS', pageErrors, (e) => `  ${e}`);
  block('CONSOLE ERRORS (app)', sameOriginConsole, (e) => `  [${e.url}] ${e.text}`);
  block('FAILED REQUESTS (app)', realFailed, (r) => `  ${r.url} → ${r.failure}`);
  block('HTTP >= 400 (app)', sameOriginBad, (r) => `  ${r.status} ${r.url}`);
  block('warnings — aborted (app)', aborted, (r) => `  ${r.url} → ${r.failure}`);
  block('warnings — external console', extConsole, (e) => `  [${e.url}] ${e.text}`);
  block('warnings — external requests', extFailed, (r) => `  ${r.url} → ${r.failure}`);
  block('warnings — external HTTP >= 400', extBad, (r) => `  ${r.status} ${r.url}`);

  const failures = [];
  if (!hydrated) failures.push('app did not hydrate within 20s');
  if (crashText) failures.push('global crash overlay (#error-display) present');
  if (pageErrors.length) failures.push(`${pageErrors.length} uncaught page error(s)`);
  if (sameOriginConsole.length) failures.push(`${sameOriginConsole.length} console error(s)`);
  if (realFailed.length) failures.push(`${realFailed.length} failed request(s)`);
  if (sameOriginBad.length) failures.push(`${sameOriginBad.length} HTTP >= 400 response(s)`);

  console.log(failures.length ? `\n❌ FAIL: ${failures.join('; ')}` : '\n✅ PASS: no app-level errors detected');
  process.exitCode = failures.length ? 1 : 0;
} finally {
  await browser.close();
}


