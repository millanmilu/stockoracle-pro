import { DEFAULT_SMC_SETTINGS } from '../config/smcSettings.js';

const formatters = new Map();

function clockMinutes(value) {
  const parts = String(value).split(':');
  const [hour, minute] = parts.map(Number);
  if (parts.length !== 2 || !Number.isInteger(hour) || !Number.isInteger(minute)
    || hour < 0 || hour > 23 || minute < 0 || minute > 59) return NaN;
  return hour * 60 + minute;
}

export function detectSession(candle, settings = {}) {
  // Daily market dates have no intraday session. Chart timestamps are Unix seconds.
  if (typeof candle?.time !== 'number' || !Number.isFinite(candle.time)) return 'unknown';
  const ms = Math.abs(candle.time) >= 1e12 ? candle.time : candle.time * 1000;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) return 'unknown';

  // Prefer the scored London/NY windows if a custom/Asian window overlaps.
  for (const name of ['london', 'newYork', 'asian']) {
    const session = { ...DEFAULT_SMC_SETTINGS.sessions[name], ...settings[name] };
    const start = clockMinutes(session.start);
    const end = clockMinutes(session.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    let minutes;
    try {
      if (settings.timezoneOffsetMinutes != null && Number.isFinite(Number(settings.timezoneOffsetMinutes))) {
        minutes = ((ms / 60000 + Number(settings.timezoneOffsetMinutes)) % 1440 + 1440) % 1440;
        minutes = Math.floor(minutes);
      } else {
        if (!formatters.has(session.tz)) {
          formatters.set(session.tz, new Intl.DateTimeFormat('en-GB', {
            timeZone: session.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
          }));
        }
        const parts = formatters.get(session.tz).formatToParts(date);
        minutes = Number(parts.find((part) => part.type === 'hour').value) * 60
          + Number(parts.find((part) => part.type === 'minute').value);
      }
    } catch { continue; }
    if (start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end) return name;
  }
  return 'overnight';
}
