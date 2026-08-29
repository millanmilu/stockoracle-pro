import React, { useEffect, useRef, useState, memo } from 'react';

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
    '5m': '5',
    '15m': '15',
    '1h': '60',
    '1d': 'D',
    '1w': 'W',
    '1mo': 'M',
  };
  return map[rawInterval?.toLowerCase()] || 'D';
}

function TradingViewAdvancedChart({ symbol = 'RELIANCE', interval = '1d' }) {
  const containerRef = useRef(null);
  const [exchange, setExchange] = useState('BSE'); // 'BSE' has unrestricted embed access across all TradingView domains

  const tvSymbol = formatTVSymbol(symbol, exchange);
  const tvInterval = formatTVInterval(interval);

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
      container_id: 'tradingview_advanced_widget',
    });

    containerWrapper.appendChild(script);
    containerRef.current.appendChild(containerWrapper);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [tvSymbol, tvInterval, exchange]);

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
      {/* Top Exchange Switcher Bar */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 12,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(15, 23, 42, 0.92)',
        padding: '3px 8px',
        borderRadius: 6,
        border: '1px solid rgba(99, 102, 241, 0.3)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)',
      }}>
        <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontWeight: 700 }}>Feed:</span>
        <button
          type="button"
          onClick={() => setExchange('BSE')}
          style={{
            padding: '2px 7px',
            borderRadius: 4,
            border: 'none',
            background: exchange === 'BSE' ? '#2563EB' : 'transparent',
            color: exchange === 'BSE' ? '#FFF' : '#64748B',
            fontSize: '0.68rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title="BSE Feed (Unrestricted embed access for Indian Equities)"
        >
          BSE
        </button>
        <button
          type="button"
          onClick={() => setExchange('NSE')}
          style={{
            padding: '2px 7px',
            borderRadius: 4,
            border: 'none',
            background: exchange === 'NSE' ? '#2563EB' : 'transparent',
            color: exchange === 'NSE' ? '#FFF' : '#64748B',
            fontSize: '0.68rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title="NSE Feed"
        >
          NSE
        </button>
      </div>

      {/* Widget Container */}
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
