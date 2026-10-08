export function calculateSMCScore(context = {}, settings = {}) {
  const weights = { ...settings?.score?.weights || {}, ...settings?.weights || {} };
  const total = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 1;
  const value = (key) => {
    const input = context[`${key}Score`] ?? context[key];
    if (Array.isArray(input)) return input.length ? 1 : 0;
    const number = Number(input);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
  };
  const keys = [
    'htfAlignment', 'liquiditySweep', 'structure', 'displacement',
    'fvg', 'orderBlock', 'premiumDiscount', 'session', 'volumeVolatility',
  ];
  const raw = keys.reduce((sum, key) => sum + value(key) * Number(weights[key] || 0), 0);
  const components = Object.fromEntries(keys.map((key) => [key, value(key)]));

  const score = (raw / total) * 100;
  return {
    raw,
    total,
    score: Math.max(0, Math.min(100, score)),
    components,
  };
}
