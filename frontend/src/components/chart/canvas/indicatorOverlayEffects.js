import { compareChartTime } from '../../../utils/chartHelpers';
import { getAIBreakoutMarkers, getAIReversalMarkers, getAIPatternMarkers } from '../../../utils/aiIndicatorEngine';
import {
  renderOverlayIndicator,
  renderSmcIndicator,
  renderAiZoneIndicator,
  renderAiSignalIndicator,
} from './overlaySeriesRenderers';

export function updateIndicatorOverlays({
  chartInstanceRef,
  indicatorSeriesRef,
  smcSeriesRef,
  aiZoneSeriesRef,
  aiSeriesRef,
  engineValueRef,
  resetLegendRef,
  settingsRef,
  syncScalePlacement,
  activeIndicators,
  hiddenIndicators,
  overlayIndicators,
  smcIndicators,
  aiOverlays,
  aiZoneIndicators,
  candles,
}) {
    const chart = chartInstanceRef.current;
    if (!chart || chart.__isDisposed || !candles || candles.length === 0) return;

    const currentSeriesMap = indicatorSeriesRef.current;

    // 1. Remove series that are no longer active
    Object.keys(currentSeriesMap).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const item = currentSeriesMap[id];
        if (Array.isArray(item)) {
          item.forEach((s) => { try { chart.removeSeries(s); } catch {} });
        } else if (item) {
          try { chart.removeSeries(item); } catch {}
        }
        delete currentSeriesMap[id];
      }
    });

    // Remove SMC overlays that are no longer active
    const renderedSmcIds = new Set(smcIndicators.map((def) => def.id));
    Object.keys(smcSeriesRef.current).forEach((id) => {
      if (!renderedSmcIds.has(id)) {
        const group = smcSeriesRef.current[id];
        (group?.lineSeries || []).forEach((s) => { try { chart.removeSeries(s); } catch {} });
        delete smcSeriesRef.current[id];
      }
    });

    // Remove AI zone overlays that are no longer active
    Object.keys(aiZoneSeriesRef.current).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const group = aiZoneSeriesRef.current[id];
        (group?.lineSeries || []).forEach((s) => { try { chart.removeSeries(s); } catch {} });
        delete aiZoneSeriesRef.current[id];
      }
    });

    // 2. Add or update active overlay indicators
    // Advanced AI forecast joins via aiOverlay 'bands' (median ±1σ paths).
    overlayIndicators.forEach((def) => {
      renderOverlayIndicator(chart, def, candles, currentSeriesMap, hiddenIndicators, engineValueRef);
    });

    // 3. Render Market Structure / SMC overlays
    smcIndicators.forEach((def) => {
      renderSmcIndicator(chart, def, candles, smcSeriesRef, hiddenIndicators);
    });

    // 3b. Advanced AI S/R zones — fractal pivots clustered in ATR tolerance,
    // scored by touches + volume + recency. Labeled lines span the full range.
    aiZoneIndicators.forEach((def) => {
      renderAiZoneIndicator(chart, def, candles, aiZoneSeriesRef, hiddenIndicators);
    });
    // Remove AI overlays that are no longer active
    Object.keys(aiSeriesRef.current).forEach((id) => {
      if (!activeIndicators.includes(id)) {
        const g = aiSeriesRef.current[id];
        (g?.lineSeries || []).forEach((ser) => { try { chart.removeSeries(ser); } catch {} });
        delete aiSeriesRef.current[id];
      }
    });

    // 4. Render AI overlays (type 'ai' with chartOverlay flag) — real price
    // levels from analyzeSignal: Entry/SL/TP lines + direction marker, AI S/R.
    aiOverlays.forEach((def) => {
      renderAiSignalIndicator(chart, def, candles, aiSeriesRef, hiddenIndicators);
    });

    resetLegendRef.current();
    // Overlay series created this pass must join the active price-scale side.
    syncScalePlacement(settingsRef.current);
}

export function updateAiMarkers({ candleSeriesRef, candlesRef, aiMarkerIndicators }) {
    const series = candleSeriesRef.current;
    if (!series || series.__isDisposed) return;
    if (!aiMarkerIndicators.length || !candlesRef.current?.length) {
      try { series.setMarkers([]); } catch {}
      return;
    }
    const resolvers = {
      ai_breakout: getAIBreakoutMarkers,
      ai_reversal: getAIReversalMarkers,
      ai_pattern: getAIPatternMarkers,
    };
    const merged = [];
    aiMarkerIndicators.forEach((def) => {
      const fn = resolvers[def.id];
      if (!fn) return;
      try {
        const ms = fn(candlesRef.current, def.params || {}) || [];
        ms.forEach((m) => { if (m && m.time != null) merged.push(m); });
      } catch {}
    });
    merged.sort((a, b) => compareChartTime(a.time, b.time));
    try { series.setMarkers(merged); } catch {}
}
