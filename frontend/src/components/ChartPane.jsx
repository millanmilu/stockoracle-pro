import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, ColorType, LineStyle, CrosshairMode } from 'lightweight-charts';
import api from '../utils/api';
import { 
  Maximize2, Minimize2, Sparkles, TrendingUp,
  ZoomIn, ZoomOut, RotateCcw, Activity, Layers, Target, Check
} from 'lucide-react';
import toast from 'react-hot-toast';

const INTERVALS = [
  { label: '1m',  value: '1m'  },
  { label: '5m',  value: '5m'  },
  { label: '15m', value: '15m' },
  { label: '1H',  value: '1h'  },
  { label: '1D',  value: '1d'  },
];

const POPULAR_PANE_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS', 'NIFTY50', 'BANKNIFTY'];

// Helper to convert date string to lightweight-charts time format
function toChartTime(dateStr, isIntraday) {
  if (!dateStr) return Math.floor(Date.now() / 1000);
  if (isIntraday) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? Math.floor(Date.now() / 1000) : Math.floor(d.getTime() / 1000);
  }
  // Daily: strict YYYY-MM-DD
  return String(dateStr).slice(0, 10);
}

// Add N business days forward skipping weekends
function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

// Compute Simple Moving Average
function computeSMA(data, period) {
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    result.push({ time: data[i].time, value: sum / period });
  }
  return result;
}

// Compute Exponential Moving Average
function computeEMA(data, period) {
  const result = [];
  const k = 2 / (period + 1);
  let ema = data[0]?.close || 0;
  for (let i = 0; i < data.length; i++) {
    const val = data[i].close;
    ema = i === 0 ? val : val * k + ema * (1 - k);
    if (i >= period - 1) {
      result.push({ time: data[i].time, value: ema });
    }
  }
  return result;
}

// Compute Bollinger Bands
function computeBB(data, period = 20, multiplier = 2) {
  const upper = [];
  const lower = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) continue;
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j].close;
    const mean = sum / period;
    let variance = 0;
    for (let j = 0; j < period; j++) variance += Math.pow(data[i - j].close - mean, 2);
    const stdDev = Math.sqrt(variance / period);
    upper.push({ time: data[i].time, value: mean + multiplier * stdDev });
    lower.push({ time: data[i].time, value: mean - multiplier * stdDev });
  }
  return { upper, lower };
}

export default function ChartPane({
  paneId,
  symbol,
  interval = '1d',
  isActive = false,
  isMaximized = false,
  onSelectPane,
  onSymbolChange,
  onIntervalChange,
  onToggleMaximize,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const smaSeriesRef = useRef(null);
  const emaSeriesRef = useRef(null);
  const bbUpperSeriesRef = useRef(null);
  const bbLowerSeriesRef = useRef(null);
  const predLineRef = useRef(null);
  const upperLineRef = useRef(null);
  const lowerLineRef = useRef(null);

  const activeCandleRef = useRef(null);
  const lastPriceRef = useRef(null);

  const [history, setHistory] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [livePrice, setLivePrice] = useState(null);

  // Indicators state
  const [showSMA, setShowSMA] = useState(false);
  const [showEMA, setShowEMA] = useState(false);
  const [showBB, setShowBB] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showAICone, setShowAICone] = useState(true);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [paneSearchQuery, setPaneSearchQuery] = useState('');

  const isDaily = interval === '1d';

  // ── Fetch Historical Candles ───────────────────────────────────────────────
  const fetchCandles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const timeframe = interval === '1d' ? '5Y' : interval === '1h' ? '1M' : '5D';
      const res = await api.get(`/api/stock/${symbol.toUpperCase()}/history`, {
        params: { timeframe, interval },
      });
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        setHistory(data);
        const lastClose = Number(data[data.length - 1]?.close);
        if (lastClose > 0) {
          lastPriceRef.current = lastClose;
          setLivePrice(lastClose);
        }
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error(`Failed to fetch history for ${symbol}:`, err);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  // ── Fetch AI Predictions ───────────────────────────────────────────────────
  const fetchPrediction = useCallback(async () => {
    if (!isDaily) {
      setPrediction(null);
      return;
    }
    try {
      const res = await api.get(`/api/stock/${symbol.toUpperCase()}/predict`);
      if (res.data && res.data.predicted_price_7d > 0) {
        setPrediction(res.data);
      }
    } catch (_) {
      setPrediction(null);
    }
  }, [symbol, isDaily]);

  useEffect(() => {
    fetchCandles();
    fetchPrediction();
  }, [fetchCandles, fetchPrediction]);

  // ── Initialize Lightweight Charts ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#090C18' },
        textColor: '#9CA3AF',
        fontSize: 11,
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(99, 102, 241, 0.05)' },
        horzLines: { color: 'rgba(99, 102, 241, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(99, 102, 241, 0.4)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(99, 102, 241, 0.4)', width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: 'rgba(99, 102, 241, 0.15)',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: 'rgba(99, 102, 241, 0.15)',
        timeVisible: !isDaily,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10B981',
      downColor: '#EF5350',
      borderUpColor: '#10B981',
      borderDownColor: '#EF5350',
      wickUpColor: '#10B981',
      wickDownColor: '#EF5350',
    });
    candleSeriesRef.current = candleSeries;

    // 2. Volume Series
    const volumeSeries = chart.addHistogramSeries({
      color: '#6366F1',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume_scale',
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // 3. Technical Overlays
    smaSeriesRef.current = chart.addLineSeries({ color: '#F59E0B', lineWidth: 1.5, title: 'SMA 20' });
    emaSeriesRef.current = chart.addLineSeries({ color: '#38BDF8', lineWidth: 1.5, title: 'EMA 20' });
    bbUpperSeriesRef.current = chart.addLineSeries({ color: 'rgba(168,85,247,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed });
    bbLowerSeriesRef.current = chart.addLineSeries({ color: 'rgba(168,85,247,0.7)', lineWidth: 1, lineStyle: LineStyle.Dashed });

    // 4. AI Forecast Prediction Cone Lines
    predLineRef.current = chart.addLineSeries({
      color: '#A855F7',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: 'AI Target',
    });
    upperLineRef.current = chart.addLineSeries({
      color: '#26A69A',
      lineWidth: 1.5,
      lineStyle: LineStyle.Dotted,
      title: '95% Upper',
    });
    lowerLineRef.current = chart.addLineSeries({
      color: '#EF5350',
      lineWidth: 1.5,
      lineStyle: LineStyle.Dotted,
      title: '95% Lower',
    });

    // Resize Observer for responsive pane layout
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [isDaily]);

  // ── Populate Series Data & Forecast Cone ───────────────────────────────────
  useEffect(() => {
    if (!candleSeriesRef.current || history.length === 0) return;

    const formattedCandles = [];
    const formattedVolumes = [];
    const seenTimes = new Set();

    for (let i = 0; i < history.length; i++) {
      const bar = history[i];
      const time = toChartTime(bar.date, !isDaily);
      if (seenTimes.has(time)) continue;
      seenTimes.add(time);

      const o = Number(bar.open);
      const h = Number(bar.high);
      const l = Number(bar.low);
      const c = Number(bar.close);
      const v = Number(bar.volume || 0);

      if (o > 0 && h > 0 && l > 0 && c > 0) {
        formattedCandles.push({ time, open: o, high: h, low: l, close: c });
        formattedVolumes.push({
          time,
          value: v,
          color: c >= o ? 'rgba(16,185,129,0.3)' : 'rgba(239,83,80,0.3)',
        });
      }
    }

    candleSeriesRef.current.setData(formattedCandles);
    if (showVolume && volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(formattedVolumes);
    } else {
      volumeSeriesRef.current?.setData([]);
    }

    // Overlays
    if (showSMA && smaSeriesRef.current) {
      smaSeriesRef.current.setData(computeSMA(formattedCandles, 20));
    } else {
      smaSeriesRef.current?.setData([]);
    }

    if (showEMA && emaSeriesRef.current) {
      emaSeriesRef.current.setData(computeEMA(formattedCandles, 20));
    } else {
      emaSeriesRef.current?.setData([]);
    }

    if (showBB && bbUpperSeriesRef.current && bbLowerSeriesRef.current) {
      const bb = computeBB(formattedCandles, 20, 2);
      bbUpperSeriesRef.current.setData(bb.upper);
      bbLowerSeriesRef.current.setData(bb.lower);
    } else {
      bbUpperSeriesRef.current?.setData([]);
      bbLowerSeriesRef.current?.setData([]);
    }

    // ── Interactive Multi-Step AI Forecast Prediction Cone ──
    if (showAICone && isDaily && prediction?.predicted_price_7d > 0 && formattedCandles.length > 0) {
      const lastBar = formattedCandles[formattedCandles.length - 1];
      const lastTime = lastBar.time;
      const lastClose = lastBar.close;

      const targetPrice = prediction.predicted_price_7d;
      const upperTarget = prediction.predicted_upper_price_7d ?? prediction.high_bound ?? targetPrice * 1.03;
      const lowerTarget = prediction.predicted_lower_price_7d ?? prediction.low_bound ?? targetPrice * 0.97;

      // Multi-step expanding funnel for 7 days
      const predTrajectory = [{ time: lastTime, value: lastClose }];
      const upperTrajectory = [{ time: lastTime, value: lastClose }];
      const lowerTrajectory = [{ time: lastTime, value: lastClose }];

      const totalDays = 7;
      for (let day = 1; day <= totalDays; day++) {
        const stepTime = addBusinessDays(lastBar.time, day);
        const progress = day / totalDays;
        const sqrtProgress = Math.sqrt(progress);

        // Expected mid trajectory
        const stepPred = lastClose + (targetPrice - lastClose) * progress;
        predTrajectory.push({ time: stepTime, value: Number(stepPred.toFixed(2)) });

        // Expanding 95% confidence bounds
        const stepUpper = stepPred + (upperTarget - targetPrice) * sqrtProgress;
        const stepLower = stepPred - (targetPrice - lowerTarget) * sqrtProgress;

        upperTrajectory.push({ time: stepTime, value: Number(stepUpper.toFixed(2)) });
        lowerTrajectory.push({ time: stepTime, value: Number(Math.max(stepLower, 0.1).toFixed(2)) });
      }

      predLineRef.current?.setData(predTrajectory);
      upperLineRef.current?.setData(upperTrajectory);
      lowerLineRef.current?.setData(lowerTrajectory);
    } else {
      predLineRef.current?.setData([]);
      upperLineRef.current?.setData([]);
      lowerLineRef.current?.setData([]);
    }

    if (chartRef.current && formattedCandles.length > 0) {
      const total = formattedCandles.length;
      const visibleCount = Math.min(total, 90);
      chartRef.current.timeScale().setVisibleLogicalRange({
        from: total - visibleCount,
        to: total + (showAICone && isDaily ? 9 : 2),
      });
    }
  }, [history, prediction, showSMA, showEMA, showBB, showVolume, showAICone, isDaily]);

  // Handle pane click for focus
  const handlePaneClick = () => {
    if (onSelectPane) onSelectPane(paneId);
  };

  const currentPriceDisplay = livePrice ?? history[history.length - 1]?.close;

  return (
    <div 
      onClick={handlePaneClick}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        backgroundColor: '#090C18',
        border: isActive ? '1px solid #6366F1' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: isActive ? '0 0 16px rgba(99, 102, 241, 0.2)' : 'none',
        transition: 'border 0.2s, box-shadow 0.2s',
      }}
    >
      {/* ── Pane Top Toolbar ── */}
      <div style={{
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        backgroundColor: '#0C1022',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        userSelect: 'none',
      }}>
        {/* Symbol Selector & LTP */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={(e) => { e.stopPropagation(); setShowSymbolPicker(!showSymbolPicker); }}
              style={{
                background: 'rgba(99, 102, 241, 0.12)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                borderRadius: 4,
                padding: '3px 8px',
                color: '#F0F0FF',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              {symbol} ▾
            </button>

            {/* Quick Symbol Dropdown with Search */}
            {showSymbolPicker && (
              <div 
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  width: 170,
                  backgroundColor: '#0F172A',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  borderRadius: 6,
                  zIndex: 100,
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.7)',
                  padding: 6,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  placeholder="Search ticker..."
                  value={paneSearchQuery}
                  onChange={(e) => setPaneSearchQuery(e.target.value)}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '4px 6px',
                    borderRadius: 4,
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#090C18',
                    color: '#fff',
                    fontSize: '0.72rem',
                    outline: 'none',
                    marginBottom: 6,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && paneSearchQuery.trim()) {
                      onSymbolChange(paneId, paneSearchQuery.trim().toUpperCase());
                      setShowSymbolPicker(false);
                      setPaneSearchQuery('');
                    }
                  }}
                />
                <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                  {POPULAR_PANE_SYMBOLS
                    .filter((s) => !paneSearchQuery || s.toLowerCase().includes(paneSearchQuery.toLowerCase()))
                    .map((s) => (
                      <div
                        key={s}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSymbolChange(paneId, s);
                          setShowSymbolPicker(false);
                          setPaneSearchQuery('');
                        }}
                        style={{
                          padding: '5px 8px',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          color: s === symbol ? '#6366F1' : '#E2E8F0',
                          backgroundColor: s === symbol ? 'rgba(99,102,241,0.15)' : 'transparent',
                          cursor: 'pointer',
                          borderRadius: 3,
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(99,102,241,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = s === symbol ? 'rgba(99,102,241,0.15)' : 'transparent'}
                      >
                        {s}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {currentPriceDisplay && (
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#F0F0FF', fontFamily: 'JetBrains Mono, monospace' }}>
              ₹{Number(currentPriceDisplay).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>

        {/* Timeframe Intervals */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {INTERVALS.map((tf) => (
            <button
              key={tf.value}
              onClick={(e) => {
                e.stopPropagation();
                onIntervalChange(paneId, tf.value);
              }}
              style={{
                background: interval === tf.value ? '#6366F1' : 'transparent',
                color: interval === tf.value ? '#FFFFFF' : '#9CA3AF',
                border: 'none',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: '0.72rem',
                fontWeight: interval === tf.value ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Overlay Badges & Maximize */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* AI Cone Toggle */}
          {isDaily && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowAICone(!showAICone); }}
              title="Toggle 7D AI Forecast Cone"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: showAICone ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                border: showAICone ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: showAICone ? '#C084FC' : '#9CA3AF',
                borderRadius: 4,
                padding: '2px 6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={11} />
              AI Cone
            </button>
          )}

          {/* SMA Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowSMA(!showSMA); }}
            style={{
              background: showSMA ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: showSMA ? '#F59E0B' : '#6B7280',
              border: 'none',
              borderRadius: 3,
              padding: '2px 5px',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            SMA
          </button>

          {/* Maximize Toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggleMaximize(paneId); }}
            title={isMaximized ? 'Restore Grid' : 'Maximize Pane'}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9CA3AF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 2,
            }}
          >
            {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* ── Main Canvas ── */}
      <div 
        ref={containerRef} 
        style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}
      >
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(9, 12, 24, 0.6)',
            zIndex: 10,
          }}>
            <div className="spinner" />
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#EF4444',
            fontSize: '0.78rem',
            zIndex: 10,
          }}>
            {error}
          </div>
        )}

        {/* AI Forecast Floating Tag (When AI Cone is visible) */}
        {showAICone && isDaily && prediction?.predicted_price_7d > 0 && (
          <div style={{
            position: 'absolute',
            top: 10,
            left: 12,
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(168, 85, 247, 0.35)',
            borderRadius: 6,
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.72rem',
            zIndex: 5,
            pointerEvents: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#C084FC', fontWeight: 700 }}>
              <Target size={12} />
              7D Target: ₹{prediction.predicted_price_7d.toFixed(2)}
            </div>
            <div style={{ 
              color: prediction.predicted_return_7d >= 0 ? '#10B981' : '#EF5350',
              fontWeight: 600,
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              {prediction.predicted_return_7d >= 0 ? '+' : ''}{(prediction.predicted_return_7d * 100).toFixed(2)}%
            </div>
            {prediction.ai_confidence_score != null && (
              <span style={{ color: '#9CA3AF', fontSize: '0.68rem' }}>
                ({prediction.ai_confidence_score}% Conf)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
