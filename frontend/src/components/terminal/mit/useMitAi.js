import { useMemo } from 'react';
import { clamp } from './utils';
function verdictOf(total) {
  if (total >= 30) return { signal: 'BUY', bias: 'BULLISH' };
  if (total <= -30) return { signal: 'SELL', bias: 'BEARISH' };
  if (total >= 8) return { signal: 'BUY', bias: 'BULLISH' };
  if (total <= -8) return { signal: 'SELL', bias: 'BEARISH' };
  return { signal: 'HOLD', bias: 'NEUTRAL' };
}
export function useMitAi({ articles, newsMeta, ta, hist, aiSum, intel, score, dChg, symbol }) {
  return useMemo(() => {
    const rsi = ta?.rsi ?? 50; const macdH = ta?.macd_hist ?? 0;
    const macd = ta?.macd ?? 0; const macdS = ta?.macd_signal ?? 0;
    const vols = (hist || []).map((r) => r.volume).filter((v) => v > 0);
    const volR = vols.length > 5 ? vols[vols.length - 1] / (vols.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, vols.length)) : 1;
    const newsPts = clamp(Math.round(score * 30), -30, 30);
    const momPts = clamp(Math.round(dChg * 4), -20, 20);
    const rsiPts = rsi < 30 ? 12 : rsi < 45 ? -6 : rsi <= 65 ? 12 : rsi <= 75 ? 4 : -10;
    const macdPts = macd > macdS && macdH > 0 ? 15 : macd > macdS ? 8 : macd < macdS && macdH < 0 ? -12 : 0;
    const volPts = volR > 1.5 ? 10 : volR > 1.1 ? 5 : volR < 0.6 ? -5 : 0;
    const closes = (hist || []).map((r) => r.close).filter((v) => v > 0);
    let volaPts = 0;
    if (closes.length > 6) {
      const sd = Math.sqrt(closes.slice(-20).map((c, i, a) => (i ? Math.log(c / a[i - 1]) : 0)).reduce((s, x) => s + x * x, 0) / 19) * 100;
      volaPts = sd > 6 ? -8 : sd > 3.5 ? -4 : 2;
    }
    const fgPts = Math.round(((intel?.fg?.value ?? 50) - 50) / 50 * 15);
    const parts = [
      { k: 'News Sentiment', v: newsPts, hint: `${articles.length} headlines avg ${score.toFixed(2)}` },
      { k: 'Momentum', v: momPts, hint: `Move ${dChg.toFixed(2)}%` },
      { k: 'RSI', v: rsiPts, hint: `RSI-14 ${Number(rsi).toFixed(1)}` },
      { k: 'MACD', v: macdPts, hint: `Hist ${Number(macdH).toFixed(3)}` },
      { k: 'Volume', v: volPts, hint: `Ratio ${volR.toFixed(2)}x` },
      { k: 'Volatility', v: volaPts, hint: 'Realized-vol drag' },
      { k: 'Fear & Greed', v: fgPts, hint: `Index ${intel?.fg?.value ?? '—'}` },
    ];
    const total = parts.reduce((s, p) => s + p.v, 0);
    const { signal, bias } = verdictOf(total);
    const conf = clamp(48 + Math.abs(total) + (articles.length >= 8 ? 8 : 4) + (ta ? 6 : 0), 5, 96);
    const regime = ta?.market_regime || (Math.abs(volaPts) >= 8 ? 'HIGH VOLATILITY' : Math.abs(dChg) > 3 ? 'TRENDING' : Math.abs(score) > 0.4 ? 'TRENDING' : 'RANGING');
    const bull = articles.filter((a) => a._s === 'bull').slice(0, 3).map((a) => String(a.title).slice(0, 90));
    const bear = articles.filter((a) => a._s === 'neg').slice(0, 3).map((a) => String(a.title).slice(0, 90));
    const drivers = [...new Set(articles.slice(0, 8).map((a) => a._evt))].slice(0, 4);
    while (drivers.length < 3) drivers.push(['ETF activity', 'Macro liquidity', 'Price momentum'][drivers.length]);
    const ai = {
      bias, signal, conf, regime,
      narrative: `${symbol} sentiment is ${score > 0.15 ? 'constructive' : score < -0.15 ? 'fragile' : 'mixed'} (${score >= 0 ? '+' : ''}${score.toFixed(2)}) across ${articles.length} headlines with price ${dChg >= 0 ? 'up' : 'down'} ${Math.abs(dChg).toFixed(2)}%. ${regime === 'HIGH VOLATILITY' ? 'Volatility remains elevated — size positions accordingly.' : regime === 'TRENDING' ? 'Momentum and narrative are aligned; confirmation from price structure still required.' : 'Range conditions dominate — fade extremes until expansion confirms.'}`,
      pos: [...bull, `RSI ${Number(rsi).toFixed(0)} holds structure`, `Volume ${volR.toFixed(1)}x average`].slice(0, 4),
      risks: [...bear, volaPts < 0 ? 'Elevated realized volatility' : 'Thin confirmation on low volume', ...((aiSum?.risks || []).slice(0, 1))].slice(0, 4),
    };
    const sig = { action: signal, conf, level: conf >= 80 ? 'High' : conf >= 55 ? 'Moderate' : 'Low', parts };
    const nB = articles.filter((a) => a._s === 'bull').length;
    const nBe = articles.filter((a) => a._s === 'neg').length;
    const nN = articles.length - nB - nBe;
    const bySrc = {};
    articles.forEach((a) => { const k = a.source || 'Other'; bySrc[k] = bySrc[k] || { b: 0, n: 0, d: 0 }; bySrc[k][a._s === 'bull' ? 'b' : a._s === 'neg' ? 'd' : 'n']++; });
    const tot = Math.max(1, articles.length);
    const consensus = {
      bull: Math.round((nB / tot) * 100), bear: Math.round((nBe / tot) * 100), neu: Math.round((nN / tot) * 100),
      state: articles.length < 3 ? 'LOW COVERAGE' : Math.max(nB, nBe, nN) / tot >= 0.6 ? 'CONSENSUS' : 'CONFLICTING REPORTS',
      top: Object.entries(bySrc).sort((a, b) => (b[1].b - b[1].d) - (a[1].b - a[1].d))[0]?.[0] || null,
    };
    const groups = {};
    articles.filter((a) => a._imp === 'HIGH').slice(0, 12).forEach((a) => {
      const k = a._evt + '|' + String(a.title).slice(0, 70);
      groups[k] = groups[k] || { ...a, count: 0 };
      groups[k].count++;
    });
    const events = Object.values(groups).slice(0, 8).map((e) => ({
      title: e.title, tag: e._evt, source: e.source, when: e.published_at, count: e.count,
      sev: /crash|hack|ban|collapse|emergency|war|default|fraud|liquidat/i.test(String(e.title)) ? 'CRITICAL' : e._rel >= 75 ? 'HIGH' : 'MEDIUM',
    }));
    const evidence = articles.slice(0, 5).map((a) => ({ source: a.source, title: a.title }));
    const summary = aiSum?.summary ? {
      narrative: aiSum.summary, label: aiSum.sentiment || newsMeta.label, impact: aiSum.impact || 'Neutral',
      drivers, risks: (aiSum.risks && aiSum.risks.length ? aiSum.risks : ai.risks).slice(0, 3),
      conclusion: `Momentum reads ${signal === 'BUY' ? 'constructive' : signal === 'SELL' ? 'fragile' : 'mixed'} at ${conf}% confidence — confirmation from price structure is required.`,
      evidence,
    } : {
      narrative: `${symbol} sentiment is ${score > 0.15 ? 'improving' : score < -0.15 ? 'deteriorating' : 'mixed'} across ${articles.length} headlines. ${(drivers.slice(0, 2).join(' and ') || 'Headline flow')} ${score >= 0 ? 'supports' : 'pressures'} price into a ${Math.abs(dChg).toFixed(2)}% session move.`,
      label: intel.dist.label, impact: Math.abs(score) > 0.4 ? 'Positive' : 'Neutral',
      drivers, risks: ai.risks.slice(0, 3),
      conclusion: `Momentum remains ${signal === 'BUY' ? 'positive' : signal === 'SELL' ? 'negative' : 'undecided'}, but confirmation from price structure is required.`,
      evidence,
    };
    return { ai, sig, consensus, events, summary };
  }, [articles, newsMeta, ta, hist, aiSum, intel, score, dChg, symbol]);
}
