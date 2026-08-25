import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import { Sparkles } from 'lucide-react';

export default function AIInsightCard() {
  const { selectedSymbol, predictionData, setPredictionData } = useStore();
  const [explainData, setExplainData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [aiExplanation, setAiExplanation] = useState(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const fetchInsights = async () => {
    setLoading(true);
    setErrorMsg(null);
    setAiExplanation(null);
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

      // Fetch Gemini trade explanation (non-blocking)
      setExplanationLoading(true);
      api.get(`/api/stock/${selectedSymbol}/ai-trade-explain`)
        .then(({ data }) => setAiExplanation(data))
        .catch(() => setAiExplanation(null))
        .finally(() => setExplanationLoading(false));

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
  const pct_change = (current_price && predicted_price && typeof current_price === 'number' && typeof predicted_price === 'number')
    ? ((predicted_price - current_price) / current_price) * 100
    : null;

  let color = '#eab308'; // yellow
  if (pct_change !== null && pct_change > 1) color = '#22c55e'; // green
  if (pct_change !== null && pct_change < -1) color = '#ef4444'; // red

  const formatPrice = (p) => {
    if (p == null || isNaN(p)) return '₹—';
    return `₹${Number(p).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  };

  return (
    <div style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border, #333)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
        {/* Left side: Price */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#aaa', fontSize: '0.9rem' }}>Tomorrow's Prediction</h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: color }}>
            {formatPrice(predicted_price)}
          </div>
          <div style={{ color: '#888', marginTop: '5px' }}>
            Current: {formatPrice(current_price)} {pct_change !== null && !isNaN(pct_change) ? `(${pct_change > 0 ? '+' : ''}${pct_change.toFixed(2)}%)` : ''}
          </div>
          <div style={{ color: '#888', marginTop: '5px' }}>
            Confidence Range: {formatPrice(low_bound)} - {formatPrice(high_bound)}
          </div>
        </div>

        {/* Right side: Top Features */}
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: '0 0 15px 0', color: '#aaa', fontSize: '0.9rem' }}>Key Drivers (XGBoost Gain)</h3>
          {Object.entries(explainData || {}).map(([feature, pct]) => (
            <div key={feature} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                <span style={{ color: '#ddd' }}>{String(feature || '').replace(/_/g, ' ').toUpperCase()}</span>
                <span style={{ color: '#888' }}>{pct}%</span>
              </div>
              <div style={{ width: '100%', backgroundColor: 'var(--border, #333)', height: '6px', borderRadius: '3px' }}>
                <div style={{ width: `${pct}%`, backgroundColor: '#0ea5e9', height: '100%', borderRadius: '3px' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gemini Trade Explanation */}
      {(explanationLoading || aiExplanation) && (
        <div style={{
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Sparkles size={13} color="#818CF8" />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#818CF8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              AI Trade Explanation
            </span>
          </div>
          {explanationLoading ? (
            <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>Generating explanation…</div>
          ) : aiExplanation?.explanation ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#CBD5E1', lineHeight: 1.65 }}>
              {aiExplanation.explanation}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}


