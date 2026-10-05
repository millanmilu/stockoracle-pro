// Pro Terminal V2 — Top Navigation

import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Settings, User, ChevronDown } from 'lucide-react';
import { V2_COLORS } from '../utils/constants';

const NAV_ITEMS = ['Markets', 'Screener', 'Chart', 'Watchlist', 'Portfolio', 'Alerts', 'News', 'AI Analytics'];

export default function V2TopNavigation({
  activeView = 'Chart',
  onNavigate,
  symbols = [],
  onSelectSymbol,
  searchOpen = false,
  onSearchOpenChange,
  searchQuery = '',
  onSearchQueryChange,
  onToggleSettings,
}) {
  const [active, setActive] = useState(activeView);
  const [showMore, setShowMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) onSearchOpenChange?.(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onSearchOpenChange]);

  const notifications = [
    { id: 1, text: 'RELIANCE crossed ₹2,870', time: '2m ago', type: 'price' },
    { id: 2, text: 'RSI oversold on TCS', time: '15m ago', type: 'indicator' },
    { id: 3, text: 'AI signal: Bullish on INFY', time: '1h ago', type: 'ai' },
  ];

  const searchResults = searchQuery
    ? symbols.filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const handleSelectSymbol = (s) => {
    onSelectSymbol?.(s);
    onSearchQueryChange?.('');
    onSearchOpenChange?.(false);
  };

  return (
    <div className="v2-topnav" style={{
      display: 'flex',
      alignItems: 'center',
      height: 44,
      padding: '0 12px',
      background: V2_COLORS.bg.primary,
      borderBottom: `1px solid ${V2_COLORS.bg.border}`,
      gap: 4,
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Brand */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginRight: 12,
        fontWeight: 700,
        fontSize: 13,
        color: V2_COLORS.text.primary,
        letterSpacing: '0.02em',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: `linear-gradient(135deg, ${V2_COLORS.accent.primary}, ${V2_COLORS.accent.purple})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 800,
          color: '#fff',
        }}>S</div>
        <span className="v2-brand-text">StockOracle Pro</span>
      </div>

      {/* Nav Items */}
      {NAV_ITEMS.map((item, i) => (
        <button
          key={item}
          onClick={() => { setActive(item); onNavigate?.(item); }}
          className={i >= 5 ? 'v2-hide-sm' : undefined}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: active === item ? 600 : 400,
            color: active === item ? V2_COLORS.accent.primary : V2_COLORS.text.secondary,
            background: active === item ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {item}
        </button>
      ))}

      {/* More dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowMore(!showMore)}
          aria-haspopup="menu"
          aria-expanded={showMore}
          style={{
            padding: '4px 8px',
            fontSize: 12,
            color: V2_COLORS.text.secondary,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          More <ChevronDown size={11} />
        </button>
        {showMore && (
          <DropdownMenu>
            <DropdownItem onClick={() => { setShowMore(false); onToggleSettings?.(); }}>Settings</DropdownItem>
            {['Help', 'About', 'Keyboard Shortcuts'].map((item) => (
              <DropdownItem key={item} onClick={() => setShowMore(false)}>{item}</DropdownItem>
            ))}
          </DropdownMenu>
        )}
      </div>

      {/* Right section */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* Search */}
        <div ref={searchRef} style={{ position: 'relative' }}>
          <button
            onClick={() => onSearchOpenChange?.(!searchOpen)}
            aria-label="Search symbols (Ctrl+K)"
            aria-expanded={searchOpen}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              color: V2_COLORS.text.secondary,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Search size={14} />
            <span className="v2-brand-text">Search</span>
          </button>
          {searchOpen && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: V2_COLORS.bg.elevated,
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 6,
              padding: 8,
              width: 240,
              zIndex: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange?.(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchResults.length) handleSelectSymbol(searchResults[0]);
                }}
                placeholder="Search symbols..."
                aria-label="Search symbols"
                autoFocus
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  fontSize: 12,
                  color: V2_COLORS.text.primary,
                  background: V2_COLORS.bg.tertiary,
                  border: `1px solid ${V2_COLORS.bg.border}`,
                  borderRadius: 4,
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <div style={{ marginTop: 4 }}>
                  {searchResults.length === 0 && (
                    <div style={{ padding: '6px 8px', fontSize: 11, color: V2_COLORS.text.muted }}>
                      No symbols found
                    </div>
                  )}
                  {searchResults.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSelectSymbol(s)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: 12,
                        color: V2_COLORS.text.secondary,
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifications */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
            aria-expanded={showNotifications}
            style={{
              padding: 6,
              color: V2_COLORS.text.secondary,
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              display: 'flex',
              position: 'relative',
            }}
          >
            <Bell size={14} />
            <div style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: V2_COLORS.negative,
            }} />
          </button>
          {showNotifications && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: V2_COLORS.bg.elevated,
              border: `1px solid ${V2_COLORS.bg.border}`,
              borderRadius: 6,
              padding: '4px 0',
              width: 260,
              zIndex: 200,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 600, color: V2_COLORS.text.muted, textTransform: 'uppercase' }}>
                Notifications
              </div>
              {notifications.map((n) => (
                <div key={n.id} style={{ padding: '6px 10px', borderBottom: `1px solid ${V2_COLORS.bg.border}` }}>
                  <div style={{ fontSize: 11, color: V2_COLORS.text.primary }}>{n.text}</div>
                  <div style={{ fontSize: 9, color: V2_COLORS.text.muted }}>{n.time}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onToggleSettings?.()}
          aria-label="Settings"
          style={{
            padding: 6,
            color: V2_COLORS.text.secondary,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            display: 'flex',
          }}
        >
          <Settings size={14} />
        </button>
        <button
          aria-label="Account"
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: V2_COLORS.accent.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            border: 'none',
            padding: 0,
          }}
        >
          <User size={12} />
        </button>
      </div>
    </div>
  );
}

function DropdownMenu({ children }) {
  return (
    <div role="menu" style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      background: V2_COLORS.bg.elevated,
      border: `1px solid ${V2_COLORS.bg.border}`,
      borderRadius: 6,
      padding: '4px 0',
      minWidth: 160,
      zIndex: 200,
      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      {children}
    </div>
  );
}

function DropdownItem({ children, onClick }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 12px',
        fontSize: 12,
        color: V2_COLORS.text.secondary,
        background: 'transparent',
        border: 'none',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
