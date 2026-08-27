import React, { useState, useEffect, useRef } from 'react';
import { X, Send, BrainCircuit, TrendingUp, TrendingDown } from 'lucide-react';
import useStore from '../store/useStore';
import api from '../utils/api';

const DEFAULT_TICKERS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'BHARTIARTL', 'ITC', 'AXISBANK', 'WIPRO', 'LT', 'TATAMOTORS'];

export default function ProRightPanel({ onClose }) {
  const { selectedSymbol, setSelectedSymbol } = useStore();
  const [filter, setFilter] = useState('');
  const [quotes, setQuotes] = useState({});
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const fetchQuotes = async () => {
    try {
      const results = await Promise.allSettled(
        DEFAULT_TICKERS.map(t => api.get(`/api/stock/${t}/info`).then(r => r.data))
      );
      const newQuotes = {};
      results.forEach((res, i) => {
        if (res.status === 'fulfilled' && res.value && !res.value.error) {
          newQuotes[DEFAULT_TICKERS[i]] = res.value;
        }
      });
      setQuotes(prev => ({ ...prev, ...newQuotes }));
    } catch (e) {
      console.error('Watchlist fetch error', e);
    }
  };

  useEffect(() => {
    fetchQuotes();
    const int = setInterval(fetchQuotes, 30000);
    return () => clearInterval(int);
  }, []);

  const handleChat = async () => {
    if (!chatInput.trim()) return;
    setIsChatLoading(true);
    setChatResponse('');
    try {
      const res = await api.post('/api/ai/chat', { ticker: selectedSymbol, question: chatInput });
      setChatResponse(res.data?.response || res.data?.answer || 'Received response.');
      setChatInput('');
    } catch (e) {
      setChatResponse('Error reaching AI.');
    } finally {
      setIsChatLoading(false);
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const filteredTickers = DEFAULT_TICKERS.filter(t => t.toLowerCase().includes(filter.toLowerCase()));

  return (
    <div className="pro-right-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#F0F0FF', margin: 0 }}>Watchlist</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', display: 'flex' }}>
          <X size={16} />
        </button>
      </div>
      
      <div style={{ padding: '10px' }}>
        <input
          type="text"
          placeholder="Filter..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ width: '100%', padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.75rem', outline: 'none' }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredTickers.map(t => {
          const q = quotes[t];
          const price = q?.price ?? q?.current_price ?? q?.ltp;
          const change = q?.change;
          const changePct = q?.changePercent ?? q?.change_pct;
          const isUp = (change ?? changePct ?? 0) >= 0;
          const hasPrice = price != null && Number(price) > 0;

          return (
            <div 
              key={t} 
              onClick={() => setSelectedSymbol(t)}
              style={{ 
                padding: '9px 12px', 
                borderBottom: '1px solid rgba(255,255,255,0.04)', 
                cursor: 'pointer',
                background: selectedSymbol === t ? 'rgba(99,102,241,0.15)' : 'transparent',
                borderLeft: selectedSymbol === t ? '2px solid #6366F1' : '2px solid transparent',
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, marginRight: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: '0.82rem', color: '#818CF8' }}>{t}</span>
                <span style={{ fontSize: '0.67rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>
                  {q?.companyName || q?.name || t}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', fontWeight: 700, color: '#FFF' }}>
                  {hasPrice ? `₹${Number(price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </span>
                <span style={{ 
                  fontSize: '0.68rem', 
                  fontWeight: 600, 
                  color: !hasPrice ? '#6B7280' : isUp ? '#10B981' : '#EF5350',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {hasPrice && changePct != null ? `${isUp ? '+' : ''}${Number(changePct).toFixed(2)}%` : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ padding: '14px', borderTop: '1px solid rgba(99,102,241,0.1)', background: 'rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: '0.7rem', color: '#9CA3AF', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BrainCircuit size={12} color="#818CF8" /> Ask AI ({selectedSymbol})
        </div>
        
        {chatResponse && (
          <div style={{ background: 'rgba(99,102,241,0.1)', padding: 10, borderRadius: 6, fontSize: '0.75rem', color: '#C7D2FE', marginBottom: 10, maxHeight: 150, overflowY: 'auto', lineHeight: 1.4 }}>
            {chatResponse}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type="text"
            placeholder="E.g. Is this a buy?"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleChat()}
            style={{ flex: 1, padding: '6px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: '0.75rem', outline: 'none' }}
          />
          <button 
            onClick={handleChat}
            disabled={isChatLoading || !chatInput.trim()}
            style={{ background: '#6366F1', border: 'none', borderRadius: 6, padding: '0 10px', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isChatLoading ? 0.6 : 1 }}
          >
            {isChatLoading ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderColor: 'transparent', borderTopColor: '#fff', margin: 0 }}></span> : <Send size={12} />}
          </button>
        </div>
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
