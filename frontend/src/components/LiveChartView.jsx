import React from 'react';

export default function LiveChartView() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      width: '100%',
      backgroundColor: '#090C15',
      color: '#818CF8',
      fontFamily: 'JetBrains Mono, monospace',
      gap: 12
    }}>
      <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>⚡ StockOracle Live Chart</div>
      <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>Ready for fresh clean rebuild.</div>
    </div>
  );
}
