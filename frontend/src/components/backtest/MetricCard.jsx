import React from 'react';

  const MetricCard = ({ label, value, sub, col, icon: Icon }) => (
    <div style={{
      background: 'rgba(15, 23, 42, 0.75)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: 10, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: '0.64rem', color: '#64748B', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</span>
        {Icon && <Icon size={12} style={{ color: '#475569' }} />}
      </div>
      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: col || '#F8FAFC', fontFamily: 'JetBrains Mono, monospace' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '0.63rem', color: '#94A3B8', marginTop: 2 }}>{sub}</div>}
    </div>
  );

export default MetricCard;
