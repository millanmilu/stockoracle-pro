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
        if (predictionData) {
          setPredictionData({
            ...predictionData,
            predicted_price: data.predicted_price,
            high_bound: data.high_bound,
            low_bound: data.low_bound
          });
        }
      } catch (err) {
        console.error("Simulation failed", err);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [sentiment, volatility, volume, selectedSymbol]);

  return (
    <div style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border, #333)', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 20px 0', color: 'var(--text, #fff)' }}>Scenario Simulator</h3>
      
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
