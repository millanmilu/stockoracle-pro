// Pro Terminal V2 — Mock News Data

export const mockNews = [
  {
    id: 1,
    headline: 'Company announces major investment in renewable energy division',
    source: 'Economic Times',
    time: new Date(Date.now() - 2 * 3600000).toISOString(),
    sentiment: 'positive',
    summary: 'The company plans to invest ₹50,000 Cr over the next 5 years in solar and green hydrogen projects.',
  },
  {
    id: 2,
    headline: 'Shares gain on strong quarterly outlook and margin expansion',
    source: 'Moneycontrol',
    time: new Date(Date.now() - 5 * 3600000).toISOString(),
    sentiment: 'positive',
    summary: 'Analysts raise target prices after management guidance suggests 15% revenue growth in FY26.',
  },
  {
    id: 3,
    headline: 'Analysts revise expectations amid mixed sector performance',
    source: 'LiveMint',
    time: new Date(Date.now() - 24 * 3600000).toISOString(),
    sentiment: 'neutral',
    summary: 'Brokerage firms have mixed views on the stock, with 12 buys, 8 holds, and 3 sells.',
  },
  {
    id: 4,
    headline: 'Regulatory approval pending for key acquisition deal',
    source: 'Reuters',
    time: new Date(Date.now() - 48 * 3600000).toISOString(),
    sentiment: 'neutral',
    summary: 'The CCI is reviewing the proposed acquisition. Decision expected within 60 days.',
  },
  {
    id: 5,
    headline: 'Institutional investors increase stake in Q3',
    source: 'Bloomberg',
    time: new Date(Date.now() - 72 * 3600000).toISOString(),
    sentiment: 'positive',
    summary: 'FII holding increased by 1.2% in the December quarter, signaling confidence.',
  },
  {
    id: 6,
    headline: 'Commodity price volatility may impact margins',
    source: 'Financial Express',
    time: new Date(Date.now() - 96 * 3600000).toISOString(),
    sentiment: 'negative',
    summary: 'Rising input costs could compress operating margins by 100-150 bps in the near term.',
  },
  {
    id: 7,
    headline: 'New product launch planned for next quarter',
    source: 'ET Now',
    time: new Date(Date.now() - 120 * 3600000).toISOString(),
    sentiment: 'positive',
    summary: 'The company will launch 3 new products targeting the premium segment.',
  },
  {
    id: 8,
    headline: 'Debt levels remain within comfortable range',
    source: 'CNBC TV18',
    time: new Date(Date.now() - 144 * 3600000).toISOString(),
    sentiment: 'neutral',
    summary: 'Net debt-to-EBITDA stands at 1.2x, well below the industry average of 2.5x.',
  },
];

export const mockMarketNews = [
  { id: 1, headline: 'NIFTY 50 hits all-time high on strong FII inflows', source: 'ET', time: '1h ago', sentiment: 'positive' },
  { id: 2, headline: 'RBI keeps repo rate unchanged at 6.5%', source: 'Mint', time: '2h ago', sentiment: 'neutral' },
  { id: 3, headline: 'IT sector leads gains on strong Q3 earnings', source: 'MC', time: '3h ago', sentiment: 'positive' },
  { id: 4, headline: 'Oil prices surge on geopolitical tensions', source: 'Reuters', time: '4h ago', sentiment: 'negative' },
  { id: 5, headline: 'Rupee strengthens against dollar', source: 'Bloomberg', time: '5h ago', sentiment: 'positive' },
];
