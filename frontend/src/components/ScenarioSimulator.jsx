import React, { useState, useEffect } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';

export default function ScenarioSimulator() {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const predictionData = useStore(s => s.predictionData);
  const setPredictionData = useStore(s => s.setPredictionData);
  const [sentiment, setSentiment] = useState(0);
  const [volatility, setVolatility] = useState(1);
  const [volume, setVolume] = useState(1);

  const [initialLoad, setInitialLoad] = useState(true);
  const [simError, setSimError] = useState(null);
  const [simMeta, setSimMeta] = useState(null); // { base, delta, ignored }

  // Debounce simulation requests
  useEffect(() => {
    if (initialLoad) {
      setInitialLoad(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.post(`/api/stock/${selectedSymbol}/simulate`, {
          sentiment: parseFloat(sentiment),
          volatility_multiplier: parseFloat(volatility),
          volume_multiplier: parseFloat(volume)
        });

        // Update the prediction data in the store so AIInsightCard reacts
        if (predictionData && data && data.predicted_price != null) {
          setSimError(null);
          const base = Number(data.base_predicted_price);
          const scen = Number(data.predicted_price);
          setSimMeta({
            base: isFinite(base) ? base : null,
            delta: isFinite(base) && isFinite(scen) ? scen - base : null,
            ignored: Array.isArray(data.ignored_overrides) ? data.ignored_overrides : [],
          });
          setPredictionData({
            ...predictionData,
            predicted_price: data.predicted_price,
            high_bound: data.high_bound,
            low_bound: data.low_bound
          });
        } else if (data && data.error) {
          setSimError(data.error);
        }
      } catch (err) {
        console.error("Simulation failed", err);
        setSimError(err.response?.data?.detail || "Simulation unavailable for this stock (no trained model).");
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [sentiment, volatility, volume, selectedSymbol]);

  return (
    <div style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border, #333)', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 20px 0', color: 'var(--text, #fff)' }}>Scenario Simulator</h3>
      {simError && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#F87171', fontSize: '0.78rem' }}>
          {simError}
        </div>
      )}
      {simMeta && simMeta.delta != null && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.22)', fontSize: '0.78rem', color: '#BAE6FD' }}>
          Scenario Δ <strong style={{ color: simMeta.delta >= 0 ? '#34D399' : '#F87171', fontFamily: 'JetBrains Mono, monospace' }}>
            {simMeta.delta >= 0 ? '+' : ''}₹{simMeta.delta.toFixed(2)}
          </strong>
          {' '}vs base ₹{Number(simMeta.base).toFixed(2)}
          {simMeta.ignored.length > 0 && (
            <div style={{ marginTop: 4, color: '#64748B', fontSize: '0.72rem' }}>
              Model ignores: {simMeta.ignored.join(', ')} (zero trained weight — retrain to refresh)
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Sentiment Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>
            <span>News Sentiment (VADER)</span>
            <span>{sentiment > 0 ? '+' : ''}{sentiment}</span>
          </div>
          <input 
            type="range" 
            min="-1" 
            max="1" 
            step="0.1" 
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: '0.75rem', marginTop: '4px' }}>
            <span>Bearish (-1)</span>
            <span>Bullish (+1)</span>
          </div>
        </div>

        {/* Volatility Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>
            <span>Market Volatility (ATR / StdDev)</span>
            <span>{volatility}x</span>
          </div>
          <input 
            type="range" 
            min="0.5" 
            max="2" 
            step="0.1" 
            value={volatility}
            onChange={(e) => setVolatility(e.target.value)}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: '0.75rem', marginTop: '4px' }}>
            <span>Low (0.5x)</span>
            <span>High (2x)</span>
          </div>
        </div>

        {/* Volume Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa', fontSize: '0.9rem', marginBottom: '8px' }}>
            <span>Volume Surge</span>
            <span>{volume}x</span>
          </div>
          <input 
            type="range" 
            min="1" 
            max="3" 
            step="0.1" 
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            style={{ width: '100%', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#555', fontSize: '0.75rem', marginTop: '4px' }}>
            <span>Normal (1x)</span>
            <span>Massive (3x)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
