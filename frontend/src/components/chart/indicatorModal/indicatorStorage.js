import { INDICATOR_DEFINITIONS } from '../indicatorDefinitions';
import { FAVORITES_KEY, RECENT_KEY, MAX_RECENT } from './indicatorModalStyles';

/**
 * Favorites are pruned against the live catalog on load so an id that was
 * renamed or removed can never leave the ★ Favorites tab claiming a non-zero
 * count while rendering an empty list.
 */
function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(INDICATOR_DEFINITIONS.map((indicator) => indicator.id));
    return parsed.filter((id) => known.has(id));
  } catch {
    return [];
  }
}

function loadRecent() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const known = new Set(INDICATOR_DEFINITIONS.map((indicator) => indicator.id));
    return parsed.filter((id) => known.has(id)).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export { loadFavorites, loadRecent };
