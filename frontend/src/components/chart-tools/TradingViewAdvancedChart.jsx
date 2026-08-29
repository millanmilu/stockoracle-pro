import React, { useEffect, useRef, useState, memo } from 'react';
import { RefreshCw, ExternalLink, Sparkles, Shield, Maximize2 } from 'lucide-react';

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

function formatTVSymbol(rawSymbol) {
  if (!rawSymbol) return 'NSE:RELIANCE';
  const clean = rawSymbol.toUpperCase().trim();
  if (SYMBOL_MAP[clean]) return SYMBOL_MAP[clean];
  if (clean.includes(':')) return clean;
  return `NSE:${clean}`;
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

function TradingViewAdvancedChart({ symbol = 'RELIANCE', interval = '1d', onOpenSettings }) {
  const containerRef = useRef(null);
  const containerId = useRef(`tradingview_full_${Math.random().toString(36).substring(2, 9)}`);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const tvSymbol = formatTVSymbol(symbol);
  const tvInterval = formatTVInterval(interval);

  // 1. Inject TradingView official embed script once
  useEffect(() => {
    if (window.TradingView) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.getElementById('tradingview-widget-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.id = 'tradingview-widget-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setLoadError(true);
    document.head.appendChild(script);
  }, []);

  // 2. Initialize / Update TradingView Full Widget
  useEffect(() => {
    if (!scriptLoaded || !window.TradingView || !containerRef.current) return;

    let widgetInstance = null;

    try {
      // Clear container contents
      containerRef.current.innerHTML = '';

      const widgetDiv = document.createElement('div');
      widgetDiv.id = containerId.current;
      widgetDiv.style.width = '100%';
      widgetDiv.style.height = '100%';
      containerRef.current.appendChild(widgetDiv);

      widgetInstance = new window.TradingView.widget({
        autosize: true,
        symbol: tvSymbol,
        interval: tvInterval,
        timezone: 'Asia/Kolkata',
        theme: 'dark',
        style: '1', // 1 = Candles, 2 = Line, 3 = Area, 4 = Bars, 8 = Heikin Ashi
        locale: 'in',
        toolbar_bg: '#070A14',
        enable_publishing: false,
        allow_symbol_change: true,
        hide_side_toolbar: false, // Show all 80+ drawing tools on left
        withdateranges: true,
        save_image: true,
        container_id: containerId.current,
        studies: [
          'MASimple@tv-basicstudies',
          'RSI@tv-basicstudies',
          'MACD@tv-basicstudies',
        ],
        drawings_access: {
          type: 'black',
          tools: [],
        },
        disabled_features: [
          'header_symbol_search',
          'use_localstorage_for_settings',
        ],
        enabled_features: [
          'study_templates',
          'side_toolbar_in_fullscreen_mode',
          'header_in_fullscreen_mode',
          'items_favoriting',
          'show_zoom_and_move_buttons_on_touch',
        ],
        overrides: {
          'paneProperties.background': '#070A14',
          'paneProperties.vertGridProperties.color': 'rgba(255, 255, 255, 0.04)',
          'paneProperties.horzGridProperties.color': 'rgba(255, 255, 255, 0.04)',
          'scalesProperties.textColor': '#94A3B8',
          'scalesProperties.lineColor': 'rgba(255, 255, 255, 0.08)',
          'mainSeriesProperties.candleStyle.upColor': '#10B981',
          'mainSeriesProperties.candleStyle.downColor': '#EF4444',
          'mainSeriesProperties.candleStyle.drawWick': true,
          'mainSeriesProperties.candleStyle.drawBorder': true,
          'mainSeriesProperties.candleStyle.borderColor': '#1E293B',
          'mainSeriesProperties.candleStyle.borderUpColor': '#10B981',
          'mainSeriesProperties.candleStyle.borderDownColor': '#EF4444',
          'mainSeriesProperties.candleStyle.wickUpColor': '#10B981',
          'mainSeriesProperties.candleStyle.wickDownColor': '#EF4444',
          'mainSeriesProperties.hollowCandleStyle.upColor': '#10B981',
          'mainSeriesProperties.hollowCandleStyle.downColor': '#EF4444',
          'mainSeriesProperties.haStyle.upColor': '#10B981',
          'mainSeriesProperties.haStyle.downColor': '#EF4444',
        },
      });
    } catch (err) {
      console.error('TradingView Widget initialization error:', err);
      setLoadError(true);
    }

    return () => {
      try {
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      } catch (_) {}
    };
  }, [scriptLoaded, tvSymbol, tvInterval]);

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
      {/* Loading state */}
      {!scriptLoaded && !loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#070A14',
          zIndex: 10,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '3px solid rgba(41,98,255,0.2)',
            borderTopColor: '#2962FF',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ fontSize: '0.8rem', color: '#94A3B8', fontFamily: 'JetBrains Mono, monospace' }}>
            Initializing TradingView Full Heavy Engine…
          </span>
        </div>
      )}

      {/* Error state */}
      {loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#070A14',
          zIndex: 10,
          color: '#EF4444',
          padding: 20,
          textAlign: 'center',
        }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            Unable to connect to TradingView Engine CDN
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94A3B8', maxWidth: 400 }}>
            Please check your internet connection or switch back to the StockOracle AI Engine in the header.
          </span>
        </div>
      )}

      {/* Main TradingView Container */}
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
