import { useMemo, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

const TIMEFRAME_CORRELATIONS = [
  { id: '1m_5m', tf1: '1m', tf2: '5m', label: '1m vs 5m' },
  { id: '5m_15m', tf1: '5m', tf2: '15m', label: '5m vs 15m' },
  { id: '15m_1h', tf1: '15m', tf2: '1h', label: '15m vs 1H' },
  { id: '1h_1d', tf1: '1h', tf2: '1d', label: '1H vs 1D' },
];

export default function MultiTimeframeCorrelation({ candles, symbol }) {
  const [selectedCorrelation, setSelectedCorrelation] = useState(TIMEFRAME_CORRELATIONS[0].id);
  
  // Simulate multi-timeframe data (in production, fetch from API)
  const correlationData = useMemo(() => {
    if (!candles || candles.length < 20) return null;
    
    // Calculate price changes at different timeframes
    const returns = {
      '1m': [],
      '5m': [],
      '15m': [],
      '1h': [],
      '1d': [],
    };
    
    // Simplified: use current candles and simulate other timeframes
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      
      const ret1m = ((curr.close - prev.close) / prev.close) * 100;
      returns['1m'].push(ret1m);
      
      // Aggregate for higher timeframes (simplified)
      if (i % 5 === 0) {
        const ret5m = ((curr.close - candles[i - 5]?.close) / candles[i - 5]?.close) * 100 || 0;
        returns['5m'].push(ret5m);
      }
      if (i % 15 === 0) {
        const ret15m = ((curr.close - candles[i - 15]?.close) / candles[i - 15]?.close) * 100 || 0;
        returns['15m'].push(ret15m);
      }
      if (i % 60 === 0) {
        const ret1h = ((curr.close - candles[i - 60]?.close) / candles[i - 60]?.close) * 100 || 0;
        returns['1h'].push(ret1h);
      }
      returns['1d'].push(((curr.close - prev.close) / prev.close) * 100);
    }
    
    // Calculate correlation coefficient between two timeframes
    const calculateCorrelation = (arr1, arr2) => {
      const n = Math.min(arr1.length, arr2.length);
      if (n < 5) return 0;
      
      const slice1 = arr1.slice(-n);
      const slice2 = arr2.slice(-n);
      
      const mean1 = slice1.reduce((a, b) => a + b, 0) / n;
      const mean2 = slice2.reduce((a, b) => a + b, 0) / n;
      
      let numerator = 0;
      let denom1 = 0;
      let denom2 = 0;
      
      for (let i = 0; i < n; i++) {
        const diff1 = slice1[i] - mean1;
        const diff2 = slice2[i] - mean2;
        numerator += diff1 * diff2;
        denom1 += diff1 * diff1;
        denom2 += diff2 * diff2;
      }
      
      const denominator = Math.sqrt(denom1 * denom2);
      return denominator === 0 ? 0 : numerator / denominator;
    };
    
    const correlations = {};
    TIMEFRAME_CORRELATIONS.forEach(cf => {
      correlations[cf.id] = calculateCorrelation(returns[cf.tf1], returns[cf.tf2]);
    });
    
    // Calculate momentum alignment
    const shortTermMom = returns['1m'].slice(-5).reduce((a, b) => a + b, 0);
    const mediumTermMom = returns['5m'].slice(-5).reduce((a, b) => a + b, 0);
    const longTermMom = returns['1d'].slice(-5).reduce((a, b) => a + b, 0);
    
    const alignment = {
      short: shortTermMom > 0 ? 'bullish' : shortTermMom < 0 ? 'bearish' : 'neutral',
      medium: mediumTermMom > 0 ? 'bullish' : mediumTermMom < 0 ? 'bearish' : 'neutral',
      long: longTermMom > 0 ? 'bullish' : longTermMom < 0 ? 'bearish' : 'neutral',
    };
    
    // Signal strength based on alignment
    let signalStrength = 0;
    if (alignment.short === alignment.medium && alignment.medium === alignment.long) {
      signalStrength = alignment.short === 'bullish' ? 100 : -100;
    } else if (alignment.short === alignment.medium) {
      signalStrength = alignment.short === 'bullish' ? 60 : -60;
    } else if (alignment.medium === alignment.long) {
      signalStrength = alignment.medium === 'bullish' ? 70 : -70;
    }
    
    return {
      correlations,
      alignment,
      signalStrength,
      returns,
    };
  }, [candles]);

  if (!correlationData) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: '#6B7280',
        fontSize: '0.75rem'
      }}>
        Insufficient data for correlation analysis
      </div>
    );
  }

  const { correlations, alignment, signalStrength, returns } = correlationData;
  const selected = TIMEFRAME_CORRELATIONS.find(c => c.id === selectedCorrelation);
  const selectedCorr = correlations[selectedCorrelation];

  const getCorrelationColor = (corr) => {
    if (corr >= 0.7) return '#26A69A';
    if (corr >= 0.4) return '#F59E0B';
    if (corr >= -0.4) return '#6B7280';
    if (corr >= -0.7) return '#F59E0B';
    return '#EF5350';
  };

  const getCorrelationLabel = (corr) => {
    if (corr >= 0.8) return 'Very Strong +';
    if (corr >= 0.6) return 'Strong +';
    if (corr >= 0.4) return 'Moderate +';
    if (corr >= -0.4) return 'Weak/None';
    if (corr >= -0.6) return 'Moderate -';
    if (corr >= -0.8) return 'Strong -';
    return 'Very Strong -';
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 8,
      padding: '10px',
      background: 'rgba(9,12,24,0.95)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 10,
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
      }}>
        <div style={{ 
          fontSize: '0.72rem', 
          fontWeight: 700, 
          color: '#A855F7',
          display: 'flex',
          alignItems: 'center',
          gap: 5
        }}>
          <Activity size={13} />
          MULTI-TIMEFRAME CORRELATION
        </div>
        <div style={{ 
          fontSize: '0.6rem', 
          color: '#6B7280'
        }}>
          {symbol}
        </div>
      </div>

      {/* Timeframe Selector */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 4, 
        marginBottom: 8 
      }}>
        {TIMEFRAME_CORRELATIONS.map(cf => (
          <button
            key={cf.id}
            onClick={() => setSelectedCorrelation(cf.id)}
            style={{
              padding: '4px 6px',
              borderRadius: 6,
              border: selectedCorrelation === cf.id ? '1px solid #A855F7' : '1px solid rgba(75,85,99,0.3)',
              background: selectedCorrelation === cf.id ? 'rgba(168,85,247,0.15)' : 'transparent',
              color: selectedCorrelation === cf.id ? '#C084FC' : '#9CA3AF',
              fontSize: '0.68rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cf.label}
          </button>
        ))}
      </div>

      {/* Selected Correlation Display */}
      <div style={{
        padding: '10px',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${getCorrelationColor(selectedCorr)}`,
        textAlign: 'center',
        marginBottom: 8
      }}>
        <div style={{ fontSize: '0.68rem', color: '#94A3B8', marginBottom: 4 }}>
          {selected?.label} Correlation
        </div>
        <div style={{ 
          fontSize: '1.15rem', 
          fontWeight: 800, 
          color: getCorrelationColor(selectedCorr),
          fontFamily: 'JetBrains Mono, monospace'
        }}>
          {selectedCorr.toFixed(3)}
        </div>
        <div style={{ 
          fontSize: '0.7rem', 
          color: getCorrelationColor(selectedCorr),
          marginTop: 2,
          fontWeight: 600
        }}>
          {getCorrelationLabel(selectedCorr)}
        </div>
      </div>

      {/* Momentum Alignment */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ 
          fontSize: '0.65rem', 
          fontWeight: 700, 
          color: '#6B7280',
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 4
        }}>
          <BarChart3 size={11} />
          MOMENTUM ALIGNMENT
        </div>
        
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {[
            { label: 'Short', value: alignment.short, mom: returns['1m']?.slice(-5).reduce((a,b)=>a+b,0)||0 },
            { label: 'Medium', value: alignment.medium, mom: returns['5m']?.slice(-5).reduce((a,b)=>a+b,0)||0 },
            { label: 'Long', value: alignment.long, mom: returns['1d']?.slice(-5).reduce((a,b)=>a+b,0)||0 },
          ].map(item => (
            <div
              key={item.label}
              style={{
                flex: 1,
                padding: '6px 4px',
                borderRadius: 6,
                background: item.value === 'bullish' 
                  ? 'rgba(38,166,154,0.1)' 
                  : item.value === 'bearish'
                  ? 'rgba(239,83,80,0.1)'
                  : 'rgba(107,114,128,0.1)',
                border: `1px solid ${
                  item.value === 'bullish' 
                    ? 'rgba(38,166,154,0.3)' 
                    : item.value === 'bearish'
                    ? 'rgba(239,83,80,0.3)'
                    : 'rgba(107,114,128,0.3)'
                }`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '0.55rem', color: '#6B7280', marginBottom: 2 }}>
                {item.label}
              </div>
              <div style={{ 
                fontSize: '0.62rem', 
                fontWeight: 700,
                color: item.value === 'bullish' 
                  ? '#26A69A' 
                  : item.value === 'bearish'
                  ? '#EF5350'
                  : '#6B7280',
              }}>
                {item.value === 'bullish' && <TrendingUp size={10} style={{ display: 'inline', marginRight: 2 }} />}
                {item.value === 'bearish' && <TrendingDown size={10} style={{ display: 'inline', marginRight: 2 }} />}
                {item.value === 'neutral' && <Minus size={10} style={{ display: 'inline', marginRight: 2 }} />}
                {Math.abs(item.mom).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Signal Strength Meter */}
      <div style={{
        padding: '8px',
        borderRadius: 8,
        background: signalStrength >= 70 
          ? 'rgba(38,166,154,0.1)' 
          : signalStrength <= -70
          ? 'rgba(239,83,80,0.1)'
          : 'rgba(245,158,11,0.1)',
        border: `1px solid ${
          signalStrength >= 70 
            ? 'rgba(38,166,154,0.3)' 
            : signalStrength <= -70
            ? 'rgba(239,83,80,0.3)'
            : 'rgba(245,158,11,0.3)'
        }`,
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#6B7280' }}>
            SIGNAL STRENGTH
          </span>
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: 700,
            color: signalStrength >= 70 
              ? '#26A69A' 
              : signalStrength <= -70
              ? '#EF5350'
              : '#F59E0B',
          }}>
            {signalStrength >= 0 ? '+' : ''}{signalStrength.toFixed(0)}
          </span>
        </div>
        <div style={{ 
          height: 6, 
          background: 'rgba(255,255,255,0.05)', 
          borderRadius: 99, 
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            left: '50%',
            width: 2,
            height: '100%',
            background: 'rgba(255,255,255,0.3)',
            transform: 'translateX(-50%)',
          }} />
          <div style={{
            position: 'absolute',
            left: `${50 + signalStrength / 2}%`,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: signalStrength >= 70 
              ? '#26A69A' 
              : signalStrength <= -70
              ? '#EF5350'
              : '#F59E0B',
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 0 8px ${
              signalStrength >= 70 
                ? 'rgba(38,166,154,0.6)' 
                : signalStrength <= -70
                ? 'rgba(239,83,80,0.6)'
                : 'rgba(245,158,11,0.6)'
            }`,
          }} />
        </div>
        <div style={{ 
          fontSize: '0.58rem', 
          color: '#6B7280', 
          textAlign: 'center',
          marginTop: 4
        }}>
          {signalStrength >= 80 ? '🔥 STRONG BUY ALIGNMENT' : 
           signalStrength >= 60 ? '▲ BULLISH BIAS' :
           signalStrength <= -80 ? '💥 STRONG SELL ALIGNMENT' :
           signalStrength <= -60 ? '▼ BEARISH BIAS' :
           '⚖️ MIXED SIGNALS - WAIT'}
        </div>
      </div>

      {/* All Correlations Summary */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, 1fr)', 
        gap: 4,
        marginTop: 6,
        paddingTop: 6,
        borderTop: '1px solid rgba(255,255,255,0.05)'
      }}>
        {TIMEFRAME_CORRELATIONS.map(cf => (
          <div
            key={cf.id}
            style={{
              padding: '4px 6px',
              borderRadius: 6,
              background: selectedCorrelation === cf.id ? 'rgba(168,85,247,0.1)' : 'transparent',
              border: selectedCorrelation === cf.id ? '1px solid rgba(168,85,247,0.3)' : '1px solid transparent',
            }}
          >
            <div style={{ fontSize: '0.55rem', color: '#6B7280' }}>{cf.label}</div>
            <div style={{ 
              fontSize: '0.7rem', 
              fontWeight: 700, 
              color: getCorrelationColor(correlations[cf.id]),
              fontFamily: 'JetBrains Mono, monospace'
            }}>
              {correlations[cf.id].toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
