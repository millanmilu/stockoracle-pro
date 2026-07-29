import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import axios from 'axios';

export default function AIInsightCard() {
  const { selectedSymbol, predictionData, setPredictionData } = useStore();
  const [explainData, setExplainData] = useState(null);

  useEffect(() => {
    const fetchInsights = async () => {
      try {
const API = import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org';
        // Await predict FIRST, which will auto-train the model if it doesn't exist
        const predRes = await axios.get(`${API}/api/stock/${selectedSymbol}/predict`);
        // Then await explain, which will safely find the newly trained model
        const expRes = await axios.get(`${API}/api/stock/${selectedSymbol}/explain`);
        setPredictionData(predRes.data);
        setExplainData(expRes.data);
      } catch (err) {
        console.error("Error fetching insights", err);
      }
    };
    fetchInsights();
  }, [selectedSymbol]);

  if (!predictionData || !explainData) return <div style={{ padding: '20px' }}>Loading AI Insights...</div>;

  const { current_price, predicted_price, high_bound, low_bound } = predictionData;
  const pct_change = ((predicted_price - current_price) / current_price) * 100;
  
  let color = '#eab308'; // yellow
  if (pct_change > 1) color = '#22c55e'; // green
  if (pct_change < -1) color = '#ef4444'; // red

  const formatPrice = (p) => `₹${p.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  return (
    <div style={{ backgroundColor: '#1e1e1e', padding: '20px', borderRadius: '12px', border: '1px solid #333', display: 'flex', gap: '30px' }}>
      
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
            <div style={{ width: '100%', backgroundColor: '#333', height: '6px', borderRadius: '3px' }}>
              <div style={{ width: `${pct}%`, backgroundColor: '#0ea5e9', height: '100%', borderRadius: '3px' }} />
            </div>
          </div>
        ))}
      </div>
      
    </div>
  );
}
