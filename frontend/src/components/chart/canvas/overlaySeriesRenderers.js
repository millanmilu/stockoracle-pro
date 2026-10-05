import { sanitizeCandles, sanitizeSeriesData } from '../../../utils/chartHelpers';
import { calculateById } from '../../../utils/indicatorEngine';
import { detectSMC } from '../../../utils/marketStructure';
import { getAISupportResistance } from '../../../utils/aiIndicatorEngine';
import { analyzeSignal } from '../../../utils/aiSignalEngine';
import { resolveOverlayData } from './chartSeriesFactory';

export function renderOverlayIndicator(chart, def, candles, currentSeriesMap, hiddenIndicators, engineValueRef) {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      const kind = def.type === 'ai' ? (def.aiOverlay || 'info') : def.type;

      // ── Standard single-line overlay ──────────────────────────────────────
      if (def.type === 'overlay') {
        let series = currentSeriesMap[id];
        if (!series) {
          series = chart.addLineSeries({
            color: def.color, lineWidth: def.lineWidth || 1.5,
            lineStyle: def.lineStyle ?? 0,
            priceLineVisible: false, lastValueVisible: true, title: def.shortName,
          });
          currentSeriesMap[id] = series;
        }
        series.applyOptions({ visible: !isHidden, color: def.color, lineWidth: def.lineWidth || 1.5, lineStyle: def.lineStyle ?? 0 });
        const data = resolveOverlayData(def, candles);
        if (data.length) engineValueRef.current[id] = data[data.length - 1].value;
        try { series.setData(data); } catch {}

      // ── AI forecast bands (median ±1σ path incl. future bars) ─────────────
      } else if (kind === 'bands') {
        let bandList = currentSeriesMap[id];
        if (!bandList) {
          const mkBand = (color, style, title) => chart.addLineSeries({
            color, lineWidth: 1.5, lineStyle: style,
            priceLineVisible: false, lastValueVisible: false, title,
          });
          bandList = [
            mkBand(def.color || '#FBBF24', 0, `${def.shortName} median`),
            mkBand('rgba(56,189,248,0.75)', 2, `${def.shortName} +1σ`),
            mkBand('rgba(56,189,248,0.75)', 2, `${def.shortName} −1σ`),
          ];
          // Median first for legend focus; bands carry no price line.
          bandList[0].applyOptions({ lineWidth: 2, lastValueVisible: true });
          currentSeriesMap[id] = bandList;
        }
        let fc = { median: [], upper: [], lower: [] };
        try {
          const res = calculateById(def.engineId || 'ai_forecast', candles, def.params || {});
          if (res.valid && res.points) fc = { median: [], upper: [], lower: [], ...res.points };
        } catch {}
        // Anchor the forecast lines to the last candle's close so the bands form a continuous probability cone
        const anchor = fc.anchor || (candles.length > 0 ? { time: candles[candles.length - 1].time, value: Number(candles[candles.length - 1].close) } : null);
        const anchorPt = (anchor && anchor.time != null && isFinite(anchor.value)) ? [{ time: anchor.time, value: Number(anchor.value) }] : [];

        const legs = [
          sanitizeSeriesData([...anchorPt, ...(fc.median || []).map((p) => ({ time: p.time, value: Number(p.value) }))]),
          sanitizeSeriesData([...anchorPt, ...(fc.upper || []).map((p) => ({ time: p.time, value: Number(p.value) }))]),
          sanitizeSeriesData([...anchorPt, ...(fc.lower || []).map((p) => ({ time: p.time, value: Number(p.value) }))]),
        ];
        bandList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          try { if (legs[idx].length) s.setData(legs[idx]); } catch {}
        });
        if (legs[0].length) engineValueRef.current[id] = legs[0][legs[0].length - 1].value;

      // ── Multi-line overlay (BB, KC, Donchian) ─────────────────────────────
      } else if (def.type === 'overlay_multi') {
        let seriesList = currentSeriesMap[id];
        if (!seriesList) {
          seriesList = def.subLines.map((sub) =>
            chart.addLineSeries({ color: sub.color, lineWidth: 1, lineStyle: sub.style || 0, priceLineVisible: false, lastValueVisible: false, title: `${def.shortName} ${sub.label}` })
          );
          currentSeriesMap[id] = seriesList;
        }
        seriesList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const sub = def.subLines[idx];
          const data = sanitizeSeriesData(candles.filter((c) => c[sub.field] != null && !isNaN(Number(c[sub.field]))).map((c) => ({ time: c.time, value: Number(c[sub.field]) })));
          try { s.setData(data); } catch {}
        });

      // ── Levels overlay (Pivot Points, Fibonacci) ───────────────────────────
      } else if (def.type === 'levels') {
        let seriesList = currentSeriesMap[id];
        if (!seriesList) {
          seriesList = def.levels.map((lvl) =>
            chart.addLineSeries({ color: lvl.color, lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: true, title: lvl.label })
          );
          currentSeriesMap[id] = seriesList;
        }
        seriesList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const lvl = def.levels[idx];
          const data = sanitizeSeriesData(candles.filter((c) => c[lvl.field] != null && !isNaN(Number(c[lvl.field]))).map((c) => ({ time: c.time, value: Number(c[lvl.field]) })));
          try { s.setData(data); } catch {}
        });

      // ── Supertrend — clean continuous line with reversal signal markers ───
      } else if (def.type === 'overlay_supertrend') {
        let stSeries = currentSeriesMap[id];
        if (!stSeries) {
          stSeries = chart.addLineSeries({
            color: '#10B981',
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'Supertrend',
          });
          currentSeriesMap[id] = stSeries;
        }
        stSeries.applyOptions({ visible: !isHidden });

        // Continuous data for Supertrend line
        const stData = sanitizeSeriesData(candles
          .filter((c) => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map((c) => ({ time: c.time, value: Number(c[def.field]) })));
        try { stSeries.setData(stData); } catch {}

        // Set series color according to latest candle trend direction
        if (candles.length > 0) {
          const latestCandle = candles[candles.length - 1];
          const latestDir = Number(latestCandle[def.dirField]);
          stSeries.applyOptions({ color: latestDir === -1 ? '#EF5350' : '#10B981' });
        }

        // Reversal buy/sell signal markers at exact trend flips
        const markers = [];
        let prevDir = null;
        sanitizeCandles(candles).forEach((c) => {
          if (c[def.field] == null || isNaN(Number(c[def.field])) || c[def.dirField] == null) return;
          const dir = Number(c[def.dirField]);
          if (prevDir !== null && dir !== prevDir) {
            markers.push({
              time: c.time,
              position: dir === 1 ? 'belowBar' : 'aboveBar',
              color: dir === 1 ? '#10B981' : '#EF5350',
              shape: dir === 1 ? 'arrowUp' : 'arrowDown',
              text: dir === 1 ? 'BUY' : 'SELL',
              size: 1,
            });
          }
          prevDir = dir;
        });
        try { stSeries.setMarkers(markers); } catch {}

      // ── Parabolic SAR — clean amber dotted trailing stop line ─────────────
      } else if (def.type === 'overlay_psar') {
        let psarSeries = currentSeriesMap[id];
        if (!psarSeries) {
          psarSeries = chart.addLineSeries({
            color: '#F59E0B',
            lineWidth: 1,
            lineStyle: 1, // Dotted
            priceLineVisible: false,
            lastValueVisible: true,
            title: 'PSAR',
          });
          currentSeriesMap[id] = psarSeries;
        }
        psarSeries.applyOptions({ visible: !isHidden });
        const psarData = sanitizeSeriesData(candles
          .filter(c => c[def.field] != null && !isNaN(Number(c[def.field])))
          .map(c => ({ time: c.time, value: Number(c[def.field]) })));
        try { psarSeries.setData(psarData); } catch {}


      // ── Ichimoku Cloud — 5 lines ──────────────────────────────────────────
      } else if (def.type === 'overlay_ichimoku') {
        let ichiList = currentSeriesMap[id];
        if (!ichiList) {
          ichiList = def.subLines.map((sub) =>
            chart.addLineSeries({
              color: sub.color, lineWidth: sub.label.includes('Senkou') ? 1 : 1.5,
              lineStyle: sub.label === 'Chikou' ? 2 : 0,
              priceLineVisible: false, lastValueVisible: false, title: sub.label,
            })
          );
          currentSeriesMap[id] = ichiList;
        }
        ichiList.forEach((s, idx) => {
          s.applyOptions({ visible: !isHidden });
          const sub = def.subLines[idx];
          const data = sanitizeSeriesData(candles
            .filter(c => c[sub.field] != null && !isNaN(Number(c[sub.field])))
            .map(c => ({ time: c.time, value: Number(c[sub.field]) })));
          try { s.setData(data); } catch {}
        });
      }
}

export function renderSmcIndicator(chart, def, candles, smcSeriesRef, hiddenIndicators) {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      let group = smcSeriesRef.current[id];
      if (!group) {
        group = { lineSeries: [] };
        smcSeriesRef.current[id] = group;
      }

      const items = detectSMC(def.smcType, candles, def.params || {});
      const lines = [];

      // Translate zone descriptors and point levels into horizontal price lines.
      items.forEach((item) => {
        if (item.top != null && item.bottom != null) {
          const zoneColor = item.color || def.color;
          lines.push({ price: item.top, color: zoneColor, label: item.label, lineWidth: 1, lineStyle: 2 });
          lines.push({ price: item.bottom, color: zoneColor, label: undefined, lineWidth: 1, lineStyle: 2 });
        } else if (item.price != null && isFinite(Number(item.price))) {
          lines.push({ price: item.price, color: item.color || def.color, label: item.label, lineWidth: 1, lineStyle: 2 });
        }
      });

      // Reconcile price-line series count
      const lineSeries = group.lineSeries;
      while (lineSeries.length > lines.length) {
        const s = lineSeries.pop();
        try { chart.removeSeries(s); } catch {}
      }
      while (lineSeries.length < lines.length) {
        const s = chart.addLineSeries({ color: '#888', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
        lineSeries.push(s);
      }
      lineSeries.forEach((s, idx) => {
        const cfgLine = lines[idx];
        if (!cfgLine) return;
        s.applyOptions({ color: cfgLine.color, lineWidth: cfgLine.lineWidth, lineStyle: cfgLine.lineStyle, lastValueVisible: false, priceLineVisible: false });
        s.applyOptions({ visible: !isHidden });
        try {
          const safeRange = sanitizeSeriesData([
            { time: candles[0].time, value: cfgLine.price },
            { time: candles[candles.length - 1].time, value: cfgLine.price },
          ]);
          if (safeRange.length > 0) s.setData(safeRange);
        } catch {}
        // No in-chart circle+text markers here — SmcProLayer owns all SMC
        // labels (collision-placed). Markers like "R 85316" only cluttered
        // the candles, so they stay cleared even if one was set before.
        try { s.setMarkers([]); } catch {}
      });
}

export function renderAiZoneIndicator(chart, def, candles, aiZoneSeriesRef, hiddenIndicators) {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      let group = aiZoneSeriesRef.current[id];
      if (!group) {
        group = { lineSeries: [] };
        aiZoneSeriesRef.current[id] = group;
      }
      let zones = [];
      try {
        zones = getAISupportResistance(candles, def.params || {});
      } catch {}
      const lineSeries = group.lineSeries;
      while (lineSeries.length > zones.length) {
        const s = lineSeries.pop();
        try { chart.removeSeries(s); } catch {}
      }
      while (lineSeries.length < zones.length) {
        lineSeries.push(chart.addLineSeries({ color: '#888', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }));
      }
      lineSeries.forEach((s, idx) => {
        const z = zones[idx];
        if (!z) return;
        const zColor = z.side === 'S' ? '#10B981' : '#EF5350';
        s.applyOptions({ color: zColor, lineWidth: z.strength >= 70 ? 2 : 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
        s.applyOptions({ visible: !isHidden });
        try {
          const safeRange = sanitizeSeriesData([
            { time: candles[0].time, value: z.price },
            { time: candles[candles.length - 1].time, value: z.price },
          ]);
          if (safeRange.length > 0) s.setData(safeRange);
        } catch {}
        // No "R 85316"-style circle+price markers — the S/R + SMC levels are
        // labeled once by SmcProLayer (deduplicated, collision-placed).
        try { s.setMarkers([]); } catch {}
      });
}

export function renderAiSignalIndicator(chart, def, candles, aiSeriesRef, hiddenIndicators) {
      const id = def.id;
      const isHidden = hiddenIndicators.includes(id);
      let group = aiSeriesRef.current[id];
      if (!group) {
        group = { lineSeries: [] };
        aiSeriesRef.current[id] = group;
      }

      const firstC = candles[0];
      const lastC = candles[candles.length - 1];
      const sig = analyzeSignal(candles);

      // Signal price levels (Entry/SL/TP) + current-direction marker.
      // (Advanced ai_sr zones render in the dedicated AI-zones block below.)
      if (sig.available && sig.direction !== 'neutral' && sig.entry != null) {
        const bullish = sig.direction !== 'sell';
        const dirInfo = sig.direction === 'buy'
          ? { color: '#10B981', label: 'BUY', shape: 'arrowUp' }
          : sig.direction === 'sell'
            ? { color: '#EF5350', label: 'SELL', shape: 'arrowDown' }
            : { color: '#F59E0B', label: 'NEUTRAL', shape: 'circle' };
        const lines = [
          { price: sig.entry, color: '#E2E8F0', label: 'AI Entry', style: 0 },
          { price: sig.stopLoss, color: '#EF5350', label: 'AI SL', style: 2 },
          { price: sig.takeProfit, color: '#10B981', label: 'AI TP', style: 2 },
        ];
        const markerPrice = Number(lastC.close);
        const hasMarkerAnchor = lastC.time != null && Number.isFinite(markerPrice);
        const want = lines.length + 1; // slot 0 hosts the direction marker
        while (group.lineSeries.length < want) {
          group.lineSeries.push(chart.addLineSeries({ color: '#888', lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false }));
        }
        while (group.lineSeries.length > want) {
          const extra = group.lineSeries.pop();
          try { chart.removeSeries(extra); } catch {}
        }
        group.lineSeries.forEach((ser, idx) => {
          ser.applyOptions({ visible: !isHidden });
          if (idx === 0) {
            // Lightweight Charts resolves crosshair markers through the
            // series' first value. A marker-only empty series crashes its
            // crosshair renderer with "Value is null", so anchor it to the
            // latest close while keeping the anchor line invisible.
            const markerAnchor = hasMarkerAnchor
              ? sanitizeSeriesData([{ time: lastC.time, value: markerPrice }])
              : [];
            ser.applyOptions({ color: 'rgba(0,0,0,0)', lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
            try { ser.setData(markerAnchor); } catch {}
            return;
          }
          const cfg = lines[idx - 1];
          if (!cfg) { try { ser.setData([]); } catch {} return; }
          ser.applyOptions({ color: cfg.color, lineStyle: cfg.style, lastValueVisible: false });
          try {
            ser.setData(sanitizeSeriesData([{ time: firstC.time, value: cfg.price }, { time: lastC.time, value: cfg.price }]));
          } catch {}
        });
        try {
          group.lineSeries[0].setMarkers(hasMarkerAnchor ? [{
            time: lastC.time,
            position: bullish ? 'belowBar' : 'aboveBar',
            color: dirInfo.color,
            shape: dirInfo.shape,
            text: dirInfo.label + ' ' + sig.confidence + '/100',
            size: 1,
          }] : []);
        } catch {}
      } else {
        // Signal unavailable — clear stale levels.
        group.lineSeries.forEach((ser) => { try { ser.setData([]); ser.setMarkers([]); } catch {} });
      }
}
