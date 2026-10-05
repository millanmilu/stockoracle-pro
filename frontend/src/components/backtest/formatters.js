export const fmtPct = (v, d = 2) => `${Number(v) >= 0 ? '+' : ''}${(Number(v) * 100).toFixed(d)}%`;
export const fmtNum = (v, d = 2) => Number(v || 0).toFixed(d);
export const fmtCurr = (v, symbol) => `${symbol}${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const posNegColor = (v, thresh = 0) => Number(v) >= thresh ? '#10B981' : '#F43F5E';
