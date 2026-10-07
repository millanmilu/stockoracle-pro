export function detectMitigation(candles, zones = [], settings = {}) {
  if (!Array.isArray(candles) || zones.length === 0) return zones;

  const requested = Number(settings.lookback);
  const lookback = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 120;

  return zones.map((zone) => {
    const formedAt = zone.confirmedTime ?? zone.time;
    const formedIndex = candles.findIndex((candle) => candle.time === formedAt);
    const recent = candles.slice(Math.max(candles.length - lookback, formedIndex + 1));
    const touched = recent.some((candle) => {
      const low = Number(candle.low);
      const high = Number(candle.high);
      const zoneTop = Number(zone.top);
      const zoneBottom = Number(zone.bottom);
      return high >= Math.min(zoneTop, zoneBottom) && low <= Math.max(zoneTop, zoneBottom);
    });

    return {
      ...zone,
      state: touched ? 'mitigated' : zone.state || 'active',
      mitigation: touched ? 1 : zone.mitigation || 0,
    };
  });
}
