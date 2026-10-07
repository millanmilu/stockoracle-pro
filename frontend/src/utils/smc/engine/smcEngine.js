import { normalizeSMCSettings } from '../config/smcSettings.js';
import { detectSwingStructure } from './swingDetector.js';
import { detectLiquidityZones } from './liquidityDetector.js';
import { detectSMCOrderBlocks } from './orderBlockDetector.js';
import { detectSMCFVGs } from './fvgDetector.js';
import { determinePremiumDiscount } from './premiumDiscount.js';
import { detectImbalance } from './imbalanceDetector.js';
import { detectInducement } from './inducementDetector.js';
import { detectMitigation } from './mitigationDetector.js';
import { detectSession } from './sessionDetector.js';
import { analyzeMultiTimeframe } from './mtfAnalyzer.js';
import { detectSetup } from './setupDetector.js';
import { calculateSMCScore } from './smcScore.js';
import { buildSignal } from './signalEngine.js';

export function createSMCAnalysis(candles, settings = {}) {
  const normalized = normalizeSMCSettings(settings);

  const swings = detectSwingStructure(candles, normalized.structure);
  const liquidity = detectLiquidityZones(candles, normalized.liquidity);
  const orderBlocks = detectSMCOrderBlocks(candles, normalized.orderBlocks);
  const fvgs = detectSMCFVGs(candles, normalized.imbalance);
  const premiumDiscount = determinePremiumDiscount(candles, normalized.premiumDiscount);
  const imbalance = detectImbalance(candles, normalized.imbalance);
  const inducement = detectInducement(candles, normalized.liquidity);
  const mtf = analyzeMultiTimeframe(candles, normalized.mtf);
  const session = detectSession(candles[candles.length - 1] || {}, normalized.sessions);

  const mitigatedZones = detectMitigation(candles, [...liquidity.levels, ...fvgs.gaps, ...orderBlocks.blocks], normalized.liquidity);
  const biasDirection = mtf.bias === 'bullish' ? 'bull' : mtf.bias === 'bearish' ? 'bear' : null;
  const latestBreak = swings.bos.at(-1);
  const averageRange = candles.slice(-15).reduce((sum, candle) => {
    const high = Number(candle.high);
    const low = Number(candle.low);
    return Number.isFinite(high) && Number.isFinite(low) ? sum + Math.max(0, high - low) : sum;
  }, 0) / Math.max(1, candles.slice(-15).length);
  const latestCandle = candles.at(-1) || {};
  const currentPrice = Number(latestCandle.close);
  const relevanceRange = Number.isFinite(averageRange) && averageRange > 0
    ? averageRange * 3.5
    : Math.abs(currentPrice) * 0.007;
  const isNearPrice = (zone) => {
    const top = Number(zone.top);
    const bottom = Number(zone.bottom);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || !Number.isFinite(currentPrice)) return false;
    const low = Math.min(top, bottom);
    const high = Math.max(top, bottom);
    const distance = currentPrice < low ? low - currentPrice : currentPrice > high ? currentPrice - high : 0;
    return distance <= relevanceRange;
  };
  const zoneIsUntouched = (block) => {
    const creationIndex = candles.findIndex((candle) => candle.time === (block.confirmedTime ?? block.time));
    if (creationIndex < 0) return false;
    const low = Math.min(Number(block.top), Number(block.bottom));
    const high = Math.max(Number(block.top), Number(block.bottom));
    return !candles.slice(creationIndex + 1).some((candle) => (
      Number(candle.high) >= low && Number(candle.low) <= high
    ));
  };
  const hasRecentStructure = latestBreak && Number.isInteger(latestBreak.index)
    && candles.length - latestBreak.index <= 40;
  const body = Math.abs(Number(latestCandle.close) - Number(latestCandle.open));
  const candleDirection = Number(latestCandle.close) > Number(latestCandle.open)
    ? 'bull'
    : Number(latestCandle.close) < Number(latestCandle.open) ? 'bear' : null;
  const displacement = biasDirection && candleDirection === biasDirection && averageRange > 0
    ? Math.min(1, body / averageRange)
    : 0;
  const alignedFvgs = fvgs.gaps.filter((gap) => biasDirection
    && gap.type?.startsWith(`${biasDirection === 'bull' ? 'bullish' : 'bearish'}_`)
    && isNearPrice(gap)
    && zoneIsUntouched(gap));
  const alignedOrderBlocks = orderBlocks.blocks.filter((block) => biasDirection
    && block.type?.startsWith(`${biasDirection === 'bull' ? 'bullish' : 'bearish'}_`)
    && isNearPrice(block)
    && zoneIsUntouched(block));
  const structureLabel = hasRecentStructure && latestBreak.direction === biasDirection
    ? latestBreak.type
    : 'neutral';
  const premiumDiscountAligned = (mtf.bias === 'bullish' && premiumDiscount.zone === 'discount')
    || (mtf.bias === 'bearish' && premiumDiscount.zone === 'premium');
  const alignedSweeps = liquidity.sweeps.filter((sweep) => sweep.direction === mtf.bias
    && Number.isInteger(sweep.sweptIndex) && candles.length - 1 - sweep.sweptIndex <= 40);
  const context = {
    htfAlignmentScore: mtf.bias === 'neutral' ? 0 : mtf.confidence / 100,
    liquiditySweepScore: alignedSweeps.length ? 1 : 0,
    structureScore: structureLabel === 'neutral' ? 0 : 1,
    displacementScore: displacement,
    fvgScore: alignedFvgs.length ? 1 : 0,
    orderBlockScore: alignedOrderBlocks.length ? 1 : 0,
    premiumDiscountScore: premiumDiscountAligned ? 1 : 0,
    sessionScore: session === 'london' || session === 'newYork' ? 1 : 0,
    volumeVolatilityScore: imbalance.volumeImbalance.length ? 1 : 0,
    bias: mtf.bias,
    structure: structureLabel,
    liquidity: alignedSweeps,
    orderBlocks: alignedOrderBlocks,
    fvg: alignedFvgs,
    entry: premiumDiscount.equilibrium,
    stopLoss: mtf.bias === 'bearish' ? premiumDiscount.swingHigh : premiumDiscount.swingLow,
    takeProfit: mtf.bias === 'bearish' ? premiumDiscount.swingLow : premiumDiscount.swingHigh,
  };

  const score = calculateSMCScore(context, normalized);
  const setup = detectSetup({ ...context, score: score.score }, normalized.signals);
  const signal = buildSignal({ setup, bias: mtf.bias });

  return {
    settings: normalized,
    swings,
    liquidity,
    orderBlocks,
    fvgs,
    premiumDiscount,
    imbalance,
    inducement,
    session,
    mtf,
    mitigatedZones,
    score,
    setup,
    signal,
    summary: {
      direction: setup.direction,
      score: score.score,
      bias: mtf.bias,
      zone: setup.zone,
      activeObjects: {
        liquidity: liquidity.levels.length,
        ob: orderBlocks.blocks.length,
        fvg: fvgs.gaps.length,
      },
    },
  };
}

export function analyzeSMC(candles, settings = {}) {
  return createSMCAnalysis(candles, settings);
}

export default {
  createSMCAnalysis,
  analyzeSMC,
};
