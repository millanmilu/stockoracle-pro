/**
 * StockOracle Pro — Centralized Light / Dark theme tokens.
 *
 * Single source of truth for UI + lightweight-charts colors.
 * `theme` is always the string 'dark' | 'light' (persisted in zustand store).
 */

export const TV = {
  blue: '#2962FF',
  blueHover: 'rgba(41,98,255,0.12)',
  up: '#26A69A',
  down: '#EF5350',
  upVol: 'rgba(38,166,154,0.5)',
  downVol: 'rgba(239,83,80,0.5)',
};

export const THEMES = {
  dark: {
    // Shell / UI — TradingView dark parity
    topbarBg: '#131722',
    topbarBorder: '#2A2E39',
    topbarText: '#D1D4DC',
    topbarMuted: '#787B86',
    sidebarBg: '#131722',
    mainBg: '#131722',
    statusBg: '#131722',
    cardBg: '#1E222D',
    inputBg: '#2A2E39',
    inputBorder: '#363C4E',
    inputText: '#D1D4DC',
    searchResultsBg: '#1E222D',
    divider: '#2A2E39',
    hoverBg: 'rgba(41,98,255,0.12)',

    // Chart containers — TradingView dark parity
    chartBg: '#131722',
    paneBg: '#131722',
    paneBorder: '#2A2E39',
    toolbarBg: '#131722',
    toolbarBorder: '#2A2E39',
    toolbarText: '#D1D4DC',
    toolbarMuted: '#787B86',
    toolbarActive: '#2962FF',
    menuBg: '#1E222D',

    // lightweight-charts — TradingView dark parity
    chartText: '#787B86',
    gridVert: '#1E222D',
    gridHorz: '#1E222D',
    priceBorder: '#2A2E39',
    crosshair: '#787B86',
    crosshairLabelBg: '#363C4E',
    legendBg: 'rgba(19,23,34,0.9)',
    legendBorder: '#2A2E39',
    legendText: '#D1D4DC',
    legendMuted: '#787B86',
  },
  light: {
    // Shell / UI — TradingView light parity
    topbarBg: '#FFFFFF',
    topbarBorder: '#E0E3EB',
    topbarText: '#131722',
    topbarMuted: '#787B86',
    sidebarBg: '#FFFFFF',
    mainBg: '#FFFFFF',
    statusBg: '#F0F3FA',
    cardBg: '#FFFFFF',
    inputBg: '#F0F3FA',
    inputBorder: '#E0E3EB',
    inputText: '#131722',
    searchResultsBg: '#FFFFFF',
    divider: '#E0E3EB',
    hoverBg: 'rgba(41,98,255,0.08)',

    // Chart containers — TradingView light parity
    chartBg: '#FFFFFF',
    paneBg: '#FFFFFF',
    paneBorder: '#E0E3EB',
    toolbarBg: '#FFFFFF',
    toolbarBorder: '#E0E3EB',
    toolbarText: '#131722',
    toolbarMuted: '#787B86',
    toolbarActive: '#2962FF',
    menuBg: '#FFFFFF',

    // lightweight-charts — TradingView light parity
    chartText: '#787B86',
    gridVert: '#F0F3FA',
    gridHorz: '#F0F3FA',
    priceBorder: '#E0E3EB',
    crosshair: '#787B86',
    crosshairLabelBg: '#787B86',
    legendBg: 'rgba(255,255,255,0.92)',
    legendBorder: '#E0E3EB',
    legendText: '#131722',
    legendMuted: '#787B86',
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
      fontFamily: "'Trebuchet MS', Roboto, Ubuntu, sans-serif",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: tk.gridVert },
      horzLines: { color: tk.gridHorz },
    },
    crosshair: {
      mode: 0,
      vertLine: { color: tk.crosshair, width: 1, style: 2, labelBackgroundColor: tk.crosshairLabelBg },
      horzLine: { color: tk.crosshair, width: 1, style: 2, labelBackgroundColor: tk.crosshairLabelBg },
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
      crosshair: {
        vertLine: { color: tk.crosshair, labelBackgroundColor: tk.crosshairLabelBg },
        horzLine: { color: tk.crosshair, labelBackgroundColor: tk.crosshairLabelBg },
      },
      rightPriceScale: { borderColor: tk.priceBorder, textColor: tk.chartText },
      timeScale: { borderColor: tk.priceBorder, textColor: tk.chartText },
    });
  } catch {}
}
