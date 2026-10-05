import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_INTERVALS } from './chartHelpers.js';
import {
  VISIBILITY_INTERVALS,
  DRAWING_SETTINGS_STORAGE_KEY,
  drawingDefaults,
  getLineDashArray,
  getDrawingCaps,
  isDrawingVisibleOn,
  loadDrawingSettings,
  saveDrawingSettings,
} from '../components/chart-tools/drawingSettingsSchema.js';
import { DRAWING_TOOL_GROUPS } from '../components/chart-tools/drawingToolCatalog.js';

test('drawing visibility settings cover the chart-supported intervals', () => {
  assert.deepEqual(VISIBILITY_INTERVALS, [...SUPPORTED_INTERVALS, '1W', '1M']);
});

test('drawing visibility defaults to all intervals and honors selected intervals', () => {
  const drawing = { type: 'trendline', ...drawingDefaults('trendline') };
  assert.equal(isDrawingVisibleOn(drawing, '1m'), true);
  assert.equal(isDrawingVisibleOn({ ...drawing, visibleIntervals: ['1m'] }, '1m'), true);
  assert.equal(isDrawingVisibleOn({ ...drawing, visibleIntervals: ['1m'] }, '5m'), false);
  assert.equal(isDrawingVisibleOn({ ...drawing, visibleIntervals: ['1D'] }, '1d'), true);
});

test('every catalog drawing resolves settings capabilities', () => {
  for (const group of DRAWING_TOOL_GROUPS) {
    for (const tool of group.tools) assert.equal(getDrawingCaps(tool.id).visibility, true, tool.id);
  }
});

test('tool defaults and saved palette persist through the drawing settings store', () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  try {
    saveDrawingSettings({
      toolDefaults: { rectangle: { color: '#123456', strokeWidth: 4, backgroundOpacity: 0.4 } },
      savedColors: ['#123456'],
      recentColors: ['#ABCDEF'],
    });
    assert.equal(drawingDefaults('rectangle').color, '#123456');
    assert.equal(drawingDefaults('rectangle').strokeWidth, 4);
    assert.equal(loadDrawingSettings().savedColors[0], '#123456');
    assert.ok(values.has(DRAWING_SETTINGS_STORAGE_KEY));
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test('drawing line styles map to distinct dash patterns', () => {
  const styles = ['solid', 'dashed', 'dotted', 'dash_dot', 'long_dash'].map((style) => getLineDashArray(style, 2));
  assert.equal(styles[0], undefined);
  assert.equal(new Set(styles.slice(1)).size, 4);
});
