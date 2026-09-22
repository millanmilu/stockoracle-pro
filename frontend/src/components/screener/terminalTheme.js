/**
 * StockOracle Pro — Institutional terminal design tokens.
 *
 * Single source of truth for the screener's visual identity:
 * deep near-black surfaces, one subtle border color, restrained
 * semantic palette (green/red/gray + violet AI accent + amber warn).
 * Radius is 4px almost everywhere; typography is compact with
 * tabular numerals for data.
 *
 * Render-only: no logic, API, or state lives here.
 */

export const TN = {
  bg: '#04060D',
  panel: '#080C17',
  panelAlt: '#0A0F1E',
  inset: '#05080F',
  border: 'rgba(148,163,184,0.12)',
  borderStrong: 'rgba(148,163,184,0.22)',
  text: '#E2E8F0',
  muted: '#8B98AD',
  faint: '#5B6B82',
  accent: '#7C8CF8',
  accentDim: 'rgba(124,140,248,0.12)',
  up: '#22C55E',
  upDim: 'rgba(34,197,94,0.10)',
  down: '#F87171',
  downDim: 'rgba(248,113,113,0.10)',
  ai: '#A78BFA',
  aiDim: 'rgba(167,139,250,0.10)',
  warn: '#FBBF24',
  warnDim: 'rgba(251,191,36,0.10)',
  info: '#38BDF8',
  mono: "'JetBrains Mono', ui-monospace, monospace",
  radius: 4,
};

export const semColor = (kind) => {
  switch (kind) {
    case 'up': return TN.up;
    case 'down': return TN.down;
    case 'ai': return TN.ai;
    case 'warn': return TN.warn;
    case 'info': return TN.info;
    default: return TN.muted;
  }
};

export const panel = (extra = {}) => ({
  background: TN.panel,
  border: `1px solid ${TN.border}`,
  borderRadius: TN.radius,
  ...extra,
});

/** 11px uppercase section title: "MARKET BREADTH — 51 STOCKS" */
export const sectionTitle = (extra = {}) => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: TN.faint,
  textTransform: 'uppercase',
  ...extra,
});

export const btn = (active = false, extra = {}) => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 28,
  padding: '0 10px',
  borderRadius: TN.radius,
  background: active ? 'rgba(124,140,248,0.16)' : 'rgba(148,163,184,0.06)',
  color: active ? TN.accent : TN.muted,
  border: `1px solid ${active ? 'rgba(124,140,248,0.45)' : TN.border}`,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
  ...extra,
});

export const btnPrimary = (extra = {}) => ({
  ...btn(false),
  background: '#1D4ED8',
  borderColor: '#1D4ED8',
  color: '#FFFFFF',
  fontWeight: 700,
  ...extra,
});

export const btnGreen = (extra = {}) => ({
  ...btn(false),
  background: 'rgba(34,197,94,0.14)',
  border: '1px solid rgba(34,197,94,0.40)',
  color: TN.up,
  fontWeight: 700,
  ...extra,
});

export const input = (extra = {}) => ({
  background: TN.inset,
  border: `1px solid ${TN.border}`,
  borderRadius: TN.radius,
  color: TN.text,
  fontSize: 12,
  outline: 'none',
  ...extra,
});

export const chip = (tone = 'default', extra = {}) => {
  const tones = {
    default: { color: TN.muted, border: TN.border, bg: 'rgba(148,163,184,0.06)' },
    ai: { color: TN.ai, border: 'rgba(167,139,250,0.35)', bg: TN.aiDim },
    up: { color: TN.up, border: 'rgba(34,197,94,0.35)', bg: TN.upDim },
    down: { color: TN.down, border: 'rgba(248,113,113,0.35)', bg: TN.downDim },
    warn: { color: TN.warn, border: 'rgba(251,191,36,0.35)', bg: TN.warnDim },
    info: { color: TN.info, border: 'rgba(56,189,248,0.35)', bg: 'rgba(56,189,248,0.10)' },
  };
  const t = tones[tone] || tones.default;
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 20,
    padding: '0 7px',
    borderRadius: 2,
    fontSize: 11,
    fontFamily: TN.mono,
    color: t.color,
    background: t.bg,
    border: `1px solid ${t.border}`,
    whiteSpace: 'nowrap',
    ...extra,
  };
};

export const num = (size = 12, extra = {}) => ({
  fontFamily: TN.mono,
  fontVariantNumeric: 'tabular-nums',
  fontSize: size,
  ...extra,
});
