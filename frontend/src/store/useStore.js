import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      // ── Navigation ──────────────────────────────────────────────────────────
      selectedSymbol: 'BTC',
      selectedInterval: '1m',
      predictionData: null,
      trainingStatus: null,
      theme: 'dark',
      activeView: 'Live Chart',

      // Normalized once here so every entry point (screener, heatmap,
      // command palette, toolbar) maps to the same per-symbol state —
      // chart drawings, live ticks and caches are all keyed by this value.
      setSelectedSymbol: (symbol) => set({
        selectedSymbol: String(symbol ?? '').toUpperCase().trim() || 'BTC',
      }),
      setSelectedInterval: (iv) =>
        set((s) => {
          const updatedPrices = { ...s.livePrices };
          Object.keys(updatedPrices).forEach((k) => {
            if (updatedPrices[k]) {
              updatedPrices[k] = { ...updatedPrices[k], liveCandle: undefined };
            }
          });
          return { selectedInterval: iv, livePrices: updatedPrices };
        }),
      setPredictionData: (data)   => set({ predictionData: data }),
      setTrainingStatus: (status) => set({ trainingStatus: status }),
      setTheme: (theme) => {
        const next = theme === 'light' ? 'light' : 'dark';
        try {
          document.documentElement.setAttribute('data-theme', next);
          document.documentElement.style.colorScheme = next;
        } catch {}
        set({ theme: next });
      },
      toggleTheme: () =>
        set((s) => {
          const next = s.theme === 'light' ? 'dark' : 'light';
          try {
            document.documentElement.setAttribute('data-theme', next);
            document.documentElement.style.colorScheme = next;
          } catch {}
          return { theme: next };
        }),
      setActiveView: (view) => set({ activeView: view }),

      // ── History Cache (avoids re-fetching when switching views) ─────────────
      historyCache: {},   // { 'RELIANCE_3M_1d': [...] }
      setHistoryCache: (key, data) =>
        set((s) => ({ historyCache: { ...s.historyCache, [key]: data } })),
      clearHistoryCache: () => set({ historyCache: {} }),

      // ── Live Prices & WebSocket Status ──────────────────────────────────────
      wsConnected: false,
      setWsConnected: (val) => set({ wsConnected: val }),
      wsLiveData: false,      // true only after confirmed live WS tick arrives
      setWsLiveData: (val) => set({ wsLiveData: val }),
      livePrices: {},   // { RELIANCE: { price: 1420, change_pct: 0.5 } }
      setLivePrice: (ticker, payload) =>
        set((s) => {
          const prev = s.livePrices[ticker] || {};
          const liveCandle = payload.liveCandle !== undefined ? payload.liveCandle : prev.liveCandle;
          return {
            livePrices: {
              ...s.livePrices,
              [ticker]: {
                ...prev,
                ...payload,
                liveCandle,
              },
            },
          };
        }),

      // ── Price Alerts ────────────────────────────────────────────────────────
      priceAlerts: [],  // [{ id, ticker, condition: 'above'|'below', threshold }]
      addAlert: (alert) =>
        set((s) => ({
          priceAlerts: [
            ...s.priceAlerts,
            { ...alert, id: Date.now().toString(), createdAt: new Date().toISOString() },
          ],
        })),
      removeAlert: (id) =>
        set((s) => ({ priceAlerts: s.priceAlerts.filter((a) => a.id !== id) })),
      clearAlerts: () => set({ priceAlerts: [] }),

      // ── Portfolio ───────────────────────────────────────────────────────────
      portfolio: [],  // [{ id, ticker, quantity, buyPrice, addedAt }]
      addPosition: (position) =>
        set((s) => ({
          portfolio: [
            ...s.portfolio,
            { ...position, id: Date.now().toString(), addedAt: new Date().toISOString() },
          ],
        })),
      updatePosition: (id, updates) =>
        set((s) => ({
          portfolio: s.portfolio.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),
      removePosition: (id) =>
        set((s) => ({ portfolio: s.portfolio.filter((p) => p.id !== id) })),
    }),
    {
      name: 'stockoracle-store',
      // Only persist user data (theme, portfolio, alerts) — not transient state
      partialize: (state) => ({
        theme: state.theme,
        selectedSymbol: state.selectedSymbol,
        portfolio: state.portfolio,
        priceAlerts: state.priceAlerts,
      }),
      // One-time repair: values persisted before symbol normalization
      // (e.g. lowercase) are upgraded to the canonical form on load.
      onRehydrateStorage: () => (rehydrated) => {
        try {
          const sym = String(rehydrated?.selectedSymbol ?? '').toUpperCase().trim();
          if (sym && sym !== rehydrated.selectedSymbol) {
            rehydrated.selectedSymbol = sym;
          } else if (!sym) {
            rehydrated.selectedSymbol = 'BTC';
          }
        } catch {}
      },
    }
  )
);

// Apply persisted theme on load (fall back to OS preference on first visit)
function resolveInitialTheme() {
  try {
    const raw = localStorage.getItem('stockoracle-store');
    if (raw) {
      const parsed = JSON.parse(raw);
      const persisted = parsed?.state?.theme;
      if (persisted === 'light' || persisted === 'dark') return persisted;
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
  } catch {}
  return useStore.getState().theme || 'dark';
}

try {
  const initial = resolveInitialTheme();
  document.documentElement.setAttribute('data-theme', initial);
  document.documentElement.style.colorScheme = initial;
  if (useStore.getState().theme !== initial) {
    useStore.setState({ theme: initial });
  }
} catch {}

export default useStore;
