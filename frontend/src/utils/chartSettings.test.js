/**
 * Unit tests for the TradingView-parity chart settings store.
 * Run with: node --test src/utils/chartSettings.test.js  (Node >= 18, no deps needed)
 *
 * The store is what keeps Chart Settings alive across chart rebuilds, so the
 * contract under test is: merge → persist → notify, plus the option builders
 * ChartCanvas / the panes feed into lightweight-charts.
 */
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHART_SETTINGS_STORAGE_KEY,
  DEFAULT_CHART_SETTINGS,
  loadChartSettings,
  saveChartSettings,
  resetChartSettings,
  subscribeChartSettings,
  invalidateChartSettingsCache,
  buildChartOptions,
  buildSeriesOptions,
  applyScalePlacement,
  applyPaneChartOptions,
  resolvePrecision,
  hexToRgba,
} from './chartSettings.js';

/** Minimal localStorage stand-in (node has none). */
function installLocalStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  globalThis.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
  return map;
}

beforeEach(() => {
  installLocalStorage();
  invalidateChartSettingsCache();
});

describe('loadChartSettings', () => {
  it('returns every default when storage is empty', () => {
    const s = loadChartSettings();
    for (const [k, v] of Object.entries(DEFAULT_CHART_SETTINGS)) {
      assert.deepEqual(s[k], v, `default mismatch for ${k}`);
    }
  });

  it('merges saved overrides over defaults (no lost keys)', () => {
    installLocalStorage({
      [CHART_SETTINGS_STORAGE_KEY]: JSON.stringify({ upColor: '#123456', showOHLC: false, precision: 4 }),
    });
    invalidateChartSettingsCache();
    const s = loadChartSettings();
    assert.equal(s.upColor, '#123456');
    assert.equal(s.showOHLC, false);
    assert.equal(s.precision, 4);
    // Untouched keys still come from the defaults.
    assert.equal(s.downColor, DEFAULT_CHART_SETTINGS.downColor);
    assert.equal(s.crosshairMode, DEFAULT_CHART_SETTINGS.crosshairMode);
  });

  it('survives corrupt storage instead of throwing', () => {
    installLocalStorage({ [CHART_SETTINGS_STORAGE_KEY]: '{not json' });
    invalidateChartSettingsCache();
    assert.deepEqual(loadChartSettings(), { ...DEFAULT_CHART_SETTINGS });
  });

  it('backfills Trading-tab keys onto settings saved before they existed', () => {
    installLocalStorage({
      [CHART_SETTINGS_STORAGE_KEY]: JSON.stringify({ upColor: '#123456' }),
    });
    invalidateChartSettingsCache();
    const s = loadChartSettings();
    assert.equal(s.showTradeButton, DEFAULT_CHART_SETTINGS.showTradeButton);
    assert.equal(s.showTradeDocket, DEFAULT_CHART_SETTINGS.showTradeDocket);
    assert.equal(s.showPositionLines, DEFAULT_CHART_SETTINGS.showPositionLines);
  });
});

describe('saveChartSettings / resetChartSettings', () => {
  it('persists the merged object and notifies subscribers (immediate + change)', async () => {
    const store = globalThis.localStorage;
    const seen = [];
    const unsubscribe = subscribeChartSettings((s) => seen.push(s.upColor));
    assert.equal(seen.length, 1, 'subscriber must fire immediately with current values');

    saveChartSettings({ upColor: '#AABBCC' });
    assert.equal(JSON.parse(store.getItem(CHART_SETTINGS_STORAGE_KEY)).upColor, '#AABBCC', 'the write is synchronous even though the broadcast is coalesced');
    assert.equal(seen.length, 1, 'change notifications are coalesced on a trailing edge');
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(seen.length, 2);
    assert.equal(seen[1], '#AABBCC');

    const persisted = JSON.parse(store.getItem(CHART_SETTINGS_STORAGE_KEY));
    assert.equal(persisted.upColor, '#AABBCC');
    assert.equal(persisted.showWicks, DEFAULT_CHART_SETTINGS.showWicks, 'unrelated keys survive a patch');

    unsubscribe();
    saveChartSettings({ upColor: '#000000' });
    await new Promise((r) => setTimeout(r, 90));
    assert.equal(seen.length, 2, 'unsubscribed listener must not fire again');
  });

  it('reset restores defaults and clears storage', () => {
    saveChartSettings({ upColor: '#AABBCC', showWatermark: true });
    const seen = [];
    const unsubscribe = subscribeChartSettings((s) => seen.push(s));

    const after = resetChartSettings();
    assert.deepEqual(after, { ...DEFAULT_CHART_SETTINGS });
    assert.equal(globalThis.localStorage.getItem(CHART_SETTINGS_STORAGE_KEY), null);
    assert.deepEqual(seen[seen.length - 1], { ...DEFAULT_CHART_SETTINGS });

    unsubscribe();
    invalidateChartSettingsCache();
    assert.deepEqual(loadChartSettings(), { ...DEFAULT_CHART_SETTINGS });
  });
});

describe('buildChartOptions', () => {
  it('falls back to the app theme when a color is untouched (null)', () => {
    const dark = buildChartOptions({ ...DEFAULT_CHART_SETTINGS }, 'dark');
    const light = buildChartOptions({ ...DEFAULT_CHART_SETTINGS }, 'light');
    assert.equal(dark.grid.vertLines.color, '#1E222D');
    assert.equal(light.grid.vertLines.color, '#F0F3FA');
    assert.equal(dark.layout.background.color, 'transparent', 'theme mode = transparent background');
  });

  it('honours a custom solid background', () => {
    const opts = buildChartOptions({ ...DEFAULT_CHART_SETTINGS, bgMode: 'custom', bgColor: '#FF0000' }, 'dark');
    assert.equal(opts.layout.background.color, '#FF0000');
  });

  it('maps crosshair mode/style strings to lightweight-charts enums', () => {
    // CrosshairMode: Normal 0, Magnet 1, Hidden 2 — LineStyle: Solid 0, Dotted 1, Dashed 2
    const magnet = buildChartOptions({ ...DEFAULT_CHART_SETTINGS, crosshairMode: 'magnet', crosshairStyle: 'solid' }, 'dark');
    assert.equal(magnet.crosshair.mode, 1);
    assert.equal(magnet.crosshair.vertLine.style, 0);

    const hidden = buildChartOptions({ ...DEFAULT_CHART_SETTINGS, crosshairMode: 'hidden', crosshairStyle: 'dotted' }, 'dark');
    assert.equal(hidden.crosshair.mode, 2);
    assert.equal(hidden.crosshair.horzLine.style, 1);

    const dashed = buildChartOptions({ ...DEFAULT_CHART_SETTINGS }, 'dark');
    assert.equal(dashed.crosshair.vertLine.style, 2);
  });

  it('flips scale visibility with Scale Axis Position', () => {
    const right = buildChartOptions({ ...DEFAULT_CHART_SETTINGS, priceScalePosition: 'right' }, 'dark');
    assert.equal(right.rightPriceScale.visible, true);
    assert.equal(right.leftPriceScale.visible, false);

    const left = buildChartOptions({ ...DEFAULT_CHART_SETTINGS, priceScalePosition: 'left' }, 'dark');
    assert.equal(left.rightPriceScale.visible, false);
    assert.equal(left.leftPriceScale.visible, true);
    assert.ok(left.leftPriceScale.minimumWidth > 0, 'left scale must reserve axis width like the right one');
  });

  it('drops grid lines and crosshair labels when toggled off', () => {
    const opts = buildChartOptions(
      { ...DEFAULT_CHART_SETTINGS, showVertGrid: false, showHorzGrid: false, showCrosshairLabels: false },
      'dark',
    );
    assert.equal(opts.grid.vertLines.visible, false);
    assert.equal(opts.grid.horzLines.visible, false);
    assert.equal(opts.crosshair.vertLine.labelVisible, false);
    assert.equal(opts.crosshair.horzLine.labelVisible, false);
  });
});

describe('buildSeriesOptions', () => {
  it('candlestick carries colors, wick/border toggles and last-value flags', () => {
    const opts = buildSeriesOptions(
      { ...DEFAULT_CHART_SETTINGS, upColor: '#010203', showWicks: false, showLastValue: false, showPriceLine: false },
      'candlestick',
    );
    assert.equal(opts.upColor, '#010203');
    assert.equal(opts.wickVisible, false);
    assert.equal(opts.lastValueVisible, false);
    assert.equal(opts.priceLineVisible, false);
    assert.equal(opts.priceLineStyle, 2, 'dashed price line by default');
  });

  it('hollow candles keep an open up body (border/wick colors draw the outline)', () => {
    const opts = buildSeriesOptions(
      { ...DEFAULT_CHART_SETTINGS, borderUpColor: '#ABCDEF', wickUpColor: '#ABCDEF' },
      'hollow',
    );
    assert.equal(opts.upColor, 'transparent');
    assert.equal(opts.borderUpColor, '#ABCDEF');
    assert.equal(opts.wickUpColor, '#ABCDEF');
  });

  it('line styles derive their fills from the line color', () => {
    const line = buildSeriesOptions({ ...DEFAULT_CHART_SETTINGS, lineColor: '#FF0000' }, 'line');
    assert.equal(line.color, '#FF0000');

    const area = buildSeriesOptions({ ...DEFAULT_CHART_SETTINGS, lineColor: '#FF0000' }, 'area');
    assert.equal(area.lineColor, '#FF0000');
    assert.equal(area.topColor, 'rgba(255, 0, 0, 0.28)');
    assert.match(area.bottomColor, /^rgba\(255, 0, 0, 0\.0/);

    const baseline = buildSeriesOptions(
      { ...DEFAULT_CHART_SETTINGS, upColor: '#111111', downColor: '#222222' },
      'baseline',
    );
    assert.equal(baseline.topLineColor, '#111111');
    assert.equal(baseline.bottomLineColor, '#222222');
  });

  it('bar series only expose up/down colors', () => {
    const opts = buildSeriesOptions({ ...DEFAULT_CHART_SETTINGS, upColor: '#333333', downColor: '#444444' }, 'bar');
    assert.equal(opts.upColor, '#333333');
    assert.equal(opts.downColor, '#444444');
    assert.equal(opts.wickVisible, undefined, 'bars have no wicks to toggle');
  });
});

describe('resolvePrecision', () => {
  it('passes auto through to the magnitude-aware value', () => {
    assert.equal(resolvePrecision({ ...DEFAULT_CHART_SETTINGS }, 0), 0);
    assert.equal(resolvePrecision({ precision: 'auto' }, 2), 2);
    assert.equal(resolvePrecision({ precision: null }, 1), 1);
  });

  it('honours an explicit decimal count and clamps nonsense', () => {
    assert.equal(resolvePrecision({ precision: 4 }, 0), 4);
    assert.equal(resolvePrecision({ precision: '3' }, 0), 3, 'string precision from a <select> is accepted');
    assert.equal(resolvePrecision({ precision: 99 }, 0), 8);
    assert.equal(resolvePrecision({ precision: -5 }, 0), 0);
    assert.equal(resolvePrecision({ precision: 'garbage' }, 7), 7);
  });
});

describe('hexToRgba', () => {
  it('expands 6- and 3-digit hex', () => {
    assert.equal(hexToRgba('#FFFFFF', 0.5), 'rgba(255, 255, 255, 0.5)');
    assert.equal(hexToRgba('#fff', 1), 'rgba(255, 255, 255, 1)');
  });

  it('passes non-hex values through untouched', () => {
    assert.equal(hexToRgba('rgba(1,2,3,0.4)', 0.2), 'rgba(1,2,3,0.4)');
    assert.equal(hexToRgba(null), null);
  });
});

describe('applyScalePlacement', () => {
  const makeChart = () => {
    const calls = [];
    return { __isDisposed: false, calls, applyOptions: (o) => calls.push(o) };
  };
  const makeSeries = () => {
    const calls = [];
    return { __isDisposed: false, calls, applyOptions: (o) => calls.push(o) };
  };

  it('keeps series on the right scale by default', () => {
    const chart = makeChart();
    const series = makeSeries();
    applyScalePlacement(chart, { ...DEFAULT_CHART_SETTINGS }, [series]);
    assert.equal(chart.calls[0].rightPriceScale.visible, true);
    assert.equal(series.calls[0].priceScaleId, 'right');
  });

  it('moves every series to the left scale when placement flips', () => {
    const chart = makeChart();
    const a = makeSeries();
    const b = makeSeries();
    applyScalePlacement(chart, { ...DEFAULT_CHART_SETTINGS, priceScalePosition: 'left' }, [a, [b]]);
    assert.equal(chart.calls[0].leftPriceScale.visible, true);
    assert.equal(a.calls[0].priceScaleId, 'left', 'array-wrapped series must be flattened');
    assert.equal(b.calls[0].priceScaleId, 'left');
  });

  it('never touches a disposed chart or series', () => {
    applyScalePlacement({ __isDisposed: true, applyOptions: () => assert.fail('disposed chart touched') }, null, []);
    const disposedSeries = { __isDisposed: true, applyOptions: () => assert.fail('disposed series touched') };
    applyScalePlacement(makeChart(), { ...DEFAULT_CHART_SETTINGS }, [disposedSeries, null, undefined]);
  });
});

describe('applyPaneChartOptions', () => {
  it('syncs a stacked pane with the main plot (theme text + scale side)', () => {
    const calls = [];
    const chart = { __isDisposed: false, applyOptions: (o) => calls.push(o) };
    const series = { __isDisposed: false, applyOptions: () => {} };

    applyPaneChartOptions(chart, { ...DEFAULT_CHART_SETTINGS, priceScalePosition: 'left', axisFontSize: 13 }, 'light', [series]);

    const pane = calls[0];
    assert.equal(pane.layout.textColor, '#787B86');
    assert.equal(pane.layout.fontSize, 13);
    // Scale visibility comes from applyScalePlacement, which runs in the same call.
    const placement = calls[calls.length - 1];
    assert.equal(placement.leftPriceScale.visible, true);
  });
});
