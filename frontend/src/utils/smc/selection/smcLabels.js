/**
 * StockOracle Pro — label collision system (pixel-space placement).
 *
 * Structural tags, level tags and setup chips compete for the same pixels.
 * placeTags() takes candidate tags with priorities and returns the placed
 * subset with adjusted positions:
 *   - higher priority wins every conflict (setup > liquidity > structure)
 *   - measured label rectangles are checked against labels and reserved areas
 *   - colliding tags shift vertically (up to 5 nudges of 13px)
 *   - unplaceable low-priority tags are dropped, never stacked
 *   - right-edge chips stack with a 17px minimum rhythm
 *
 * Pure and viewport-explicit: the layer converts price/time → pixels, this
 * module only resolves overlaps.
 */

export const TAG_PRIORITY = {
  setup: 100,
  setupLevel: 95,
  mss: 85,
  sweep: 80,
  liquidity: 75,
  ob: 65,
  fvg: 60,
  structure: 40,
  swing: 30,
  zone: 15,
};

const NUDGE = 13;
const MAX_NUDGES = 5;

function boundsOf(tag) {
  const width = Number(tag.width) || Math.max(34, Math.min(110, String(tag.text || '').length * 5.7 + 14));
  const height = Number(tag.height) || 18;
  const left = tag.anchor === 'middle' ? tag.x - width / 2 : tag.x - 2;
  return { left, right: left + width, top: tag.y - height / 2, bottom: tag.y + height / 2 };
}

function overlaps(a, b, gap = 3) {
  return a.left < b.right + gap && a.right + gap > b.left
    && a.top < b.bottom + gap && a.bottom + gap > b.top;
}

function inBounds(box, bounds) {
  if (!bounds) return true;
  return box.left >= (bounds.left ?? 0) && box.right <= bounds.right
    && box.top >= (bounds.top ?? 0) && box.bottom <= bounds.bottom;
}

/**
 * @param {Array} tags [{x, y, text, color, anchor?, kind?, key?, width?, height?}]
 * @param {{bounds?: object, reserved?: Array<object>}} options
 * @returns {Array} placed tags (subset, y possibly adjusted)
 */
export function placeTags(tags, options = {}) {
  const sorted = [...(Array.isArray(tags) ? tags : [])]
    .filter((t) => t && Number.isFinite(t.x) && Number.isFinite(t.y) && t.text)
    .sort((a, b) => (TAG_PRIORITY[b.kind] ?? 40) - (TAG_PRIORITY[a.kind] ?? 40));
  const placed = [];
  const reserved = (Array.isArray(options.reserved) ? options.reserved : [])
    .filter((box) => box && Number.isFinite(box.left) && Number.isFinite(box.right)
      && Number.isFinite(box.top) && Number.isFinite(box.bottom));
  for (const tag of sorted) {
    let candidate = { ...tag };
    let ok = false;
    for (let n = 0; n <= MAX_NUDGES; n++) {
      const box = boundsOf(candidate);
      const hit = placed.some((p) => overlaps(box, boundsOf(p)))
        || reserved.some((area) => overlaps(box, area));
      if (!hit && inBounds(box, options.bounds)) {
        ok = true;
        break;
      }
      const offset = Math.ceil(n / 2) * NUDGE * (n % 2 === 1 ? -1 : 1);
      candidate = { ...tag, y: tag.y + offset };
    }
    if (ok) placed.push(candidate);
    // else: dropped — a hidden label beats a stacked one.
  }
  return placed;
}

/**
 * Stack right-edge price chips vertically so Entry/SL/TP never overlap each
 * other or liquidity tags sharing the edge. Input chips carry desired y;
 * output chips are spaced ≥17px, highest priority (setup) keeps its slot.
 */
export function stackEdgeChips(chips) {
  const sorted = [...(Array.isArray(chips) ? chips : [])]
    .filter((c) => c && Number.isFinite(c.y))
    .sort((a, b) => (TAG_PRIORITY[b.kind] ?? 40) - (TAG_PRIORITY[a.kind] ?? 40));
  const placed = [];
  for (const chip of sorted) {
    let y = chip.y;
    for (let n = 0; n < 12; n++) {
      if (placed.every((p) => Math.abs(p.y - y) >= 17)) break;
      y += 17;
    }
    placed.push({ ...chip, y });
  }
  return placed.sort((a, b) => a.y - b.y);
}
