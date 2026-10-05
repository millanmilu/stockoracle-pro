export function detectSession(candle, settings = {}) {
  if (!candle || candle.time == null) return 'unknown';

  const timezoneOffsetMinutes = Number(settings.timezoneOffsetMinutes || 330);
  const ms = Number(candle.time);
  const localMinutes = ((ms / 60000) + timezoneOffsetMinutes) % (24 * 60);
  const currentMinutes = localMinutes < 0 ? localMinutes + 24 * 60 : localMinutes;

  const sessionMap = [
    { name: 'asian', start: 0, end: 8 * 60 + 59 },
    { name: 'london', start: 9 * 60, end: 11 * 60 + 59 },
    { name: 'newYork', start: 13 * 60 + 30, end: 16 * 60 },
  ];

  const match = sessionMap.find((session) => currentMinutes >= session.start && currentMinutes <= session.end);
  return match ? match.name : 'overnight';
}
