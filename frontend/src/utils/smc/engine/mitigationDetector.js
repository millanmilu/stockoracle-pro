export function detectMitigation(candles, zones = [], settings = {}) {
  if (!Array.isArray(candles) || zones.length === 0) return zones;

  const recent = candles.slice(-settings.lookback || 120);

  return zones.map((zone) => {
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
