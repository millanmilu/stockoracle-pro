import { useMemo } from 'react';

export default function OrderFlow({ candles, showImbalance = true }) {
  const orderFlowData = useMemo(() => {
    if (!candles || candles.length < 2) return null;

    const flowMetrics = [];
    
    for (let i = 1; i < candles.length; i++) {
      const prev = candles[i - 1];
      const curr = candles[i];
      
      // Calculate delta (buying vs selling pressure)
      const closeDelta = curr.close - prev.close;
      const highDelta = curr.high - prev.high;
      const lowDelta = curr.low - prev.low;
      
      // Volume-weighted momentum
      const volume = curr.volume || 0;
      const avgPrice = (curr.open + curr.high + curr.low + curr.close) / 4;
      const priceChange = curr.close - curr.open;
      
      // Delta calculation: positive = buying pressure, negative = selling
      let delta = 0;
      if (priceChange > 0) {
        delta = volume * (priceChange / avgPrice) * 100;
      } else {
        delta = -volume * (Math.abs(priceChange) / avgPrice) * 100;
      }
      
      // Cumulative delta
      const cumDelta = flowMetrics.length > 0 
        ? flowMetrics[flowMetrics.length - 1].cumDelta + delta 
        : delta;
      
      // Identify imbalance (large delta with small range)
      const range = curr.high - curr.low;
      const isImbalance = Math.abs(delta) > (volume * 0.5) && range < (avgPrice * 0.02);
      
      // Absorption detection (high volume, small price change)
      const isAbsorption = volume > (flowMetrics.slice(-10).reduce((a, b) => a + (b.avgVol || 0), 0) / 10 || volume) * 1.5 
        && Math.abs(priceChange) / avgPrice < 0.005;
      
      flowMetrics.push({
        time: curr.time,
        date: curr.date,
        delta,
        cumDelta,
        volume,
        avgPrice,
        priceChange,
        isImbalance,
        isAbsorption,
        openInterest: curr.open_interest || 0,
      });
    }
    
    // Calculate statistics safely without call stack overflow
    const deltas = flowMetrics.map(m => m.delta);
    const maxDelta = deltas.length > 0 ? deltas.reduce((m, v) => (v > m ? v : m), -Infinity) : 0;
    const minDelta = deltas.length > 0 ? deltas.reduce((m, v) => (v < m ? v : m), Infinity) : 0;
    const avgDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    
    // Find divergence points (price making new high/low but delta not confirming)
    const divergences = [];
    for (let i = 10; i < flowMetrics.length; i++) {
      const lookback = 10;
      const recentHigh = Math.max(...flowMetrics.slice(i - lookback, i).map(m => m.avgPrice));
      const recentLow = Math.min(...flowMetrics.slice(i - lookback, i).map(m => m.avgPrice));
      const prevCumDelta = flowMetrics[i - lookback]?.cumDelta || 0;
      const currCumDelta = flowMetrics[i].cumDelta;
      
      // Bullish divergence: lower low in price, higher low in delta
      if (flowMetrics[i].avgPrice < recentLow && currCumDelta > prevCumDelta) {
        divergences.push({ index: i, type: 'bullish' });
      }
      // Bearish divergence: higher high in price, lower high in delta
      else if (flowMetrics[i].avgPrice > recentHigh && currCumDelta < prevCumDelta) {
        divergences.push({ index: i, type: 'bearish' });
      }
    }
    
    return {
      flowMetrics,
      maxDelta,
      minDelta,
      avgDelta,
      divergences,
    };
  }, [candles]);

  if (!orderFlowData || orderFlowData.flowMetrics.length === 0) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: '#6B7280',
        fontSize: '0.75rem'
      }}>
        Insufficient data for order flow analysis
      </div>
    );
  }

  const { flowMetrics, maxDelta, minDelta, avgDelta, divergences } = orderFlowData;
  const latestMetrics = flowMetrics.slice(-20); // Show last 20 periods
  
  const netFlow = flowMetrics.slice(-10).reduce((a, b) => a + b.delta, 0);
  const bullishPercent = flowMetrics.filter(m => m.delta > 0).length / flowMetrics.length * 100;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 8,
      padding: '8px',
      background: 'rgba(9,12,24,0.95)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 8,
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
      }}>
        <div style={{ 
          fontSize: '0.7rem', 
          fontWeight: 700, 
          color: '#A855F7'
        }}>
          ORDER FLOW ANALYSIS
        </div>
        <div style={{ 
          fontSize: '0.62rem', 
          color: netFlow >= 0 ? '#26A69A' : '#EF5350',
          fontWeight: 700
        }}>
          Net Flow: {netFlow >= 0 ? '+' : ''}{netFlow.toFixed(0)}
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 4, 
        fontSize: '0.6rem',
        marginBottom: 8
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6B7280' }}>Buy Pressure</div>
          <div style={{ color: '#26A69A', fontWeight: 700 }}>{bullishPercent.toFixed(1)}%</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6B7280' }}>Sell Pressure</div>
          <div style={{ color: '#EF5350', fontWeight: 700 }}>{(100-bullishPercent).toFixed(1)}%</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6B7280' }}>Avg Delta</div>
          <div style={{ color: avgDelta >= 0 ? '#26A69A' : '#EF5350', fontWeight: 700 }}>
            {avgDelta >= 0 ? '+' : ''}{avgDelta.toFixed(0)}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: '#6B7280' }}>Divergences</div>
          <div style={{ color: '#F59E0B', fontWeight: 700 }}>{divergences.length}</div>
        </div>
      </div>

      {/* Delta Bars */}
      <div style={{ 
        height: 80, 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2,
        position: 'relative'
      }}>
        <div style={{ 
          position: 'absolute', 
          left: 0, 
          right: 0, 
          top: '50%', 
          height: 1, 
          background: 'rgba(255,255,255,0.1)' 
        }} />
        
        {latestMetrics.map((m, idx) => {
          const normalizedHeight = Math.abs(m.delta) / Math.max(Math.abs(maxDelta), Math.abs(minDelta)) * 100;
          const isPositive = m.delta > 0;
          
          return (
            <div
              key={idx}
              title={`Delta: ${m.delta.toFixed(0)} | Vol: ${m.volume.toLocaleString()}`}
              style={{
                flex: 1,
                height: `${Math.max(normalizedHeight, 5)}%`,
                background: isPositive ? 'rgba(38,166,154,0.6)' : 'rgba(239,83,80,0.6)',
                borderRadius: m.delta !== 0 ? '1px 1px 0 0' : '0',
                alignSelf: isPositive ? 'flex-end' : 'flex-start',
                cursor: 'pointer',
                opacity: m.isImbalance ? 1 : 0.7,
                border: m.isImbalance ? '1px solid #F59E0B' : 'none',
              }}
            />
          );
        })}
      </div>

      {/* Cumulative Delta Trend */}
      {(() => {
        const cumDeltas = latestMetrics.map(x => x.cumDelta);
        const maxCum = cumDeltas.length > 0 ? cumDeltas.reduce((m, v) => (v > m ? v : m), -Infinity) : 0;
        const minCum = cumDeltas.length > 0 ? cumDeltas.reduce((m, v) => (v < m ? v : m), Infinity) : 0;
        const range = maxCum - minCum || 1;

        return (
          <div style={{ 
            height: 40, 
            display: 'flex', 
            alignItems: 'flex-end',
            gap: 2
          }}>
            {latestMetrics.map((m, idx) => {
              const normalizedHeight = ((m.cumDelta - minCum) / range) * 100;
              return (
                <div
                  key={`cum-${idx}`}
                  style={{
                    flex: 1,
                    height: `${normalizedHeight}%`,
                    background: 'rgba(168,85,247,0.4)',
                    borderRadius: '1px 1px 0 0',
                  }}
                />
              );
            })}
          </div>
        );
      })()}

      {/* Signal Indicators */}
      <div style={{ 
        display: 'flex', 
        gap: 4, 
        flexWrap: 'wrap',
        marginTop: 4
      }}>
        {latestMetrics.some(m => m.isImbalance) && (
          <div style={{
            padding: '3px 6px',
            borderRadius: 4,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#F59E0B',
            fontSize: '0.58rem',
            fontWeight: 600,
          }}>
            ⚡ Imbalance Detected
          </div>
        )}
        
        {latestMetrics.some(m => m.isAbsorption) && (
          <div style={{
            padding: '3px 6px',
            borderRadius: 4,
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.3)',
            color: '#60A5FA',
            fontSize: '0.58rem',
            fontWeight: 600,
          }}>
            🧱 Absorption Zone
          </div>
        )}
        
        {divergences.length > 0 && (
          <div style={{
            padding: '3px 6px',
            borderRadius: 4,
            background: 'rgba(168,85,247,0.1)',
            border: '1px solid rgba(168,85,247,0.3)',
            color: '#C084FC',
            fontSize: '0.58rem',
            fontWeight: 600,
          }}>
            🔄 Divergence Active
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ 
        fontSize: '0.58rem', 
        color: '#6B7280', 
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        paddingTop: 4
      }}>
        Last {latestMetrics.length} periods • Green=Buying • Red=Selling
      </div>
    </div>
  );
}
