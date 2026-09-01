import React, { useEffect, useRef, useState, memo } from 'react';
import { Clock, Globe, Sparkles } from 'lucide-react';

/**
 * Symbol translation map for Indian Equities and Benchmark Indices
 */
const SYMBOL_MAP = {
  'NIFTY50': 'NSE:NIFTY',
  'NIFTY 50': 'NSE:NIFTY',
  'NIFTY': 'NSE:NIFTY',
  'BANKNIFTY': 'NSE:BANKNIFTY',
  'BANK NIFTY': 'NSE:BANKNIFTY',
  'SENSEX': 'BSE:SENSEX',
  'FINNIFTY': 'NSE:FINNIFTY',
  'MIDCPNIFTY': 'NSE:MIDCPNIFTY',
  'INDIAVIX': 'NSE:INDIAVIX',
  'INDIA VIX': 'NSE:INDIAVIX',
};

export const TV_TIMEFRAMES = [
  { label: '1m',  value: '1m',  tvVal: '1',   desc: '1-Minute Micro Scalp' },
  { label: '3m',  value: '3m',  tvVal: '3',   desc: '3-Minute Intraday' },
  { label: '5m',  value: '5m',  tvVal: '5',   desc: '5-Minute Intraday' },
  { label: '15m', value: '15m', tvVal: '15',  desc: '15-Minute Key Structural' },
  { label: '30m', value: '30m', tvVal: '30',  desc: '30-Minute Trend' },
  { label: '1H',  value: '1h',  tvVal: '60',  desc: '1-Hour Hourly' },
  { label: '4H',  value: '4h',  tvVal: '240', desc: '4-Hour Intermediate Swing' },
  { label: '1D',  value: '1d',  tvVal: 'D',   desc: 'Daily EOD Standard' },
  { label: '1W',  value: '1w',  tvVal: 'W',   desc: 'Weekly Macro Trend' },
  { label: '1M',  value: '1mo', tvVal: 'M',   desc: 'Monthly Long Horizon' },
];

function formatTVSymbol(rawSymbol, preferredExchange = 'BSE') {
  if (!rawSymbol) return `${preferredExchange}:RELIANCE`;
  const clean = rawSymbol.toUpperCase().trim();
  if (SYMBOL_MAP[clean]) return SYMBOL_MAP[clean];
  if (clean.includes(':')) return clean;
  return `${preferredExchange}:${clean}`;
}

function formatTVInterval(rawInterval) {
  const map = {
    '1m': '1',
    '3m': '3',
    '5m': '5',
    '15m': '15',
    '30m': '30',
    '1h': '60',
    '2h': '120',
    '4h': '240',
    '1d': 'D',
    '1w': 'W',
    '1mo': 'M',
    '1mth': 'M',
  };
  return map[rawInterval?.toLowerCase()] || 'D';
}

function TradingViewAdvancedChart({
  symbol = 'RELIANCE',
  interval = '1d',
  onIntervalChange,
  showTimeframeBar = true,
  paneLabel,
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(`tv_widget_${Math.random().toString(36).substring(2, 9)}`);
  const [exchange, setExchange] = useState('BSE'); // 'BSE' has unrestricted embed access across all TradingView domains
  const [activeInterval, setActiveInterval] = useState(interval);

  // Sync external interval prop
  useEffect(() => {
    if (interval) {
      setActiveInterval(interval);
    }
  }, [interval]);

  const tvSymbol = formatTVSymbol(symbol, exchange);
  const tvInterval = formatTVInterval(activeInterval);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = '';

    const containerWrapper = document.createElement('div');
    containerWrapper.className = 'tradingview-widget-container';
    containerWrapper.style.width = '100%';
    containerWrapper.style.height = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.id = widgetIdRef.current;
    widgetDiv.style.width = '100%';
    widgetDiv.style.height = '100%';
    containerWrapper.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'in',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_side_toolbar: false,
      hide_top_toolbar: false,
      withdateranges: true,
      hide_volume: false,
      support_host: 'https://in.tradingview.com',
      details: false,
      hotlist: false,
      calendar: false,
      studies: [
        'STD;SMA',
        'STD;RSI',
        'STD;MACD',
      ],
      container_id: widgetIdRef.current,
    });

    containerWrapper.appendChild(script);
    containerRef.current.appendChild(containerWrapper);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, tvInterval, exchange]);

  const handleSelectTimeframe = (val) => {
    setActiveInterval(val);
    if (onIntervalChange) {
      onIntervalChange(val);
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      backgroundColor: '#070A14',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ── Top Multi-Timeframe & Exchange Header Bar ── */}
      {showTimeframeBar && (
        <div style={{
          height: 34,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 10px',
          background: 'rgba(10, 14, 28, 0.95)',
          borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
          zIndex: 25,
          userSelect: 'none',
        }}>
          {/* Left: Ticker Pill + Multi-Timeframe Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.35)',
              padding: '2px 7px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 800, color: '#F0F0FF',
              whiteSpace: 'nowrap'
            }}>
              <span>{paneLabel ? `${paneLabel}: ` : ''}{tvSymbol}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255, 255, 255, 0.04)', padding: '2px', borderRadius: 5, border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              {TV_TIMEFRAMES.map((tf) => {
                const isSel = activeInterval.toLowerCase() === tf.value.toLowerCase() ||
                  (tf.value === '1d' && activeInterval === '1d') ||
                  (tf.value === '1mo' && activeInterval === '1mo');

                return (
                  <button
                    key={tf.value}
                    type="button"
                    title={tf.desc}
                    onClick={() => handleSelectTimeframe(tf.value)}
                    style={{
                      padding: '2px 7px',
                      borderRadius: 3,
                      border: 'none',
                      background: isSel ? '#2563EB' : 'transparent',
                      color: isSel ? '#FFFFFF' : '#94A3B8',
                      fontSize: '0.68rem',
                      fontWeight: isSel ? 800 : 600,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {tf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Exchange Switcher (BSE / NSE) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(15, 23, 42, 0.9)',
            padding: '2px 5px',
            borderRadius: 5,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}>
            <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 700 }}>Feed:</span>
            <button
              type="button"
              onClick={() => setExchange('BSE')}
              style={{
                padding: '2px 6px',
                borderRadius: 3,
                border: 'none',
                background: exchange === 'BSE' ? '#3B82F6' : 'transparent',
                color: exchange === 'BSE' ? '#FFF' : '#64748B',
                fontSize: '0.66rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="BSE Data Feed (Unrestricted embed access for all Indian stocks)"
            >
              BSE
            </button>
            <button
              type="button"
              onClick={() => setExchange('NSE')}
              style={{
                padding: '2px 6px',
                borderRadius: 3,
                border: 'none',
                background: exchange === 'NSE' ? '#3B82F6' : 'transparent',
                color: exchange === 'NSE' ? '#FFF' : '#64748B',
                fontSize: '0.66rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="NSE Data Feed"
            >
              NSE
            </button>
          </div>
        </div>
      )}

      {/* ── Widget Container ── */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          height: '100%',
          flex: 1,
          minHeight: 0,
        }}
      />
    </div>
  );
}

export default memo(TradingViewAdvancedChart);
