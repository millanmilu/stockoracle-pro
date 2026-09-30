import React, { useEffect, useRef, useState } from 'react';
import { isCryptoSymbol, getSessionBucketStart } from '../../utils/chartHelpers';

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
    // Fall back to the live session grid (09:15-anchored for NSE) — NOT the
    // epoch grid, which disagrees with session buckets for 30m/1h/4h.
    const bucketStart = getSessionBucketStart(interval, now, crypto);
    return { end: (bucketStart + duration) * 1000, closed: false };
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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateLabel = () => {
      const { end, closed } = getSessionState(interval, selectedSymbol, activeCandleRef?.current);
      const isClosed = closed || !end;
      setLabel(isClosed ? 'MARKET CLOSED' : formatRemaining(end - Date.now()));
      setVisible(!isClosed);
    };
    updateLabel();
    const timer = window.setInterval(updateLabel, 1000);
    return () => window.clearInterval(timer);
  }, [activeCandleRef, interval, selectedSymbol]);

  // TradingView parity: the countdown sits directly BELOW the live price
  // label, docked to the slim right price axis (same 56px strip).
  // Flexible positioning: tracks price smoothly, clamps to viewport, and
  // hides when the price is off-screen or market is closed.
  useEffect(() => {
    let frame;
    const position = () => {
      const badge = badgeRef.current;
      if (!badge) {
        frame = requestAnimationFrame(position);
        return;
      }
      const coordinate = chartRef?.current?.getPriceCoordinate?.(currentPrice);
      if (coordinate != null && Number.isFinite(coordinate)) {
        const paneH = badge.parentElement?.clientHeight || 600;
        const paneW = badge.parentElement?.clientWidth || 400;
        // Clamp: keep badge fully inside the viewport
        const top = Math.min(Math.max(8, coordinate + 14), Math.max(8, paneH - 28));
        const right = Math.min(Math.max(2, paneW - 56), paneW - 2);
        badge.style.top = `${top}px`;
        badge.style.right = `${right}px`;
        badge.style.display = visible ? 'block' : 'none';
      } else {
        badge.style.display = 'none';
      }
      frame = requestAnimationFrame(position);
    };
    frame = requestAnimationFrame(position);
    return () => cancelAnimationFrame(frame);
  }, [chartRef, currentPrice, visible]);

  return <div ref={badgeRef} role="status" aria-live="polite" style={{ position: 'absolute', right: 2, display: 'none', width: 52, textAlign: 'center', padding: '2px 0', border: '1px solid #2A2E39', borderRadius: 4, background: '#1E222D', color: '#D1D4DC', font: "500 10px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif", pointerEvents: 'none', zIndex: 18, whiteSpace: 'nowrap', transition: 'top 0.15s ease-out' }}>{label}</div>;
}