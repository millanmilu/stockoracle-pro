import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_FACTORY_DEFAULTS,
  applyToSameTypeDrawings,
  getToolFactoryDefault,
  groupDrawings,
  toStorableSettings,
  ungroupDrawings,
} from '../components/chart-tools/drawingToolDefaults.js';
import { ACTION_SHORTCUTS, resolveShortcut } from '../components/chart-tools/drawingToolCatalog.js';
import { drawingDefaults } from '../components/chart-tools/drawingSettingsSchema.js';

test('factory defaults give shapes a fill and lines sane extension', () => {
  const rect = getToolFactoryDefault('rectangle');
  assert.equal(rect.backgroundVisible, true);
  assert.equal(rect.backgroundOpacity, 0.15);
  assert.equal(getToolFactoryDefault('trendline').extendRight, false);
  assert.equal(getToolFactoryDefault('ray').extendRight, true);
  assert.equal(getToolFactoryDefault('extended_line').extendLeft, true);
  assert.ok(Array.isArray(getToolFactoryDefault('fibonacci').fibLevelsVisible));
});

test('factory defaults never hardcode the active line style', () => {
  // Exception: brush/highlighter carry tool-defining width+opacity (a 1px
  // opaque highlighter is not a highlighter) — everything else inherits
  // the user's last-used active style.
  const EXCEPTIONS = new Set(['brush', 'highlighter']);
  for (const [type] of Object.entries(TOOL_FACTORY_DEFAULTS)) {
    const f = getToolFactoryDefault(type);
    assert.equal(f.color, undefined, `${type} must inherit the active color`);
    assert.equal(f.lineStyle, undefined, `${type} must inherit the active style`);
    if (!EXCEPTIONS.has(type)) {
      assert.equal(f.strokeWidth, undefined, `${type} must inherit the active width`);
    }
  }
  assert.equal(getToolFactoryDefault('highlighter').opacity, 0.5);
  assert.equal(getToolFactoryDefault('highlighter').strokeWidth, 4);
});

test('user-saved tool defaults win over the factory template', () => {
  const previous = globalThis.localStorage;
  const values = new Map();
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  try {
    values.set(
      'stockoracle_drawing_settings_tv_v1',
      JSON.stringify({ toolDefaults: { rectangle: { backgroundOpacity: 0.4 } } }),
    );
    const d = drawingDefaults('rectangle');
    assert.equal(d.backgroundOpacity, 0.4); // saved wins
    assert.equal(d.borderVisible, true); // factory fills the rest
    assert.equal(drawingDefaults('trendline').extendRight, false);
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});

test('toStorableSettings strips identity and geometry keys', () => {
  const stored = toStorableSettings({
    id: 1, type: 'rectangle', points: [{ x: 1, y: 2 }], color: '#123456',
    strokeWidth: 3, startLogical: 5, tf: '5m', locked: true, groupId: 'g1',
  });
  assert.deepEqual(stored, { color: '#123456', strokeWidth: 3 });
});

test('apply/group/ungroup helpers are pure and type-scoped', () => {
  const drawings = [
    { id: 1, type: 'rectangle', color: 'a' },
    { id: 2, type: 'trendline', color: 'a' },
    { id: 3, type: 'rectangle', color: 'a' },
  ];
  const patched = applyToSameTypeDrawings(drawings, 'rectangle', { color: 'b' });
  assert.equal(patched[0].color, 'b');
  assert.equal(patched[1].color, 'a');
  assert.equal(drawings[0].color, 'a'); // input untouched

  const grouped = groupDrawings(drawings, [1, 3]);
  assert.ok(grouped[0].groupId);
  assert.equal(grouped[0].groupId, grouped[2].groupId);
  assert.equal(grouped[1].groupId, undefined);

  const ungrouped = ungroupDrawings(grouped, [1, 3]);
  assert.equal(ungrouped[0].groupId, null);
  assert.equal(grouped[0].groupId.startsWith('grp_'), true); // input untouched
});

test('remove-all and rotated-rectangle shortcuts do not collide with replay', () => {
  assert.equal(ACTION_SHORTCUTS.removeAll, 'Alt+Shift+R');
  assert.equal(resolveShortcut('r', { alt: true, shift: true }), null);
  assert.equal(resolveShortcut('w', { alt: true, shift: true }), 'rotated_rectangle');
});

test('pointer cross shortcut does not collide with volume profile', () => {
  assert.equal(resolveShortcut('f', { alt: true, shift: true }), 'cross');
  assert.equal(resolveShortcut('v', { alt: true }), null);
  assert.equal(resolveShortcut('v', { alt: true, shift: true }), 'fixed_range_volume_profile');
});
