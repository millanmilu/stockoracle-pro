/* StockOracle Pro · Market Intelligence Terminal — shared helpers + intel derivation.
   All derived values are analytical estimates from live endpoint data. No invented prices. */
export const SOURCES_10 = [
  'Economic Times', 'Moneycontrol', 'LiveMint', 'Business Standard',
  'NDTV Profit', 'Yahoo Finance', 'Google News', 'Reuters', 'Bloomberg',
  'CNBC TV18', 'CoinDesk', 'Cointelegraph'
];

export const SRC_COLOR = {
  'Economic Times': '#FB7185',
  Moneycontrol: '#60A5FA',
  LiveMint: '#FB923C',
  'Business Standard': '#38BDF8',
  'NDTV Profit': '#FBBF24',
  'Yahoo Finance': '#A78BFA',
  'Google News': '#34D399',
  Reuters: '#FDBA74',
  Bloomberg: '#818CF8',
  CNBC: '#2DD4BF',
  'CNBC TV18': '#2DD4BF',
  CoinDesk: '#F59E0B',
  Cointelegraph: '#22D3EE',
  Decrypt: '#A78BFA',
};

export const BULL = '#10B981', BEAR = '#F43F5E', NEUT = '#F59E0B', AI = '#818CF8';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const fmtN = (v, d = 2) => (v === null || v === undefined || isNaN(Number(v)) ? '—' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }));
export const fmtComp = (v) => { const n = Number(v); if (!isFinite(n)) return '—'; const a = Math.abs(n); if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M'; if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K'; return String(Math.round(n)); };

export const isCryptoSymbol = (sym) => {
  if (!sym) return false;
  const s = String(sym).toUpperCase().trim();
  return ['BTC', 'BITCOIN', 'ETH', 'ETHEREUM', 'SOL', 'SOLANA', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'USDT'].includes(s) || s.endsWith('USDT');
};

export function timeAgo(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return Math.max(1, Math.floor(s)) + 's ago';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

export function sentOf(a) { const l = String(a.sentiment || a.sentiment_label || '').toLowerCase(); if (l.includes('bull')) return 'bull'; if (l.includes('bear')) return 'neg'; return 'neu'; }
export const sentColor = (s) => (s === 'bull' ? BULL : s === 'neg' ? BEAR : NEUT);
export const sentLabel = (s) => (s === 'bull' ? 'BULLISH' : s === 'neg' ? 'BEARISH' : 'NEUTRAL');
const HI_PAT = /etf|fed|rate hike|rate cut|sec|regul|surge|soar|plunge|crash|record|all-time|whale|liquidat|hack|ban|approval|halving|breakout|collapse|emergency|war|default|fraud|merger|acquisit|breakthrough|probe/i;
const MED_PAT = /profit|revenue|growth|upgrade|downgrade|forecast|outlook|guidance|inflation|gdp|jobs|earnings|dividend|buyback|dollar|oil|gold|nifty|sensex|bank|volume|order win|target/i;
export const importanceOf = (t) => { const s = String(t || ''); return HI_PAT.test(s) ? 'HIGH' : MED_PAT.test(s) ? 'MEDIUM' : 'LOW'; };

export function eventOf(t) {
  const s = String(t || '').toLowerCase();
  if (/etf|spot bitcoin|inflow|outflow|institutional|fund/.test(s)) return 'ETF / Flows';
  if (/sec|regul|court|lawsuit|ban|tax|bill|policy|probe|investig/.test(s)) return 'Regulation';
  if (/fed|rate|powell|fomc|central bank|ecb|boj|rbi|repo/.test(s)) return 'Interest Rates';
  if (/inflation|cpi|ppi|gdp|jobs|unemploy|payroll|trade deficit/.test(s)) return 'Macroeconomics';
  if (/whale|accumulat|holder|exchange outflow|exchange inflow|reserve/.test(s)) return 'Whale Activity';
  if (/liquidat|funding rate|leverage|short squeeze|long squeeze|open interest/.test(s)) return 'Liquidations';
  if (/earn|revenue|profit|guidance|results|quarter|q1|q2|q3|q4/.test(s)) return 'Earnings';
  if (/war|geopolit|tariff|sanction|election|china|russia|israel|iran/.test(s)) return 'Geopolitics';
  if (/upgrade|halving|mainnet|protocol|layer|hack|exploit|ai|tech/.test(s)) return 'Technology';
  return 'Markets / Corporate';
}

export function enrichArticles(raw) {
  const now = Date.now();
  return (raw || []).map((a, i) => {
    const s = sentOf(a); const title = a.title || '';
    const imp = importanceOf(title); const evt = eventOf(title);
    const sc = typeof a.sentiment_score === 'number' ? a.sentiment_score : (s === 'bull' ? 0.5 : s === 'neg' ? -0.5 : 0);
    const ageH = a.published_at ? Math.max(0, (now - new Date(a.published_at).getTime()) / 36e5) : 24;
    const recency = clamp(1 - ageH / 48, 0, 1);
    const rel = Math.round(clamp(42 + Math.abs(sc) * 34 + (imp === 'HIGH' ? 12 : imp === 'MEDIUM' ? 6 : 0) + recency * 10 + (SOURCES_10.includes(a.source) ? 3 : 0), 5, 99));
    const impact = Math.round(clamp(38 + Math.abs(sc) * 38 + (imp === 'HIGH' ? 14 : imp === 'MEDIUM' ? 6 : 0) + recency * 8, 4, 98));
    return { ...a, _i: i, _s: s, _sc: sc, _imp: imp, _evt: evt, _rel: rel, _impact: impact, _ageH: ageH };
  });
}
