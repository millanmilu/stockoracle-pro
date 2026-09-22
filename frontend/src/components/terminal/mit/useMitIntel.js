import { useMemo } from 'react';
import { BULL, BEAR, NEUT, clamp } from './utils';

/* Fuse news + TA + history + AI summary into one explainable intel model. */
export function useMitIntel({ articles, newsMeta, ta, info, hist, aiSum, live, symbol }) {
  return useMemo(() => {
    const n = articles.length;
    const nb = articles.filter((a) => a._s === 'bull').length;
    const nn = articles.filter((a) => a._s === 'neg').length;
    
    const avgS = n ? articles.reduce((s, a) => s + a._sc, 0) / n : (newsMeta.score || 0);
    const score = clamp(avgS, -1, 1);
    const dist = {
      score, label: score > 0.15 ? 'BULLISH' : score < -0.15 ? 'BEARISH' : 'NEUTRAL',
      bull: n ? Math.round((nb / n) * 100) : 0, bear: n ? Math.round((nn / n) * 100) : 0,
      neu: n ? Math.max(0, 100 - Math.round((nb / n) * 100) - Math.round((nn / n) * 100)) : 100,
    };
    const spark = articles.slice(0, 24).reverse().map((a) => a._sc);
    const trend = spark.length > 3 ? ((spark.slice(-6).reduce((s, v) => s + v, 0) / Math.min(6, spark.length) - spark.slice(0, 6).reduce((s, v) => s + v, 0) / Math.min(6, spark.length)) > 0.15 ? 'RISING' : 'FALLING') : 'STABLE';
    const closes = (hist || []).map((r) => r.close).filter((v) => v > 0);
    const pxChg = closes.length > 1 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : (live?.change_pct ?? 0);
    const last = closes.length ? closes[closes.length - 1] : null;
    const prevC = closes.length > 1 ? closes[closes.length - 2] : null;
    const dChg = last && prevC ? ((last - prevC) / prevC) * 100 : pxChg;
    const div = (() => {
      const p = dChg, s = score * 3;
      if (p > 1 && s > 0.6) return { status: 'BULLISH CONFIRMATION', pricePct: p, sent: score, note: `Price +${p.toFixed(1)}% aligns with +${score.toFixed(2)} news sentiment. Momentum and narrative agree.` };
      if (p < -1 && s < -0.6) return { status: 'BEARISH CONFIRMATION', pricePct: p, sent: score, note: `Price ${p.toFixed(1)}% aligns with ${score.toFixed(2)} news sentiment. Downside pressure confirmed.` };
      if (p < -1 && s > 0.4) return { status: 'BULLISH DIVERGENCE', pricePct: p, sent: score, note: 'Price falling while sentiment stays positive — possible capitulation or early accumulation. Watch for reversal.' };
      if (p > 1 && s < -0.4) return { status: 'BEARISH DIVERGENCE', pricePct: p, sent: score, note: 'Price rising into negative headlines — rally lacks narrative support. Risk of sentiment reversal.' };
      if (Math.abs(p) < 0.6 && Math.abs(s) > 0.5) return { status: 'SENTIMENT REVERSAL', pricePct: p, sent: score, note: 'Strong narrative building while price consolidates — breakout watch in sentiment direction.' };
      return { status: 'WEAKENING MOMENTUM', pricePct: p, sent: score, note: 'Price and sentiment both muted. No tradable edge — wait for expansion.' };
    })();
    const fgV = Math.round(clamp(((score + 1) / 2) * 0.55 + (dChg > 0 ? 0.62 : dChg < 0 ? 0.38 : 0.5) * 0.45, 0, 1) * 100);
    const fg = {
      value: fgV, color: fgV <= 20 ? BEAR : fgV <= 40 ? '#FB923C' : fgV <= 60 ? NEUT : fgV <= 80 ? '#34D399' : BULL,
      label: fgV <= 20 ? 'Extreme Fear' : fgV <= 40 ? 'Fear' : fgV <= 60 ? 'Neutral' : fgV <= 80 ? 'Greed' : 'Extreme Greed',
      hist: [
        { k: 'NOW', v: fgV, c: '#E2E8F0', hint: 'Composite of news sentiment + price momentum' },
        { k: '1D', v: clamp(fgV + Math.round(score * 4), 2, 99), c: '#94A3B8', hint: 'Estimate from prior session tone' },
        { k: '1W', v: clamp(fgV - Math.round(dChg), 2, 99), c: '#94A3B8', hint: 'Estimate from weekly momentum delta' },
      ],
      note: 'Composite of news sentiment + price momentum. 1D/1W are estimates, not exchange prints.',
    };
    return { dist, spark, trend, div, fg, score, dChg };
  }, [articles, newsMeta, hist, live]);
}
