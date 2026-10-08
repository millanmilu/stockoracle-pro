export function detectInducement(candles, settings = {}) {
  if (!Array.isArray(candles) || candles.length < 3) return [];

  const events = [];
  const window = settings.windowSize || 5;

  for (let i = window; i < candles.length - 1; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];
    const next = candles[i + 1];
    const body = Math.abs(Number(current.close) - Number(current.open));
    const range = Math.max(Number(current.high) - Number(current.low), 0.0001);
    const wickBreak = Math.abs(Number(current.high) - Number(prev.high)) > 0;

    if (body / range > 0.6 && wickBreak && Number(next.close) > Number(current.close)) {
      events.push({
        type: 'inducement',
        time: current.time,
        direction: 'bullish',
        color: '#A78BFA',
      });
    }
    if (body / range > 0.6 && wickBreak && Number(next.close) < Number(current.close)) {
      events.push({
        type: 'inducement',
        time: current.time,
        direction: 'bearish',
        color: '#F472B6',
      });
    }
  }

  const maxEvents = Math.max(1, Math.floor(Number(settings.maxEvents) || 6));
  return events.slice(-maxEvents);
}
