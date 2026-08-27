import React, { useState, useEffect, useRef } from 'react';
import useStore from '../store/useStore';
import api from '../utils/api';
import { Send, Bot, User, Sparkles, RotateCcw } from 'lucide-react';

const QUICK_PROMPTS = [
  'Is this a buy right now?',
  'Explain the RSI signal',
  'Key support levels?',
  'What does the news say?',
  'What are the key risks?',
];

const isDark = true; // component always in dark right rail

export default function AIChatPanel({ ticker: propTicker }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const ticker = propTicker || selectedSymbol;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Welcome message on ticker change
  useEffect(() => {
    setMessages([
      {
        role: 'ai',
        content: `👋 Hi! I'm StockOracle AI. Ask me anything about **${ticker}** — signals, indicators, news impact, or trade ideas. I'll answer based on real-time data.`,
        ts: new Date(),
      },
    ]);
    setInput('');
  }, [ticker]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question, ts: new Date() }]);
    setLoading(true);
    try {
      const { data } = await api.post('/api/ai/chat', { ticker, question });
      setMessages((prev) => [...prev, { role: 'ai', content: data.answer, ts: new Date() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: '⚠️ Unable to reach AI. Check that GEMINI_API_KEY is set in backend/.env', ts: new Date() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        role: 'ai',
        content: `Chat cleared. Ask me anything about **${ticker}**.`,
        ts: new Date(),
      },
    ]);
  };

  const renderFormattedContent = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} style={{ color: '#F0F0FF', fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} color="#818CF8" />
          <span style={{ fontSize: '0.78rem', color: '#818CF8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            AI Chat — {ticker}
          </span>
        </div>
        <button onClick={clearChat} title="Clear chat" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', padding: 4 }}>
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10, flexShrink: 0 }}>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={loading}
            style={{
              padding: '3px 8px',
              borderRadius: 12,
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.08)',
              color: '#818CF8',
              fontSize: '0.68rem',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        paddingRight: 4,
        minHeight: 0,
      }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.15)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.4)' : 'rgba(16,185,129,0.3)'}`,
            }}>
              {msg.role === 'user'
                ? <User size={13} color="#818CF8" />
                : <Bot size={13} color="#10B981" />}
            </div>
            {/* Bubble */}
            <div style={{
              maxWidth: '82%',
              padding: '8px 11px',
              borderRadius: msg.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
              background: msg.role === 'user' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)'}`,
              color: '#E2E8F0',
              fontSize: '0.8rem',
              lineHeight: 1.55,
            }}>
              {renderFormattedContent(msg.content)}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            }}>
              <Bot size={13} color="#10B981" />
            </div>
            <div style={{
              padding: '8px 14px', borderRadius: '4px 12px 12px 12px',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map((n) => (
                <div
                  key={n}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#6B7280',
                    animation: `bounce 1.2s ease-in-out ${n * 0.2}s infinite`,
                  }}
                />
              ))}
              <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}`}</style>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: 8, marginTop: 10, flexShrink: 0,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: 10,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about ${ticker}...`}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(99,102,241,0.25)',
            background: 'rgba(255,255,255,0.04)',
            color: '#F0F0FF',
            fontSize: '0.82rem',
            outline: 'none',
          }}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 12px', borderRadius: 8,
            background: loading || !input.trim() ? 'rgba(99,102,241,0.2)' : '#6366F1',
            border: 'none', cursor: loading || !input.trim() ? 'default' : 'pointer',
            color: '#fff', display: 'flex', alignItems: 'center',
            transition: 'all 0.15s',
          }}
        >
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}