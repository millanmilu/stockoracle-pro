/**
 * StockOracle Pro — Centralized Light / Dark theme tokens.
 *
 * Single source of truth for UI + lightweight-charts colors.
 * `theme` is always the string 'dark' | 'light' (persisted in zustand store).
 */

export const THEMES = {
  dark: {
    // Shell / UI
    topbarBg: '#050713',
    topbarBorder: 'rgba(255,255,255,0.07)',
    topbarText: '#F0F0FF',
    topbarMuted: '#9CA3AF',
    sidebarBg: '#060A16',
    mainBg: '#07090F',
    statusBg: '#03040A',
    cardBg: '#0C1022',
    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.12)',
    inputText: '#fff',
    searchResultsBg: '#0B0F22',
    divider: 'rgba(99,102,241,0.1)',
    hoverBg: 'rgba(99,102,241,0.15)',

    // Chart containers
    chartBg: '#090C15',
    paneBg: '#090C16',
    paneBorder: 'rgba(99,102,241,0.18)',
    toolbarBg: '#0B0F1C',
    toolbarBorder: 'rgba(148,163,184,0.14)',
    toolbarText: '#CBD5E1',
    toolbarMuted: '#94A3B8',
    toolbarActive: '#7DD3FC',
    menuBg: '#111827',

    // lightweight-charts
    chartText: '#6B7280',
    gridVert: 'rgba(99,102,241,0.04)',
    gridHorz: 'rgba(99,102,241,0.06)',
    priceBorder: 'rgba(99,102,241,0.12)',
    legendBg: 'rgba(11,15,28,0.88)',
    legendBorder: 'rgba(255,255,255,0.06)',
    legendText: '#E2E8F0',
    legendMuted: '#94A3B8',
  },
  light: {
    // Shell / UI — muted tones darkened for contrast on white (≈7:1 for body text)
    topbarBg: '#ffffff',
    topbarBorder: 'rgba(15,23,42,0.10)',
    topbarText: '#0F172A',
    topbarMuted: '#475569',
    sidebarBg: '#f1f5f9',
    mainBg: '#f0f2f8',
    statusBg: '#e2e8f0',
    cardBg: '#ffffff',
    inputBg: 'rgba(15,23,42,0.05)',
    inputBorder: 'rgba(15,23,42,0.14)',
    inputText: '#0F172A',
    searchResultsBg: '#ffffff',
    divider: 'rgba(99,102,241,0.16)',
    hoverBg: 'rgba(99,102,241,0.10)',

    // Chart containers
    chartBg: '#ffffff',
    paneBg: '#f8fafc',
    paneBorder: 'rgba(15,23,42,0.14)',
    toolbarBg: '#ffffff',
    toolbarBorder: 'rgba(15,23,42,0.12)',
    toolbarText: '#0F172A',
    toolbarMuted: '#475569',
    toolbarActive: '#0284C7',
    menuBg: '#ffffff',

    // lightweight-charts
    chartText: '#334155',
    gridVert: 'rgba(15,23,42,0.07)',
    gridHorz: 'rgba(15,23,42,0.09)',
    priceBorder: 'rgba(15,23,42,0.18)',
    legendBg: 'rgba(255,255,255,0.95)',
    legendBorder: 'rgba(15,23,42,0.16)',
    legendText: '#0F172A',
    legendMuted: '#475569',
  },
};

export function normalizeTheme(t) {
  return t === 'light' ? 'light' : 'dark';
}

export function getThemeTokens(theme) {
  return THEMES[normalizeTheme(theme)] || THEMES.dark;
}

/** Base lightweight-charts options (layout/grid/scales) for a given theme. */
export function getChartBaseOptions(theme) {
  const tk = getThemeTokens(theme);
  return {
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: tk.chartText,
      fontFamily: '"JetBrains Mono", "Courier New", monospace',
      fontSize: 11,
    },
    grid: {
      vertLines: { color: tk.gridVert, style: 1 },
      horzLines: { color: tk.gridHorz },
    },
    rightPriceScale: {
      borderColor: tk.priceBorder,
      textColor: tk.chartText,
    },
    timeScale: {
      borderColor: tk.priceBorder,
      textColor: tk.chartText,
    },
  };
}

/** Apply theme colors to an existing lightweight-charts instance (no recreate). */
export function applyChartTheme(chart, theme) {
  if (!chart) return;
  try {
    const tk = getThemeTokens(theme);
    chart.applyOptions({
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: tk.chartText,
      },
      grid: {
        vertLines: { color: tk.gridVert },
        horzLines: { color: tk.gridHorz },
      },
      rightPriceScale: { borderColor: tk.priceBorder, textColor: tk.chartText },
      timeScale: { borderColor: tk.priceBorder, textColor: tk.chartText },
    });
  } catch {}
}
