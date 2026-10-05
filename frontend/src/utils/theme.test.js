/**
 * Unit tests for the shared Chart Base Options (utils/theme.js).
 * Run with: node --test src/utils/theme.test.js  (Node >= 18, no deps needed)
 *
 * Regression guard for the locale trap: Lightweight Charts defaults
 * `localization.locale` to the RAW `navigator.language` and its default
 * tick-mark formatter passes that string to `Date.toLocaleString(locale, …)`.
 * A browser on a POSIX/`LANG=C` Linux container reports `en-US@posix`, which is
 * not a valid ICU tag → RangeError thrown from inside the pane's React effect →
 * the whole terminal unmounts. Charts that pass no `tickMarkFormatter`
 * (volume + oscillator panes) rely on this base options object, so it MUST pin
 * a valid locale.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHART_ICU_LOCALE, getChartBaseOptions } from './theme.js';

describe('getChartBaseOptions — pinned chart locale', () => {
  it('pins a valid ICU locale instead of falling back to navigator.language', () => {
    for (const theme of ['dark', 'light']) {
      const opts = getChartBaseOptions(theme);
      assert.equal(opts.localization.locale, CHART_ICU_LOCALE);
      // A malformed / missing tag would force Lightweight Charts onto the raw
      // browser locale — exactly the crash this guards against.
      assert.ok(opts.localization.locale, 'locale must be set (undefined = navigator.language)');
      assert.doesNotThrow(() => Intl.getCanonicalLocales(opts.localization.locale));
    }
  });

  it('locale is safe for the LWC default tick-mark formatter call', () => {
    // Mirrors defaultTickMarkFormatter(): toLocaleString(locale, {hour, minute})
    assert.doesNotThrow(() =>
      new Date(0).toLocaleString(CHART_ICU_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false }),
    );
  });

  it('keeps ISO-ish bar dates (matches the main chart dateFormat)', () => {
    assert.equal(getChartBaseOptions('dark').localization.dateFormat, 'yyyy-MM-dd');
  });

  it('still returns the theme-driven chart options the panes consume', () => {
    const opts = getChartBaseOptions('dark');
    assert.ok(opts.layout?.textColor, 'layout.textColor');
    assert.ok(opts.grid?.vertLines?.color, 'grid.vertLines.color');
    assert.ok(opts.crosshair?.mode === 0 || opts.crosshair?.mode >= 0, 'crosshair.mode');
    assert.ok(opts.timeScale?.textColor, 'timeScale.textColor');
    assert.ok(opts.rightPriceScale?.borderColor, 'rightPriceScale.borderColor');
  });
});
