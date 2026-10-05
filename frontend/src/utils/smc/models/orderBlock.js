export function createOrderBlock({ type, top, bottom, time, label, color, state = 'active', direction = 'bullish', mitigation = 0 }) {
  return {
    type,
    top,
    bottom,
    time,
    label,
    color,
    state,
    direction,
    mitigation,
  };
}
