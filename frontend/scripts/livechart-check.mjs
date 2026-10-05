/**
 * livechart-check.mjs — headless health check for the Live Chart tab.
 *
 * Two passes:
 *   real : against the running backend — verifies the tab hydrates, candles
 *          paint, the status line fills, and no app-level errors fire.
 *   mock : /api/stock/<sym>/history + /api/stock/<sym>/info mocked with
 *          deterministic synthetic candles and /ws mocked with a 1m tick
 *          stream (upstream market data modelled as unreachable, which is
 *          what an offline/CI box looks like). This exercises the whole
 *          frontend path deterministically: staged slim→full load, legend,
 *          live tick bucketing, bucket rollover, interval switch,
 *          cursor backfill (left-pan), oscillator pane add, modals.
 *
 * Usage:
 *   node scripts/livechart-check.mjs            # mock pass (no backend data needed)
 *   node scripts/livechart-check.mjs real       # real pass (backend + /history must answer)
 *   UI_CHECK_URL=http://localhost:5173 LIVECHART_SYMBOL=BTC node scripts/livechart-check.mjs
 *   LIVECHART_LOCALE=en-US@posix node scripts/livechart-check.mjs   # LANG=C/POSIX container case
 *
 * Exit code: 0 = healthy, 1 = problems (CI friendly). Screenshots + a JSON
 * report land in logs/livechart-check/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODE = process.argv[2] === 'real' ? 'real' : 'mock';
const BASE = (process.env.UI_CHECK_URL || 'http://localhost:5173').replace(/\/$/, '');
const SYMBOL = process.env.LIVECHART_SYMBOL || 'BTC';
const LOCALE = process.env.LIVECHART_LOCALE || null; // null = browser default
const OUT = path.resolve(HERE, '../../logs/livechart-check');
fs.mkdirSync(OUT, { recursive: true });

// ── synthetic market data (deterministic) ────────────────────────────────────
const IST_OFFSET_MS = 5.5 * 3600 * 1000;
const pad = (n) => String(n).padStart(2, '0');
/** backend intraday rows carry IST wall-clock strings: 'YYYY-MM-DD HH:MM:SS' */
const istString = (ms) => {
  const d = new Date(ms + IST_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

function makeRows({ intervalSec, count, endBucketSec, startPrice = 60000, seed = 12345 }) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const rows = [];
  let prevClose = startPrice;
  const start = endBucketSec - (count - 1) * intervalSec;
  for (let i = 0; i < count; i++) {
    const tMs = (start + i * intervalSec) * 1000;
    const open = prevClose;
    const close = Math.max(1, open + (rnd() - 0.5) * 0.003 * open);
    const high = Math.max(open, close) * (1 + rnd() * 0.0008);
    const low = Math.min(open, close) * (1 - rnd() * 0.0008);
    rows.push({
      date: istString(tMs),
      open: +open.toFixed(2), high: +high.toFixed(2), low: +low.toFixed(2), close: +close.toFixed(2),
      volume: Math.round(20 + rnd() * 500),
    });
    prevClose = close;
  }
  return rows;
}

/** Mirrors the real backend's enriched columns (71 cols; `rsi` is the catalog field). */
function withIndicators(rows) {
  let sum = 0;
  return rows.map((r, i) => {
    sum += r.close;
    if (i >= 20) sum -= rows[i - 20].close;
    const n = Math.min(20, i + 1);
    return { ...r, sma_20: +(sum / n).toFixed(2), rsi: +(50 + (i % 20)).toFixed(2) };
  });
}

// ── reporting ────────────────────────────────────────────────────────────────
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok: !!ok, detail: String(detail ?? '') });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};
const info = (msg) => console.log(`   · ${msg}`);

const consoleErrors = [];
const pageErrors = [];
const failedRequests = [];
const badResponses = [];
const mockHistoryCalls = [];
const mockCursorCounts = {};

const APP_ORIGIN = new URL(BASE).origin;
const sameOrigin = (u) => { try { return new URL(u).origin === APP_ORIGIN; } catch { return false; } };

async function launchBrowser() {
  // Explicit executable first (CI images / sandboxes often ship Chrome at a
  // non-standard path), then system Chrome, then the Playwright bundle.
  const attempts = [
    process.env.UI_CHECK_CHROMIUM ? { executablePath: process.env.UI_CHECK_CHROMIUM, headless: true } : null,
    { channel: 'chrome', headless: true },
    { headless: true },
    { headless: true, args: ['--no-sandbox', '--no-zygote', '--single-process', '--disable-dev-shm-usage'] },
  ].filter(Boolean);
  let lastErr;
  for (const opts of attempts) {
    try {
      return await chromium.launch({
        ...opts,
        args: [...(opts.args || []), '--no-sandbox', '--disable-dev-shm-usage'],
      });
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
    userAgent: 'StockOracle-LiveChartCheck/1.0',
    timezoneId: 'Asia/Kolkata',
    ...(LOCALE ? { locale: LOCALE } : {}),
  });
  const page = await context.newPage();

  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ text: m.text(), url: m.location()?.url ?? '' }); });
  page.on('pageerror', (e) => pageErrors.push(String(e).split('\n')[0]));
  page.on('requestfailed', (r) => failedRequests.push({ url: r.url(), failure: r.failure()?.errorText ?? 'unknown', sameOrigin: sameOrigin(r.url()) }));
  page.on('response', (r) => { if (r.status() >= 400) badResponses.push({ url: r.url(), status: r.status(), sameOrigin: sameOrigin(r.url()) }); });

  // ── market-data + /ws mocks (mock pass only) ───────────────────────────────
  const endBucketSec = Math.floor(Date.now() / 1000 / 60) * 60;
  const byInterval = {};
  const seriesFor = (intervalSec, count) => {
    const key = `${intervalSec}:${count}`;
    if (!byInterval[key]) byInterval[key] = makeRows({ intervalSec, count, endBucketSec: Math.floor(endBucketSec / intervalSec) * intervalSec });
    return byInterval[key];
  };
  const slim = (rows) => rows.map(({ date, open, high, low, close, volume }) => ({ date, open, high, low, close, volume }));

  if (MODE === 'mock') {
    await page.route('**/api/**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const m = url.pathname.match(/^\/api\/stock\/([^/]+)\/(history|info)$/);
      if (!m) return route.continue();
      const sym = decodeURIComponent(m[1]).toUpperCase();

      if (m[2] === 'info') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ticker: sym, name: 'Bitcoin', sector: 'Crypto', exchange: 'BINANCE',
            current_price: seriesFor(60, 400).at(-1).close, currency: 'USD', data_source: 'mock',
          }),
        });
      }

      const interval = (url.searchParams.get('interval') || '1m').toLowerCase();
      const slimReq = url.searchParams.get('slim') === 'true';
      const before = url.searchParams.get('before');
      const limit = Number(url.searchParams.get('limit') || 0);
      const intervalSec = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[interval] || 60;
      const isDaily = interval === '1d';
      const endSec = Math.floor(endBucketSec / intervalSec) * intervalSec;

      let data; let hasMore = false;
      if (before != null) {
        mockCursorCounts[interval] = (mockCursorCounts[interval] || 0) + 1;
        const firstCall = mockCursorCounts[interval] === 1;
        const n = firstCall ? Math.min(limit || 300, 300) : 40;
        // cursor arrives as epoch seconds intraday ('YYYY-MM-DD[ HH:MM:SS]' daily)
        const rawBefore = String(before);
        const beforeMs = /^\d+(\.\d+)?$/.test(rawBefore)
          ? (Number(rawBefore) > 1e12 ? Number(rawBefore) : Number(rawBefore) * 1000)
          : Date.parse(`${rawBefore.replace(' ', 'T').slice(0, 19)}+05:30`);
        const endSecCursor = Number.isFinite(beforeMs)
          ? Math.floor((beforeMs - 1) / 1000 / intervalSec) * intervalSec
          : endSec - intervalSec;
        data = makeRows({ intervalSec, count: n, endBucketSec: endSecCursor, startPrice: 59000, seed: 777 });
        hasMore = firstCall;
        mockHistoryCalls.push({ interval, kind: 'cursor', limit: limit || null, before, returned: data.length, hasMore });
      } else {
        const rows = seriesFor(intervalSec, isDaily ? 400 : 600);
        data = slimReq ? slim(rows) : withIndicators(rows);
        mockHistoryCalls.push({ interval, kind: slimReq ? 'slim' : 'full', returned: data.length });
      }

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-Data-Source': 'mock' },
        body: JSON.stringify({ data, data_source: 'mock', has_more: hasMore }),
      });
    });

    await page.addInitScript(({ symbol, price }) => {
      const Mock = class MockWebSocket {
        static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
        constructor(url) {
          this.url = String(url);
          this.readyState = 0;
          this.onopen = this.onmessage = this.onclose = this.onerror = null;
          this._l = {};
          if (this.url.includes('binance')) {
            setTimeout(() => { this.readyState = 3; this.onclose?.({ wasClean: false }); }, 20);
            return;
          }
          setTimeout(() => { this.readyState = 1; this.onopen?.({}); this._startTicks(); }, 20);
        }
        addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
        removeEventListener(t, fn) { this._l[t] = (this._l[t] || []).filter((f) => f !== fn); }
        send() {}
        close() { this.readyState = 3; this.onclose?.({ wasClean: true }); }
        _fire(type, ev) { this[`on${type}`]?.(ev); (this._l[type] || []).forEach((fn) => fn(ev)); }
        _startTicks() {
          let p = price;
          let bucket = Math.floor(Date.now() / 1000 / 60) * 60;
          let barOpen = p; let high = p; let low = p; let vol = 12;
          window.__mockTicks = window.__mockTicks || [];
          window.__mockRollBucket = () => { bucket += 60; barOpen = p; high = p; low = p; vol = 0; };
          const emit = () => {
            p = +(p + (Math.random() - 0.5) * 8).toFixed(2);
            high = Math.max(high, p); low = Math.min(low, p); vol += 3;
            const tick = {
              type: 'tick', ticker: symbol, price: p, open: barOpen, high, low,
              close: p, change_pct: +(((p - barOpen) / barOpen) * 100).toFixed(2),
              volume: vol, is_live: true,
              liveCandle: { time: bucket, open: barOpen, high, low, close: p, volume: vol },
            };
            window.__mockTicks.push(tick);
            this._fire('message', { data: JSON.stringify(tick) });
          };
          this._timer = setInterval(emit, 250);
        }
      };
      window.WebSocket = Mock;
    }, { symbol: SYMBOL, price: 60000 });
  }

  // ── 1. load the tab ────────────────────────────────────────────────────────
  console.log(`\n=== Live Chart check (${MODE}${LOCALE ? `, locale ${LOCALE}` : ''}) → ${BASE} ===\n`);
  const nav = await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  const hydrated = await page
    .waitForFunction(() => !document.getElementById('init-loader') || Boolean(document.getElementById('error-display')), { timeout: 20000 })
    .then(() => true).catch(() => false);
  const crash = await page.evaluate(() => document.getElementById('error-display')?.innerText?.slice(0, 500) || null);
  check('app hydrates', hydrated && !crash, crash ? `crash overlay: ${crash}` : `HTTP ${nav?.status()}`);
  await page.waitForTimeout(3000);

  // Chart-area scope: .app-main holds the chart view only (the top bar ticker
  // tape and the left nav rail would otherwise pollute the status-line text).
  const readLegend = () => page.evaluate(() => {
    const scope = document.querySelector('.app-main') || document.body;
    const leaf = [];
    scope.querySelectorAll('span').forEach((s) => {
      const t = (s.textContent || '').trim();
      if (t && s.children.length === 0) leaf.push(t);
    });
    return {
      texts: leaf.slice(0, 40),
      body: (scope.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
      canvases: scope.querySelectorAll('canvas').length,
    };
  });

  const legend = await readLegend();
  const legendJoined = legend.texts.join(' ');
  check('candles load (OHLC status line populated)',
    /[$₹]\s?[\d,]+\.\d/.test(legendJoined) && !/\bO\s?—/.test(legendJoined),
    legend.texts.slice(0, 12).join(' | '));
  check('chart canvas mounted', legend.canvases > 0, `${legend.canvases} canvas`);
  await page.screenshot({ path: path.join(OUT, `${MODE}-01-loaded.png`) });

  if (MODE === 'mock') {
    info(`history calls: ${JSON.stringify(mockHistoryCalls)}`);
    check('staged load requests the slim frame first', mockHistoryCalls[0]?.kind === 'slim', JSON.stringify(mockHistoryCalls[0] || {}));
    check('full enriched frame requested after slim', mockHistoryCalls.some((c) => c.kind === 'full'));

    // ── 2. live ticks move the active candle + toolbar badge ────────────────
    const before = await page.evaluate(() => (window.__mockTicks || []).length);
    await page.waitForTimeout(2600);
    // Ticks are rAF-coalesced and headless Chrome throttles rAF, so the legend
    // can legitimately sit a tick or two behind the very latest stream value.
    // The invariant that matters: the chart's active close is a RECENT tick
    // (a stale seeded history frame would match nothing) and it keeps moving.
    const samples = [];
    for (let i = 0; i < 3; i++) {
      samples.push(await page.evaluate(() => {
        const scope = document.querySelector('.app-main') || document.body;
        const joined = Array.from(scope.querySelectorAll('span')).map((s) => (s.textContent || '').trim()).join(' ');
        const closeMatch = joined.match(/C\s*([$₹]?[\d,]+\.\d+)/);
        return {
          legendClose: closeMatch ? Number(closeMatch[1].replace(/[^0-9.]/g, '')) : null,
          recentTicks: (window.__mockTicks || []).slice(-8).map((t) => t.price),
          tickCount: (window.__mockTicks || []).length,
        };
      }));
      await page.waitForTimeout(1200);
    }
    const last = samples[samples.length - 1];
    const distinctCloses = new Set(samples.map((s) => s.legendClose)).size;
    check('live ticks received on the /ws feed', last.tickCount > before, `${before} → ${last.tickCount} ticks`);
    check('active candle close tracks the live tick stream (render-free tick path)',
      last.legendClose != null && last.recentTicks.some((p) => Math.abs(p - last.legendClose) <= 0.02),
      `legend C=${last.legendClose} vs recent ticks ${last.recentTicks.slice(-3).join(', ')}`);
    check('active candle close keeps advancing with the stream (not frozen)',
      distinctCloses > 1, `${samples.map((s) => s.legendClose).join(' → ')}`);
    await page.screenshot({ path: path.join(OUT, `${MODE}-02-live-ticks.png`) });

    // ── 3. bucket rollover appends a new bar ────────────────────────────────
    const t1 = ((await readLegend()).texts.join(' ').match(/\b\d{2}:\d{2}\b/) || [])[0];
    await page.evaluate(() => window.__mockRollBucket?.());
    await page.waitForTimeout(1600);
    const t2 = ((await readLegend()).texts.join(' ').match(/\b\d{2}:\d{2}\b/) || [])[0];
    check('1m bucket rollover spawns a new active bar', !!t2 && t1 !== t2, `${t1} → ${t2}`);
    await page.screenshot({ path: path.join(OUT, `${MODE}-03-rollover.png`) });

    // ── 4. left-pan backfill (cursor API, no duplicate edge fetch) ──────────
    const panBox = await page.locator('canvas').first().boundingBox();
    const hoverClock = async () => {
      if (!panBox) return null;
      await page.mouse.move(panBox.x + panBox.width * 0.5, panBox.y + panBox.height * 0.5);
      await page.waitForTimeout(350);
      const t = (await readLegend()).texts.join(' ');
      return (t.match(/\b\d{2}:\d{2}\b/g) || []).join(',');
    };
    if (panBox) {
      for (let i = 0; i < 8; i++) {
        await page.mouse.move(panBox.x + panBox.width * 0.25, panBox.y + panBox.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(panBox.x + panBox.width * 0.95, panBox.y + panBox.height * 0.5, { steps: 14 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        await page.mouse.move(panBox.x + panBox.width * 0.5, panBox.y + 5);
      }
      await page.waitForTimeout(2500);
      const cursorCalls = mockHistoryCalls.filter((c) => c.kind === 'cursor' && c.interval === '1m');
      const dupes = cursorCalls.length - new Set(cursorCalls.map((c) => String(c.before))).size;
      check('left-pan backfill calls the cursor API', cursorCalls.length > 0, JSON.stringify(cursorCalls.slice(0, 2)));
      check('same backfill edge is not refetched (single-flight + range cache)', dupes === 0,
        `${cursorCalls.length} cursor call(s), ${dupes} duplicate edge(s)`);
      const hoveredAfterPan = await hoverClock();
      const liveEdgeClock = new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(11, 16);
      check('viewport stays in history after the backfill', !!hoveredAfterPan && hoveredAfterPan !== liveEdgeClock,
        `hovered ${hoveredAfterPan} vs live edge ${liveEdgeClock}`);
      await page.screenshot({ path: path.join(OUT, `${MODE}-04-backfill.png`) });
    }

    // ── 5. interval switch (5m) ─────────────────────────────────────────────
    await page.click('[title="Timeframe"]');
    await page.waitForSelector('[title^="Switch to 5 minutes"]', { timeout: 5000 });
    await page.click('[title^="Switch to 5 minutes"]');
    await page.waitForTimeout(3000);
    const legend5 = await readLegend();
    const calls5 = mockHistoryCalls.filter((c) => c.interval === '5m');
    check('interval switch refetches + repaints (5m)', calls5.length > 0 && !/\bO\s?—/.test(legend5.texts.join(' ')),
      `${calls5.length} call(s)`);
    check('interval switch repaints on the new timeframe label', /5M/.test(legend5.texts.join(' ')));
    await page.screenshot({ path: path.join(OUT, `${MODE}-05-interval-5m.png`) });

    // ── 6. crosshair hover updates the status line ──────────────────────────
    const box = await page.locator('canvas').first().boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(600);
      const hovered = await readLegend();
      check('crosshair hover updates the status line', hovered.texts.join(' ') !== legend5.texts.join(' '),
        hovered.texts.slice(0, 10).join(' | '));
    }

    // ── 7. modals + oscillator pane ─────────────────────────────────────────
    await page.click('[title="Chart settings"]');
    await page.waitForTimeout(500);
    const settingsOpen = await page.getByText('Chart settings', { exact: false }).count() > 0
      || await page.getByText('Chart Settings', { exact: false }).count() > 0;
    await page.screenshot({ path: path.join(OUT, `${MODE}-06-settings-modal.png`) });
    check('chart settings modal opens', settingsOpen);
    await page.getByRole('button', { name: /^Cancel$/ }).first().click();
    await page.waitForTimeout(600);

    const canvasesBefore = (await readLegend()).canvases;
    await page.click('[title="Indicators, metrics and strategies"]');
    await page.waitForTimeout(600);
    check('indicator library modal opens', await page.getByText('Indicators', { exact: false }).count() > 0);
    await page.screenshot({ path: path.join(OUT, `${MODE}-07-indicators-modal.png`) });
    await page.keyboard.type('rsi');
    await page.waitForTimeout(400);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1500);
    const afterRsi = await readLegend();
    check('RSI added from the indicator library renders a sub-pane',
      /RSI/.test(afterRsi.texts.join(' ')) && afterRsi.canvases > canvasesBefore,
      `legend rows: ${afterRsi.texts.filter((t) => /RSI/.test(t)).join(',') || 'none'}; canvas ${canvasesBefore} → ${afterRsi.canvases}`);
    await page.screenshot({ path: path.join(OUT, `${MODE}-08-rsi-pane.png`) });
  } else {
    info(`status line: ${legend.texts.slice(0, 12).join(' | ')}`);
  }

  // ── 8. error accounting ───────────────────────────────────────────────────
  // Console errors for off-origin sockets (upstream Binance feeds blocked by
  // the sandbox/CI network) are expected here — only app-origin noise fails.
  const externalHostIn = (text) => (String(text).match(/wss?:\/\/[^\s'"]+/g) || []).some((u) => !sameOrigin(u));
  const appConsole = consoleErrors.filter((e) => (!e.url || sameOrigin(e.url)) && !externalHostIn(e.text));
  const extConsole = consoleErrors.filter((e) => !appConsole.includes(e));
  const appFailed = failedRequests.filter((r) => r.sameOrigin && !r.failure.includes('ERR_ABORTED'));
  const appBad = badResponses.filter((r) => r.sameOrigin);
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  check('no app console errors', appConsole.length === 0, appConsole.slice(0, 3).map((e) => e.text).join(' | '));
  check('no failed same-origin requests', appFailed.length === 0, appFailed.slice(0, 3).map((r) => `${r.url} ${r.failure}`).join(' | '));
  check('no HTTP >= 400 from the app', appBad.length === 0, appBad.slice(0, 3).map((r) => `${r.status} ${r.url}`).join(' | '));
  if (extConsole.length) info(`external warnings (upstream feeds blocked here): ${extConsole.length}`);

  const failed = checks.filter((c) => !c.ok);
  fs.writeFileSync(path.join(OUT, `${MODE}-report.json`), JSON.stringify({
    mode: MODE, base: BASE, locale: LOCALE, at: new Date().toISOString(),
    pass: checks.length - failed.length, fail: failed.length,
    checks, mockHistoryCalls, statusLine: legend.texts.slice(0, 16),
    consoleErrors: appConsole, pageErrors, failedRequests: appFailed, badResponses: appBad,
  }, null, 2));
  console.log(`\n${failed.length ? `❌ FAIL (${failed.length}/${checks.length})` : `✅ PASS (${checks.length} checks)`} — screenshots + report in ${OUT}`);
  process.exitCode = failed.length ? 1 : 0;
} finally {
  await browser.close();
}
