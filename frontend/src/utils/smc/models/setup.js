export function createSetup({ direction, score, confidence, bias, zone, entry, stopLoss, takeProfit, reasons = [] }) {
  return {
    direction,
    score,
    confidence,
    bias,
    zone,
    entry,
    stopLoss,
    takeProfit,
    reasons,
  };
}
