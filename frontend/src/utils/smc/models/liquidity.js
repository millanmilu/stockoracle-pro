export function createLiquidityLevel({ type, price, top, bottom, time, label, color, state = 'untouched' }) {
  return {
    type,
    price,
    top,
    bottom,
    time,
    label,
    color,
    state,
  };
}
