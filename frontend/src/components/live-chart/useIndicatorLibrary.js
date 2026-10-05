import { useState, useEffect, useCallback, useMemo } from 'react';
import { DEFAULT_ACTIVE_INDICATORS, INDICATOR_DEFINITIONS } from '../chart/indicatorDefinitions';
import { getEngineFallbackId } from '../chart/indicatorSettingsSchema';

/**
 * useIndicatorLibrary — owns the advanced-indicator state machine for
 * LiveChartView: persisted active/hidden indicator ids, per-indicator
 * param/style overrides, modal state and every indicator handler.
 */
export function useIndicatorLibrary(interval) {
  // Advanced Indicators State — persisted ids are validated against the catalog so
  // a renamed/removed definition can never inflate the active count or bind to
  // nothing on the chart.
  const [activeIndicators, setActiveIndicators] = useState(() => {
    try {
      const saved = localStorage.getItem('stockoracle_indicators');
      if (!saved) return DEFAULT_ACTIVE_INDICATORS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return DEFAULT_ACTIVE_INDICATORS;
      const known = new Set(INDICATOR_DEFINITIONS.map((item) => item.id));
      return parsed.filter((id) => known.has(id));
    } catch {
      return DEFAULT_ACTIVE_INDICATORS;
    }
  });
  const [hiddenIndicators, setHiddenIndicators] = useState([]);
  const [showIndicatorModal, setShowIndicatorModal] = useState(false);
  const [indicatorSettings, setIndicatorSettings] = useState(null); // { id, name, engineId, params }
  const [indicatorParamOverrides, setIndicatorParamOverrides] = useState(() => {
    try {
      const saved = localStorage.getItem('stockoracle_indicator_overrides');
      if (!saved) return {};
      const parsed = JSON.parse(saved);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  // Persist active indicators to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('stockoracle_indicators', JSON.stringify(activeIndicators));
    } catch {}
  }, [activeIndicators]);

  // Persist indicator settings (Inputs + Style + Visibility) — TradingView parity
  useEffect(() => {
    try {
      localStorage.setItem('stockoracle_indicator_overrides', JSON.stringify(indicatorParamOverrides));
    } catch {}
  }, [indicatorParamOverrides]);

  // Filter active indicators to all oscillator sub-panes (RSI, MACD, Stoch, CCI, etc.)
  // TradingView Visibility tab: hidden on unchecked timeframes.
  const activeOscillators = useMemo(() => {
    const norm = String(interval || '').toLowerCase();
    return activeIndicators
      .map(id => INDICATOR_DEFINITIONS.find(item => item.id === id))
      .filter(item => item && item.type === 'oscillator')
      .filter((item) => {
        const ov = indicatorParamOverrides[item.id] || {};
        for (const [k, v] of Object.entries(ov)) {
          if (k.toLowerCase() === `__vis_${norm}` && v === false) return false;
        }
        return true;
      });
  }, [activeIndicators, indicatorParamOverrides, interval]);

  // AI indicators (AIDashboard strip)
  const showAIDashboard = useMemo(() => {
    return activeIndicators.some((id) => {
      const def = INDICATOR_DEFINITIONS.find((item) => item.id === id);
      return def && def.type === 'ai';
    });
  }, [activeIndicators]);

  // Indicator Handlers
  const handleToggleIndicator = useCallback((id) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleClearAllIndicators = useCallback(() => {
    setActiveIndicators([]);
    setHiddenIndicators([]);
  }, []);

  const handleToggleHideIndicator = useCallback((id) => {
    setHiddenIndicators((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const handleRemoveIndicator = useCallback((id) => {
    setActiveIndicators((prev) => prev.filter((item) => item !== id));
    setHiddenIndicators((prev) => prev.filter((item) => item !== id));
  }, []);

  // Applied-list ordering drives oscillator pane order and overlay draw order.
  const handleMoveIndicator = useCallback((id, direction) => {
    setActiveIndicators((prev) => {
      const from = prev.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }, []);

  const handleOpenIndicatorSettings = useCallback((indicator) => {
    // TradingView parity: EVERY indicator has settings (Inputs/Style/Visibility).
    if (!indicator) return;
    setIndicatorSettings(indicator);
  }, []);

  const handleSaveIndicatorParams = useCallback((id, overrides) => {
    setIndicatorParamOverrides((prev) => {
      const next = { ...prev, [id]: overrides };
      try {
        localStorage.setItem('stockoracle_indicator_overrides', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Resolve an indicator definition with user overrides applied.
  // Flat overrides: plain keys → inputs/params, `__*` keys → style/visibility
  // (engine ignores `__` keys, chart layers split them out for rendering).
  const resolveDefinition = useCallback((indicator) => {
    if (!indicator) return indicator;
    const overrides = indicatorParamOverrides[indicator.id];
    if (!overrides || Object.keys(overrides).length === 0) return indicator;
    const inputs = {};
    const stylePatch = {};
    for (const [k, v] of Object.entries(overrides)) {
      if (k.startsWith('__')) stylePatch[k] = v;
      else inputs[k] = v;
    }
    let next = { ...indicator, params: { ...(indicator.params || {}), ...inputs } };
    if (!next.engineId && Object.keys(inputs).length) {
      const fb = getEngineFallbackId(next.id);
      if (fb) next = { ...next, engineId: fb };
    }
    if (stylePatch.__color) next = { ...next, color: stylePatch.__color };
    if (stylePatch.__lineWidth != null) next = { ...next, lineWidth: stylePatch.__lineWidth };
    if (stylePatch.__lineStyle != null) next = { ...next, lineStyle: stylePatch.__lineStyle };
    // Per-subline colors (__sub_{i}_color) for BB/KC/Ichimoku/levels
    const subKeys = Object.keys(stylePatch).filter((k) => k.startsWith('__sub_'));
    if (subKeys.length && (next.subLines || next.levels)) {
      const applySubs = (list) => list.map((sub, i) => {
        const c = stylePatch[`__sub_${i}_color`];
        return c ? { ...sub, color: c } : sub;
      });
      if (next.subLines) next = { ...next, subLines: applySubs(next.subLines) };
      if (next.levels) next = { ...next, levels: applySubs(next.levels) };
    }
    // Attach raw visibility flags for pane filtering (ChartCanvas/OscillatorPane)
    next = { ...next, _visFlags: stylePatch };
    return next;
  }, [indicatorParamOverrides]);

  return {
    activeIndicators,
    setActiveIndicators,
    hiddenIndicators,
    showIndicatorModal,
    setShowIndicatorModal,
    indicatorSettings,
    setIndicatorSettings,
    indicatorParamOverrides,
    activeOscillators,
    showAIDashboard,
    handleToggleIndicator,
    handleClearAllIndicators,
    handleToggleHideIndicator,
    handleRemoveIndicator,
    handleMoveIndicator,
    handleOpenIndicatorSettings,
    handleSaveIndicatorParams,
    resolveDefinition,
  };
}
