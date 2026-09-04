import React from 'react';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { playAlertChime } from '../../utils/soundChime';

export default function PriceAlertModal({
  selectedSymbol = '',
  curPrice = null,
  showAlertModal = false,
  setShowAlertModal = () => {},
  targetAlertPrice = '',
  setTargetAlertPrice = () => {},
  priceAlerts = [],
  setPriceAlerts = () => {},
}) {
  if (!showAlertModal) return null;

  const numCurPrice = curPrice != null && !isNaN(Number(curPrice)) ? Number(curPrice) : null;
  const activeAlerts = Array.isArray(priceAlerts)
    ? priceAlerts.filter(a => a && a.ticker === selectedSymbol)
    : [];

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150 }}>
      <div style={{ background:'#0D1322', border:'1px solid rgba(168,85,247,0.4)', borderRadius:14, padding:20, width:380, maxWidth:'92vw', display:'flex', flexDirection:'column', gap:12, boxShadow:'0 20px 40px rgba(0,0,0,0.8)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, color:'#F0F0FF', fontSize:'1rem', display:'flex', alignItems:'center', gap:8 }}>
            <Bell size={16} color="#A855F7" /> Price Alerts: {selectedSymbol}
          </h3>
          <button
            onClick={() => {
              playAlertChime();
              toast.success('🔔 Alert Chime Tested');
            }}
            title="Test Crystal Audio Chime"
            style={{ padding:'2px 8px', borderRadius:4, background:'rgba(168,85,247,0.15)', border:'1px solid rgba(168,85,247,0.3)', color:'#A855F7', fontSize:'0.68rem', cursor:'pointer', fontWeight:700 }}
          >
            🔊 Test Chime
          </button>
        </div>

        <p style={{ margin:0, color:'#94A3B8', fontSize:'0.74rem' }}>
          Set an alert line on the chart canvas. Rings audio chime & sends toast notification on price hit:
        </p>

        {/* Quick Price Percentage Presets */}
        {numCurPrice != null && (
          <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
            {[-5, -2, -1, 1, 2, 5].map(pct => {
              const targetP = (numCurPrice * (1 + pct / 100)).toFixed(2);
              return (
                <button
                  key={pct}
                  onClick={() => setTargetAlertPrice(targetP)}
                  style={{
                    padding:'3px 6px', borderRadius:4, border:'1px solid rgba(255,255,255,0.1)',
                    background:'rgba(255,255,255,0.04)', color: pct > 0 ? '#10B981' : '#EF5350',
                    fontSize:'0.68rem', fontWeight:700, cursor:'pointer'
                  }}
                >
                  {pct > 0 ? `+${pct}%` : `${pct}%`} (₹{Number(targetP).toFixed(0)})
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display:'flex', gap:6 }}>
          <input
            type="number"
            step="0.05"
            placeholder={`Target Price (LTP ₹${numCurPrice != null ? numCurPrice.toFixed(2) : '0.00'})`}
            value={targetAlertPrice}
            onChange={e => setTargetAlertPrice(e.target.value)}
            style={{ flex:1, padding:'8px 12px', borderRadius:6, border:'1px solid rgba(168,85,247,0.3)', background:'#060913', color:'#fff', fontSize:'0.86rem', outline:'none', fontFamily:'JetBrains Mono, monospace' }}
          />
          <button
            onClick={() => {
              const p = Number(targetAlertPrice);
              if (p > 0) {
                const newAlert = {
                  id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  ticker: selectedSymbol,
                  price: p,
                  direction: numCurPrice && p > numCurPrice ? 'above' : 'below',
                  triggered: false,
                  createdAt: new Date().toISOString(),
                };
                setPriceAlerts(prev => [...(Array.isArray(prev) ? prev : []), newAlert]);
                toast.success(`🔔 Alert line created for ${selectedSymbol} at ₹${p.toFixed(2)}`);
                setTargetAlertPrice('');
              }
            }}
            style={{ padding:'8px 16px', borderRadius:6, border:'none', background:'#A855F7', color:'#fff', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}
          >
            + Add Alert
          </button>
        </div>

        {/* Active Alerts List for this Symbol */}
        <div style={{ maxHeight:160, overflowY:'auto', display:'flex', flexDirection:'column', gap:4, marginTop:4 }}>
          <div style={{ fontSize:'0.66rem', color:'#64748B', fontWeight:700, letterSpacing:'0.05em' }}>
            ACTIVE ALERTS ({activeAlerts.length})
          </div>
          {activeAlerts.length === 0 ? (
            <div style={{ fontSize:'0.72rem', color:'#475569', padding:'6px 0', fontStyle:'italic' }}>
              No alerts set for {selectedSymbol}.
            </div>
          ) : (
            activeAlerts.map(alert => (
              <div key={alert.id} style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'5px 8px', borderRadius:4, background:'rgba(255,255,255,0.03)',
                border: alert.triggered ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(168,85,247,0.2)',
                fontSize:'0.74rem'
              }}>
                <span style={{ color: alert.triggered ? '#10B981' : '#F0F0FF', fontFamily:'JetBrains Mono, monospace', fontWeight:700 }}>
                  ₹{Number(alert.price).toFixed(2)} {alert.triggered ? '✓ (Triggered)' : '⏳ Active'}
                </span>
                <button
                  onClick={() => setPriceAlerts(prev => (Array.isArray(prev) ? prev : []).filter(a => a && a.id !== alert.id))}
                  style={{ background:'none', border:'none', color:'#EF5350', cursor:'pointer', fontSize:'0.72rem', padding:'0 4px' }}
                  title="Delete Alert"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:6 }}>
          <button
            onClick={() => setShowAlertModal(false)}
            style={{ padding:'6px 14px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.05)', color:'#CBD5E1', cursor:'pointer', fontSize:'0.76rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
