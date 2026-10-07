const FIELDS = ['time', 'open', 'high', 'low', 'close', 'volume'];

// Copy the mutable active bar so memoized analysis sees wick/volume changes.
// Only replace the matching last bar: replay and history never gain live bars.
export function snapshotSMCCandles(candles, activeCandle = null, previous = null) {
  const source = Array.isArray(candles) ? candles : [];
  const last = source.at(-1);
  const active = last && activeCandle?.time === last.time ? activeCandle : null;
  const tail = last ? { ...last, ...active } : null;
  if (previous?.source === source && FIELDS.every((field) => Object.is(previous.candles.at(-1)?.[field], tail?.[field]))) {
    return previous;
  }
  return { source, candles: tail ? [...source.slice(0, -1), tail] : [] };
}
