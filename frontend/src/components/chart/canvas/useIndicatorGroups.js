import { useMemo } from 'react';
import { INDICATOR_DEFINITIONS } from '../indicatorDefinitions';
import { getEngineFallbackId } from '../indicatorSettingsSchema';

export function useIndicatorGroups(activeIndicators, indicatorOverrides, interval, customIndicators = []) {
  // Resolve active catalog definitions once (shared by overlays, zones, markers).
  // TradingView parity: flat overrides split into inputs (engine params) +
  // style (`__color`, `__lineWidth`, `__sub_{i}_color`) + visibility
  // (`__vis_{interval} === false` hides on that timeframe).
  const resolvedActive = useMemo(() => {
    const normIv = String(interval || '').toLowerCase();
    return activeIndicators
      .map(id => {
        const def = [...INDICATOR_DEFINITIONS, ...customIndicators].find(item => item.id === id);
        if (!def) return null;
        const overrides = indicatorOverrides[id];
        if (!overrides || !Object.keys(overrides).length) return def;
        // Visibility gate
        for (const [k, v] of Object.entries(overrides)) {
          if (k.toLowerCase() === `__vis_${normIv}` && v === false) return null;
        }
        const inputs = {};
        const stylePatch = {};
        for (const [k, v] of Object.entries(overrides)) {
          if (k.startsWith('__')) stylePatch[k] = v;
          else inputs[k] = v;
        }
        let next = { ...def, params: { ...(def.params || {}), ...inputs } };
        // Engine fallback: legacy field-based indicators recompute via the
        // client engine when the user customized inputs (else server field).
        if (!next.engineId && Object.keys(inputs).length) {
          const fb = getEngineFallbackId(next.id);
          if (fb) next = { ...next, engineId: fb };
        }
        if (stylePatch.__color) next = { ...next, color: stylePatch.__color };
        if (stylePatch.__lineWidth != null) next = { ...next, lineWidth: stylePatch.__lineWidth };
        if (stylePatch.__lineStyle != null) next = { ...next, lineStyle: stylePatch.__lineStyle };
        const subKeys = Object.keys(stylePatch).filter((k) => k.startsWith('__sub_'));
        if (subKeys.length && (next.subLines || next.levels)) {
          const applySubs = (list) => list.map((sub, i) => {
            const c = stylePatch[`__sub_${i}_color`];
            return c ? { ...sub, color: c } : sub;
          });
          if (next.subLines) next = { ...next, subLines: applySubs(next.subLines) };
          if (next.levels) next = { ...next, levels: applySubs(next.levels) };
        }
        return next;
      })
      .filter(Boolean);
  }, [activeIndicators, indicatorOverrides, interval, customIndicators]);

  // Filter active indicators to only include overlays (not oscillators which live in sub-panes),
  // applying per-indicator parameter overrides so custom params reflect in rendering.
  // Advanced AI forecast bands render here too (price-scale by construction).
  // The volume profile (type 'profile') renders through its own canvas overlay
  // in LiveChartView — excluded here so no line series is created for it.
  const overlayIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => (!['oscillator', 'smc', 'ai', 'profile'].includes(item.type))
        || (item.type === 'ai' && item.aiOverlay === 'bands'));
  }, [resolvedActive]);

  // Market Structure / SMC overlays are rendered separately from the price legend.
  const smcIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => item.type === 'smc' && item.id !== 'smc_pro');
  }, [resolvedActive]);

  // Advanced AI overlays: zones (S/R lines) and markers (breakout/reversal/pattern).
  // ai_reversal lives in an oscillator sub-pane but still contributes EXH markers.
  const aiZoneIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => item.type === 'ai' && item.aiOverlay === 'zones');
  }, [resolvedActive]);
  const aiMarkerIndicators = useMemo(() => {
    return resolvedActive
      .filter(item => (item.type === 'ai' && item.aiOverlay === 'markers') || item.id === 'ai_reversal');
  }, [resolvedActive]);

  // AI indicators that draw real overlays on the price pane (defs flagged
  // chartOverlay). Their price levels come from analyzeSignal at render time.
  // Advanced AI studies (aiOverlay line/bands/zones/markers) render through
  // their own engine-backed layers below — excluded here to avoid doubles.
  const aiOverlays = useMemo(() => {
    return resolvedActive
      .filter(item => item.type === 'ai' && item.chartOverlay && !item.aiOverlay);
  }, [resolvedActive]);

  return { resolvedActive, overlayIndicators, smcIndicators, aiZoneIndicators, aiMarkerIndicators, aiOverlays };
}
