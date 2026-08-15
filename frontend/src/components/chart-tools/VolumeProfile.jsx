import { useMemo } from 'react';

export default function VolumeProfile({ candles, width = 200, height = 400 }) {
  const profileData = useMemo(() => {
    if (!candles || candles.length === 0) return null;

    // Get price range safely
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i];
      if (c.high != null && c.high > maxPrice) maxPrice = c.high;
      if (c.low != null && c.low < minPrice) minPrice = c.low;
    }
    const priceRange = maxPrice - minPrice;
    
    if (!isFinite(priceRange) || priceRange <= 0) return null;

    // Create price bins (50 levels)
    const numLevels = 50;
    const binSize = priceRange / numLevels;
    const volumeByPrice = new Array(numLevels).fill(0);
    
    // Aggregate volume at each price level
    candles.forEach(candle => {
      const avgPrice = (candle.high + candle.low + candle.close) / 3;
      const binIndex = Math.floor((avgPrice - minPrice) / binSize);
      if (binIndex >= 0 && binIndex < numLevels) {
        volumeByPrice[binIndex] += candle.volume || 0;
      }
    });

    // Find POC (Point of Control) - price with highest volume
    const maxVolume = Math.max(...volumeByPrice);
    const pocIndex = volumeByPrice.indexOf(maxVolume);
    const pocPrice = minPrice + (pocIndex + 0.5) * binSize;

    // Calculate Value Area (70% of volume)
    const totalVolume = volumeByPrice.reduce((a, b) => a + b, 0);
    const targetVolume = totalVolume * 0.7;
    
    let sortedIndices = volumeByPrice
      .map((v, i) => ({ index: i, volume: v }))
      .sort((a, b) => b.volume - a.volume);
    
    let accumulatedVolume = 0;
    const valueAreaIndices = new Set();
    
    for (const { index } of sortedIndices) {
      accumulatedVolume += volumeByPrice[index];
      valueAreaIndices.add(index);
      if (accumulatedVolume >= targetVolume) break;
    }

    const vahIndex = Math.max(...valueAreaIndices);
    const valIndex = Math.min(...valueAreaIndices);
    const vahPrice = minPrice + (vahIndex + 0.5) * binSize;
    const valPrice = minPrice + (valIndex + 0.5) * binSize;

    return {
      volumeByPrice,
      minPrice,
      maxPrice,
      binSize,
      pocPrice,
      vahPrice,
      valPrice,
      maxVolume,
    };
  }, [candles]);

  if (!profileData) {
    return (
      <div style={{ 
        padding: 20, 
        textAlign: 'center', 
        color: '#6B7280',
        fontSize: '0.75rem'
      }}>
        No volume data available
      </div>
    );
  }

  const { 
    volumeByPrice, minPrice, maxPrice, binSize, 
    pocPrice, vahPrice, valPrice, maxVolume 
  } = profileData;

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      gap: 4,
      padding: '8px',
      background: 'rgba(9,12,24,0.95)',
      border: '1px solid rgba(168,85,247,0.2)',
      borderRadius: 8,
    }}>
      <div style={{ 
        fontSize: '0.7rem', 
        fontWeight: 700, 
        color: '#A855F7',
        textAlign: 'center',
        marginBottom: 4
      }}>
        VOLUME PROFILE
      </div>

      {/* Key Levels */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: 4, 
        fontSize: '0.62rem',
        marginBottom: 8
      }}>
        <div style={{ color: '#26A69A' }}>
          <div style={{ color: '#6B7280' }}>POC</div>
          <div style={{ fontWeight: 700 }}>₹{pocPrice.toFixed(2)}</div>
        </div>
        <div style={{ color: '#F59E0B' }}>
          <div style={{ color: '#6B7280' }}>VAH</div>
          <div style={{ fontWeight: 700 }}>₹{vahPrice.toFixed(2)}</div>
        </div>
        <div style={{ color: '#3B82F6' }}>
          <div style={{ color: '#6B7280' }}>VAL</div>
          <div style={{ fontWeight: 700 }}>₹{valPrice.toFixed(2)}</div>
        </div>
        <div style={{ color: '#9CA3AF' }}>
          <div style={{ color: '#6B7280' }}>Range</div>
          <div style={{ fontWeight: 700 }}>{((maxPrice-minPrice)/minPrice*100).toFixed(2)}%</div>
        </div>
      </div>

      {/* Volume Histogram */}
      <div style={{ 
        position: 'relative', 
        height: height, 
        display: 'flex', 
        alignItems: 'flex-end',
        gap: 1,
        overflow: 'hidden'
      }}>
        {volumeByPrice.map((vol, idx) => {
          const normalizedHeight = (vol / maxVolume) * 100;
          const price = minPrice + (idx + 0.5) * binSize;
          const isPOC = Math.abs(price - pocPrice) < binSize;
          const isVAH = Math.abs(price - vahPrice) < binSize;
          const isVAL = Math.abs(price - valPrice) < binSize;
          
          let barColor = 'rgba(168,85,247,0.4)';
          if (isPOC) barColor = 'rgba(245,158,11,0.8)';
          else if (isVAH || isVAL) barColor = 'rgba(59,130,246,0.6)';

          return (
            <div
              key={idx}
              title={`₹${price.toFixed(2)}: Vol ${vol.toLocaleString()}`}
              style={{
                flex: 1,
                height: `${Math.max(normalizedHeight, 1)}%`,
                background: barColor,
                borderRadius: '1px 1px 0 0',
                cursor: 'pointer',
                transition: 'all 0.1s',
              }}
            />
          );
        })}
      </div>

      {/* Price Scale */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        fontSize: '0.6rem',
        color: '#6B7280',
        marginTop: 4
      }}>
        <span>₹{minPrice.toFixed(2)}</span>
        <span>₹{maxPrice.toFixed(2)}</span>
      </div>

      {/* Legend */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        justifyContent: 'center',
        fontSize: '0.58rem',
        color: '#6B7280',
        marginTop: 4
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, background: 'rgba(245,158,11,0.8)', borderRadius: 1 }} />
          POC
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, background: 'rgba(59,130,246,0.6)', borderRadius: 1 }} />
          VA Boundary
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 8, height: 8, background: 'rgba(168,85,247,0.4)', borderRadius: 1 }} />
        Volume
        </span>
      </div>
    </div>
  );
}
