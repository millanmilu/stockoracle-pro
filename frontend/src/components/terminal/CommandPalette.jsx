import React, { useState, useEffect, useRef } from 'react';
import useStore from '../../store/useStore';
import {
  Terminal, Search, CandlestickChart, BookOpen, Layers,
  Activity, SlidersHorizontal, Dices, Globe, Wallet, Grid3X3
} from 'lucide-react';
import toast from 'react-hot-toast';

const COMMANDS = [
  { cmd: '/chart', desc: 'Open Pro Live Chart for ticker', view: 'Live Chart', icon: CandlestickChart },
  { cmd: '/tile', desc: 'Open Bloomberg 4-Tile Split Workspace', view: 'Multi-Tile', icon: Grid3X3 },
  { cmd: '/val', desc: 'Open DCF Intrinsic Valuation Model', view: 'Valuation', icon: BookOpen },
  { cmd: '/rrg', desc: 'Open Relative Rotation Graphs (Sector Flow)', view: 'Sector Rotation', icon: Activity },
  { cmd: '/strat', desc: 'Open Options Strategy Lab & Payoff', view: 'Options Strategy Lab', icon: Layers },
  { cmd: '/macro', desc: 'Open Sovereign Yields & Macro Hub', view: 'Macro Terminal', icon: Globe },
  { cmd: '/risk', desc: 'Open Quant Portfolio Risk & VaR Cockpit', view: 'Quant Risk Cockpit', icon: Activity },
  { cmd: '/screen', desc: 'Open Multi-Factor Stock Screener', view: 'Adv. Screener', icon: SlidersHorizontal },
  { cmd: '/paper', desc: 'Open Paper Trading 2.0 Terminal', view: 'Paper Trading', icon: Wallet },
];

export default function CommandPalette({ isOpen, onClose }) {
  const { setSelectedSymbol, setActiveView } = useStore();
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecute = (cmdObj, symbolParam) => {
    if (symbolParam) {
      setSelectedSymbol(symbolParam.toUpperCase().trim());
      toast.success(`Loaded ${symbolParam.toUpperCase()}`);
    }
    setActiveView(cmdObj.view);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      const parts = query.trim().split(' ');
      const mainCmd = parts[0].toLowerCase();
      const param = parts[1] || '';

      const matched = COMMANDS.find(c => c.cmd === mainCmd || c.view.toLowerCase().includes(query.toLowerCase()));
      if (matched) {
        handleExecute(matched, param);
      } else if (query.trim().length >= 2) {
        // Assume direct stock lookup
        setSelectedSymbol(query.trim().toUpperCase());
        setActiveView('Live Chart');
        toast.success(`Loaded ${query.trim().toUpperCase()}`);
        onClose();
      }
    }
  };

  const filtered = COMMANDS.filter(c =>
    c.cmd.toLowerCase().includes(query.toLowerCase()) ||
    c.desc.toLowerCase().includes(query.toLowerCase()) ||
    c.view.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(4, 6, 14, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 999,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '12vh',
    }} onClick={onClose}>
      <div style={{
        background: '#0C1022',
        border: '1px solid rgba(99, 102, 241, 0.4)',
        borderRadius: 16,
        width: '100%',
        maxWidth: 620,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>

        {/* Input Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: '#080B18'
        }}>
          <Terminal size={18} color="#818CF8" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command (/chart RELIANCE, /dcf TCS, /rrg, /risk)..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              color: '#F0F0FF',
              fontSize: '1rem',
              fontFamily: 'JetBrains Mono, monospace',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.7rem', color: '#64748B', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: 6 }}>ESC to close</span>
        </div>

        {/* Command List */}
        <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
          {filtered.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                onClick={() => handleExecute(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  color: '#CBD5E1',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Icon size={16} color="#818CF8" />
                  <div>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#38BDF8', marginRight: 8 }}>
                      {item.cmd}
                    </span>
                    <span style={{ fontSize: '0.85rem' }}>{item.desc}</span>
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#64748B', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4 }}>
                  {item.view}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
