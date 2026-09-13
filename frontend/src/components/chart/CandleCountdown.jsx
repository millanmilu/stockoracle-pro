import React, { useEffect, useRef, useState } from 'react';
import { isCryptoSymbol } from '../../utils/chartHelpers';

const INTERVAL_SECONDS = {
  '1s': 1,
  '30s': 30,
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '4h': 14400,
};

function getSessionState(interval, selectedSymbol, activeCandle) {
  const now = Date.now();
  const crypto = isCryptoSymbol(selectedSymbol);
  if (interval === '1d') {
    if (crypto) {
      const start = Math.floor(now / 86400000) * 86400000;
      return { end: start + 86400000, closed: false };
    }
    const istNow = new Date(now + 5.5 * 3600000);
    const seconds = istNow.getUTCHours() * 3600 + istNow.getUTCMinutes() * 60 + istNow.getUTCSeconds();
    const open = 9 * 3600 + 15 * 60;
    const close = 15 * 3600 + 30 * 60;
    if (istNow.getUTCDay() === 0 || istNow.getUTCDay() === 6 || seconds < open || seconds >= close) {
      return { end: null, closed: true };
    }
    const dayStart = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate());
    return { end: dayStart - 5.5 * 3600000 + close * 1000, closed: false };
  }

  const duration = INTERVAL_SECONDS[interval] || 60;
  const timestamp = typeof activeCandle?.time === 'number' ? activeCandle.time * 1000 : now;
  const end = timestamp + duration * 1000;
  if (!crypto) {
    const istNow = new Date(now + 5.5 * 3600000);
    const seconds = istNow.getUTCHours() * 3600 + istNow.getUTCMinutes() * 60 + istNow.getUTCSeconds();
    const open = 9 * 3600 + 15 * 60;
    const close = 15 * 3600 + 30 * 60;
    if (istNow.getUTCDay() === 0 || istNow.getUTCDay() === 6 || seconds < open || seconds >= close) {
      return { end: null, closed: true };
    }
  }
  if (end <= now) {
    return { end: (Math.floor(now / (duration * 1000)) + 1) * duration * 1000, closed: false };
  }
  return { end, closed: false };
}

function formatRemaining(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function CandleCountdown({ chartRef, activeCandleRef, selectedSymbol, interval, currentPrice }) {
  const badgeRef = useRef(null);
  const [label, setLabel] = useState('MARKET CLOSED');

  useEffect(() => {
    const updateLabel = () => {
      const { end, closed } = getSessionState(interval, selectedSymbol, activeCandleRef?.current);
      setLabel(closed || !end ? 'MARKET CLOSED' : formatRemaining(end - Date.now()));
    };
    updateLabel();
    const timer = window.setInterval(updateLabel, 1000);
    return () => window.clearInterval(timer);
  }, [activeCandleRef, interval, selectedSymbol]);

  useEffect(() => {
    let frame;
    const position = () => {
      const badge = badgeRef.current;
      const coordinate = chartRef?.current?.getPriceCoordinate?.(currentPrice);
      if (badge && coordinate != null && Number.isFinite(coordinate)) {
        badge.style.top = `${Math.max(8, coordinate - 15)}px`;
        badge.style.display = label === 'MARKET CLOSED' ? 'none' : 'block';
      }
      frame = requestAnimationFrame(position);
    };
    frame = requestAnimationFrame(position);
    return () => cancelAnimationFrame(frame);
  }, [chartRef, currentPrice, label]);

  return <div ref={badgeRef} role="status" aria-live="polite" style={{ position: 'absolute', right: 78, display: 'none', padding: '3px 6px', border: '1px solid rgba(125,211,252,0.24)', borderRadius: 4, background: 'rgba(8,15,29,0.9)', color: '#BAE6FD', font: '600 10px JetBrains Mono, monospace', pointerEvents: 'none', zIndex: 18, whiteSpace: 'nowrap' }}>{label}</div>;
}