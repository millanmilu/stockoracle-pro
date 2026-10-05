export function createFVG({ type, top, bottom, time, label, color, state = 'active', fill = 0 }) {
  return {
    type,
    top,
    bottom,
    time,
    label,
    color,
    state,
    fill,
  };
}
