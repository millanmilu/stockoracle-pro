import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';

export default function AIInsightCard() {
  const { selectedSymbol, predictionData, setPredictionData } = useStore();
  const [explainData, setExplainData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const fetchInsights = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const predRes = await api.get(`/api/stock/${selectedSymbol}/predict`);
      setPredictionData(predRes.data);

      try {
        const expRes = await api.get(`/api/stock/${selectedSymbol}/explain`);
        if (expRes.data && typeof expRes.data === 'object' && !expRes.data.detail) {
          setExplainData(expRes.data);
        } else {
          setExplainData({});
        }
      } catch {
        setExplainData({});
      }
    } catch (err) {
      console.error("Error fetching insights", err);
      setErrorMsg(err.response?.data?.detail || "AI model is currently training or initializing for this stock.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [selectedSymbol]);

  if (loading) {
    return (
      <div style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border, #333)', color: '#0ea5e9', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #0ea5e9', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <span>Loading AI Insights & Predictions for {selectedSymbol}...</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (errorMsg || !predictionData) {
    return (
      <div style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>⚠️ AI Model Initializing</div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #aaa)', marginBottom: 12 }}>{errorMsg || "Unable to load prediction data."}</div>
        <button onClick={fetchInsights} style={{ padding: '6px 14px', borderRadius: '6px', background: '#0ea5e9', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
          Retry Loading AI Insights
        </button>
      </div>
    );
  }

  const { current_price, predicted_price, high_bound, low_bound } = predictionData;
  const pct_change = ((predicted_price - current_price) / current_price) * 100;
  
  let color = '#eab308'; // yellow
  if (pct_change > 1) color = '#22c55e'; // green
  if (pct_change < -1) color = '#ef4444'; // red

  const formatPrice = (p) => {
    if (p == null) return '₹—';
    return `₹${Number(p).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border, #333)', display: 'flex', gap: '30px' }}>
      
      {/* Left side: Price */}
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '0.9rem' }}>Tomorrow's Prediction</h3>
        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: color }}>
          {formatPrice(predicted_price)}
        </div>
        <div style={{ color: '#888', marginTop: '5px' }}>
          Current: {formatPrice(current_price)} ({pct_change > 0 ? '+' : ''}{pct_change.toFixed(2)}%)
        </div>
        <div style={{ color: '#888', marginTop: '5px' }}>
          Confidence Range: {formatPrice(low_bound)} - {formatPrice(high_bound)}
        </div>
      </div>

      {/* Right side: Top Features */}
      <div style={{ flex: 1 }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: '0.9rem' }}>Key Drivers (XGBoost Gain)</h3>
        {Object.entries(explainData).map(([feature, pct]) => (
          <div key={feature} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
              <span style={{ color: '#ddd' }}>{feature.replace('_', ' ').toUpperCase()}</span>
              <span style={{ color: '#888' }}>{pct}%</span>
            </div>
            <div style={{ width: '100%', backgroundColor: 'var(--border, #333)', height: '6px', borderRadius: '3px' }}>
              <div style={{ width: `${pct}%`, backgroundColor: '#0ea5e9', height: '100%', borderRadius: '3px' }} />
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}
