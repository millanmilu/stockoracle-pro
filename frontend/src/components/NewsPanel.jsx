import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import api from '../utils/api';

export default function NewsPanel() {
  const { selectedSymbol } = useStore();
  const [news, setNews] = useState([]);
  const [sentimentScore, setSentimentScore] = useState(0);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const { data } = await api.get(`/api/stock/${selectedSymbol}/news`);
        if (data.items) {
          setNews(data.items.slice(0, 5));
          setSentimentScore(data.sentiment || 0);
        } else {
          setNews(data.slice(0, 5) || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchNews();
  }, [selectedSymbol]);

  // Transform sentiment (-1 to 1) into a gauge value (0 to 100)
  const normalizedValue = ((sentimentScore + 1) / 2) * 100;
  const data = [
    { name: 'Score', value: normalizedValue, color: sentimentScore > 0 ? '#22c55e' : (sentimentScore < 0 ? '#ef4444' : '#eab308') },
    { name: 'Empty', value: 100 - normalizedValue, color: '#333' }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#fff' }}>Market Sentiment</h2>
      
      {/* Half Donut Gauge */}
      <div style={{ height: '200px', width: '100%', position: 'relative' }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={80}
              outerRadius={100}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ 
          position: 'absolute', 
          bottom: '10px', 
          width: '100%', 
          textAlign: 'center', 
          fontSize: '1.5rem', 
          fontWeight: 'bold',
          color: data[0].color
        }}>
          {sentimentScore > 0 ? '+' : ''}{sentimentScore.toFixed(2)}
        </div>
      </div>

      {/* Headlines */}
      <h3 style={{ marginTop: '30px', color: '#aaa', fontSize: '1rem' }}>Top Headlines</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' }}>
        {news.map((item, idx) => (
          <div key={idx} style={{ backgroundColor: 'var(--card-bg, #1e1e1e)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border, #333)' }}>
            <a href={item.link} target="_blank" rel="noreferrer" style={{ color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold' }}>
              {item.title}
            </a>
            <div style={{ color: '#666', fontSize: '0.8rem', marginTop: '8px' }}>
              {item.source} • {new Date(item.published).toLocaleDateString()}
            </div>
          </div>
        ))}
        {news.length === 0 && <div style={{ color: '#888' }}>No news available right now.</div>}
      </div>
    </div>
  );
}
