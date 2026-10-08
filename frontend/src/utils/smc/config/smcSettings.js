export const DEFAULT_SMC_SETTINGS = {
  enabled: true,
  sensitivity: 1,
  objectLimit: 8,
  structure: {
    internal: true,
    swing: true,
    confirmationMethod: 'close',
    closeConfirmation: true,
    wickConfirmation: false,
    structureSensitivity: 1,
    windowSize: 5,
  },
  liquidity: {
    bsL: true,
    ssL: true,
    equalHighs: true,
    equalLows: true,
    sweepDetection: true,
    pdhPdl: true,
  },
  orderBlocks: {
    bullish: true,
    bearish: true,
    breaker: true,
    mitigation: true,
    minDisplacement: 0.35,
    maxActiveOBs: 8,
    bodyBased: true,
    wickInclusion: false,
    method: 'close',
  },
  imbalance: {
    fvg: true,
    ifvg: true,
    volumeImbalance: false,
    minGapAtr: 0.05,
  },
  premiumDiscount: {
    autoRange: true,
    htFRange: false,
    currentSwingRange: true,
  },
  sessions: {
    asian: { start: '00:00', end: '08:59', tz: 'Asia/Kolkata' },
    london: { start: '09:00', end: '11:59', tz: 'Europe/London' },
    newYork: { start: '13:30', end: '16:00', tz: 'America/New_York' },
  },
  mtf: {
    htf: '1D',
    structureTf: '4H',
    setupTf: '15M',
    entryTf: '5M',
  },
  signals: {
    showEntry: true,
    showRisk: true,
    minimumConfluence: 2,
  },
  score: {
    weights: {
      htfAlignment: 20,
      liquiditySweep: 15,
      structure: 15,
      displacement: 15,
      fvg: 10,
      orderBlock: 10,
      premiumDiscount: 5,
      session: 5,
      volumeVolatility: 5,
    },
  },
};

export function normalizeSMCSettings(overrides = {}) {
  const merged = structuredClone(DEFAULT_SMC_SETTINGS);
  return {
    ...merged,
    ...overrides,
    structure: { ...merged.structure, ...(overrides.structure || {}) },
    liquidity: { ...merged.liquidity, ...(overrides.liquidity || {}) },
    orderBlocks: { ...merged.orderBlocks, ...(overrides.orderBlocks || {}) },
    imbalance: { ...merged.imbalance, ...(overrides.imbalance || {}) },
    premiumDiscount: { ...merged.premiumDiscount, ...(overrides.premiumDiscount || {}) },
    sessions: { ...merged.sessions, ...(overrides.sessions || {}) },
    mtf: { ...merged.mtf, ...(overrides.mtf || {}) },
    signals: { ...merged.signals, ...(overrides.signals || {}) },
    score: { ...merged.score, ...(overrides.score || {}), weights: { ...merged.score.weights, ...(overrides.score?.weights || {}) } },
  };
}
