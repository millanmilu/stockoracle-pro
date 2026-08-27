import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      // ── Navigation ──────────────────────────────────────────────────────────
      selectedSymbol: 'RELIANCE',
      predictionData: null,
      trainingStatus: null,
      theme: 'dark',
      activeView: 'Live Chart',

      setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
      setPredictionData: (data)   => set({ predictionData: data }),
      setTrainingStatus: (status) => set({ trainingStatus: status }),
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
      setActiveView: (view) => set({ activeView: view }),

      // ── History Cache (avoids re-fetching when switching views) ─────────────
      historyCache: {},   // { 'RELIANCE_3M_1d': [...] }
      setHistoryCache: (key, data) =>
        set((s) => ({ historyCache: { ...s.historyCache, [key]: data } })),
      clearHistoryCache: () => set({ historyCache: {} }),

      // ── Live Prices & WebSocket Status ──────────────────────────────────────
      wsConnected: false,
      setWsConnected: (val) => set({ wsConnected: val }),
      livePrices: {},   // { RELIANCE: { price: 1420, change_pct: 0.5 } }
      setLivePrice: (ticker, payload) =>
        set((s) => ({ livePrices: { ...s.livePrices, [ticker]: payload } })),

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
    }
  )
);

// Apply persisted theme on load
const { theme } = useStore.getState();
document.documentElement.setAttribute('data-theme', theme || 'dark');

export default useStore;
