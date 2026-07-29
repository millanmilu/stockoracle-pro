import React, { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import axios from 'axios';

export default function NewsPanel() {
  const { selectedSymbol } = useStore();
  const [news, setNews] = useState([]);
  const [sentimentScore, setSentimentScore] = useState(0);

  useEffect(() => {
    const fetchNewsAndSentiment = async () => {
      try {
const API = import.meta.env.VITE_API_URL || '';
        const [newsRes, sentimentRes] = await Promise.all([
          axios.get(`${API}/api/stock/${selectedSymbol}/news`),
          axios.get(`${API}/api/stock/${selectedSymbol}/sentiment`) // Wait, I need an endpoint for sentiment! Or just take it from the feature row?
        ]);
        setNews(newsRes.data.slice(0, 5));
        setSentimentScore(sentimentRes.data.score || 0);
      } catch (err) {
        console.error(err);
      }
    };
    // If I don't have a sentiment endpoint, I can calculate it or assume it's sent along with news, or add an endpoint.
    // Let's assume there's a `/api/stock/{symbol}/news` that returns { news: [...], average_sentiment: 0.5 }
    // Let's adjust to fetch from the news endpoint directly if it returns sentiment.
    
    const fetchNews = async () => {
      try {
        const { data } = await axios.get(`${import.meta.env.VITE_API_URL || ''}/api/stock/${selectedSymbol}/news`);
        // I will assume the backend returns { articles: [], sentiment: 0 }
        // If not, I'll just fake it or add it.
        // Actually, the user asked me to create `analysis/sentiment.py` returning average score.
        // I will update main.py to return this score in the news endpoint.
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
          <div key={idx} style={{ backgroundColor: '#1e1e1e', padding: '15px', borderRadius: '8px', border: '1px solid #333' }}>
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
