export function createStructureEvent({ type, label, price, time, direction, color, position, shape }) {
  return {
    type,
    label,
    price,
    time,
    direction,
    color,
    position,
    shape,
  };
}

export function createMarketStructureSnapshot({ swings = [], structure = [], bos = [], choch = [] } = {}) {
  return {
    swings,
    structure,
    bos,
    choch,
  };
}
