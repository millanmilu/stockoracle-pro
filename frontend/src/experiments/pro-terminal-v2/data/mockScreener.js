// Pro Terminal V2 — Mock Screener Data

export const mockScreenerResults = [
  { rank: 1, symbol: 'RELIANCE', ltp: 2874.35, change: 0.55, marketCap: '19.45 LCr', pe: 24.8, roe: 11.2, roce: 13.8, debtEquity: 0.43, rsi: 58, aboveEma200: true },
  { rank: 2, symbol: 'TCS', ltp: 3852.10, change: 1.24, marketCap: '14.2 LCr', pe: 32.1, roe: 45.8, roce: 52.3, debtEquity: 0.08, rsi: 62, aboveEma200: true },
  { rank: 3, symbol: 'HDFCBANK', ltp: 1652.45, change: -0.32, marketCap: '12.8 LCr', pe: 19.2, roe: 14.5, roce: 16.2, debtEquity: 1.12, rsi: 45, aboveEma200: true },
  { rank: 4, symbol: 'INFY', ltp: 1524.80, change: 0.89, marketCap: '6.2 LCr', pe: 28.4, roe: 28.2, roce: 35.4, debtEquity: 0.12, rsi: 55, aboveEma200: true },
  { rank: 5, symbol: 'ICICIBANK', ltp: 1042.30, change: 1.15, marketCap: '8.9 LCr', pe: 16.8, roe: 16.2, roce: 18.5, debtEquity: 0.95, rsi: 61, aboveEma200: true },
  { rank: 6, symbol: 'SBIN', ltp: 812.55, change: -0.78, marketCap: '7.2 LCr', pe: 9.8, roe: 18.5, roce: 22.1, debtEquity: 1.45, rsi: 42, aboveEma200: false },
  { rank: 7, symbol: 'WIPRO', ltp: 485.20, change: 0.42, marketCap: '2.5 LCr', pe: 22.1, roe: 15.8, roce: 18.2, debtEquity: 0.15, rsi: 52, aboveEma200: true },
  { rank: 8, symbol: 'HCLTECH', ltp: 1685.40, change: 1.68, marketCap: '4.6 LCr', pe: 26.5, roe: 32.1, roce: 38.5, debtEquity: 0.05, rsi: 65, aboveEma200: true },
  { rank: 9, symbol: 'BHARTIARTL', ltp: 1542.80, change: 0.95, marketCap: '8.9 LCr', pe: 78.5, roe: 12.4, roce: 15.8, debtEquity: 1.85, rsi: 57, aboveEma200: true },
  { rank: 10, symbol: 'ITC', ltp: 462.15, change: -0.15, marketCap: '5.8 LCr', pe: 28.2, roe: 25.8, roce: 32.4, debtEquity: 0.02, rsi: 48, aboveEma200: true },
  { rank: 11, symbol: 'LT', ltp: 3542.60, change: 2.15, marketCap: '4.8 LCr', pe: 32.5, roe: 16.8, roce: 19.2, debtEquity: 1.25, rsi: 68, aboveEma200: true },
  { rank: 12, symbol: 'TITAN', ltp: 3245.90, change: -1.25, marketCap: '2.9 LCr', pe: 88.2, roe: 22.5, roce: 28.4, debtEquity: 0.35, rsi: 38, aboveEma200: false },
  { rank: 13, symbol: 'SUNPHARMA', ltp: 1842.30, change: 0.75, marketCap: '4.4 LCr', pe: 38.5, roe: 18.2, roce: 22.5, debtEquity: 0.25, rsi: 54, aboveEma200: true },
  { rank: 14, symbol: 'MARUTI', ltp: 12452.00, change: 1.85, marketCap: '3.9 LCr', pe: 28.5, roe: 15.2, roce: 18.8, debtEquity: 0.08, rsi: 63, aboveEma200: true },
  { rank: 15, symbol: 'TATAMOTORS', ltp: 785.40, change: -2.15, marketCap: '2.9 LCr', pe: 8.5, roe: 12.8, roce: 15.2, debtEquity: 1.15, rsi: 35, aboveEma200: false },
];

export const mockScreenerFilters = [
  { id: 'market_cap', label: 'Market Cap > 10,000 Cr', field: 'marketCap', operator: '>', value: 10000, unit: 'Cr' },
  { id: 'roe', label: 'ROE > 15%', field: 'roe', operator: '>', value: 15, unit: '%' },
  { id: 'debt_equity', label: 'Debt/Equity < 0.5', field: 'debtEquity', operator: '<', value: 0.5, unit: '' },
  { id: 'rsi', label: 'RSI < 60', field: 'rsi', operator: '<', value: 60, unit: '' },
  { id: 'above_ema200', label: 'Close > EMA 200', field: 'aboveEma200', operator: '=', value: true, unit: '' },
];

export const mockFilterFields = [
  { id: 'market_cap', label: 'Market Cap', type: 'number', unit: 'Cr' },
  { id: 'pe', label: 'P/E', type: 'number', unit: '' },
  { id: 'pb', label: 'P/B', type: 'number', unit: '' },
  { id: 'roe', label: 'ROE', type: 'number', unit: '%' },
  { id: 'roce', label: 'ROCE', type: 'number', unit: '%' },
  { id: 'debt_equity', label: 'Debt/Equity', type: 'number', unit: '' },
  { id: 'eps', label: 'EPS', type: 'number', unit: '' },
  { id: 'dividend_yield', label: 'Dividend Yield', type: 'number', unit: '%' },
  { id: 'rsi', label: 'RSI', type: 'number', unit: '' },
  { id: 'above_ema200', label: 'Close > EMA200', type: 'boolean', unit: '' },
];
