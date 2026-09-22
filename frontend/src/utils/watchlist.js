export const WATCHLIST_STORAGE_KEY = 'stockoracle_custom_watchlist';

export const DEFAULT_WATCHLIST = [
  'RELIANCE',
  'TCS',
  'HDFCBANK',
  'INFY',
  'ICICIBANK',
  'SBIN',
  'BHARTIARTL',
  'ITC',
  'AXISBANK',
  'WIPRO',
  'LT',
  'HCLTECH',
];

const normalizeTicker = (value) => String(value ?? '').trim().toUpperCase();

// Resolves storage in browsers (window.localStorage) and in Node unit tests
// (which mock globalThis.localStorage). Browser behaviour is unchanged.
const resolveStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch { /* ignore */ }
  try {
    const g = globalThis.localStorage;
    if (g && typeof g.getItem === 'function') return g;
  } catch { /* ignore */ }
  return null;
};

export function readWatchlist(fallback = DEFAULT_WATCHLIST) {
  const safeFallback = Array.isArray(fallback) ? fallback : [];
  const defaultList = Array.from(new Set(safeFallback.map(normalizeTicker).filter(Boolean)));

  try {
    const storage = resolveStorage();
    if (!storage) return defaultList;
    const raw = storage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return defaultList;

    const parsed = JSON.parse(raw);
    const stored = Array.isArray(parsed) ? parsed : [];
    const normalized = Array.from(new Set(stored.map(normalizeTicker).filter(Boolean)));
    return normalized.length > 0 ? normalized : defaultList;
  } catch {
    return defaultList;
  }
}

export function addToWatchlist(symbol, fallback = DEFAULT_WATCHLIST) {
  const normalized = normalizeTicker(symbol);
  if (!normalized) return readWatchlist(fallback);

  const current = readWatchlist(fallback);
  const next = Array.from(new Set([...current, normalized]));

  try {
    const storage = resolveStorage();
    if (storage) {
      const didChange = next.length !== current.length || next.some((item, index) => item !== current[index]);
      if (didChange) {
        storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(next));
      }
    }
  } catch {
    // ignore storage failures; still return the in-memory list
  }

  return next;
}
