import { LineStyle } from 'lightweight-charts';

export function updatePaperPositionLines({
  candleSeriesRef,
  paperPriceLinesRef,
  paperPosition,
  livePrice,
  selectedSymbol,
}) {
    const series = candleSeriesRef.current;
    const lines = paperPriceLinesRef.current;

    // Clean up previous price lines
    if (lines.entry && series) {
      try { series.removePriceLine(lines.entry); } catch {}
      lines.entry = null;
    }
    if (lines.stopLoss && series) {
      try { series.removePriceLine(lines.stopLoss); } catch {}
      lines.stopLoss = null;
    }
    if (lines.target && series) {
      try { series.removePriceLine(lines.target); } catch {}
      lines.target = null;
    }

    if (!series || series.__isDisposed || !paperPosition) return;
    const posTicker = String(paperPosition.ticker || '').toUpperCase().trim();
    const curTicker = String(selectedSymbol || '').toUpperCase().trim();
    if (posTicker !== curTicker) return;

    try {
      const entryPrice = Number(paperPosition.avg_buy_price || 0);
      if (entryPrice > 0) {
        const curP = Number(livePrice || paperPosition.current_price || entryPrice);
        const pnl = Math.round((curP - entryPrice) * paperPosition.shares * 100) / 100;
        const pnlPct = Math.round(((curP - entryPrice) / Math.max(0.01, entryPrice)) * 10000) / 100;
        const isProfit = pnl >= 0;
        const sign = isProfit ? '+' : '';

        lines.entry = series.createPriceLine({
          price: entryPrice,
          color: isProfit ? '#10B981' : '#EF4444',
          lineWidth: 2,
          lineStyle: LineStyle ? LineStyle.Solid : 0,
          axisLabelVisible: true,
          title: `LONG ${paperPosition.shares} @ ₹${entryPrice.toFixed(1)} | P&L: ${sign}₹${pnl.toLocaleString('en-IN')} (${sign}${pnlPct}%)`,
        });

        if (paperPosition.stop_loss) {
          const slP = Number(paperPosition.stop_loss);
          const slLoss = Math.round((slP - entryPrice) * paperPosition.shares * 100) / 100;
          lines.stopLoss = series.createPriceLine({
            price: slP,
            color: '#F43F5E',
            lineWidth: 1,
            lineStyle: LineStyle ? LineStyle.Dashed : 2,
            axisLabelVisible: true,
            title: `SL: ₹${slP.toFixed(1)} (${slLoss >= 0 ? '+' : ''}₹${slLoss})`,
          });
        }

        if (paperPosition.target_price) {
          const tpP = Number(paperPosition.target_price);
          const tpGain = Math.round((tpP - entryPrice) * paperPosition.shares * 100) / 100;
          lines.target = series.createPriceLine({
            price: tpP,
            color: '#10B981',
            lineWidth: 1,
            lineStyle: LineStyle ? LineStyle.Dashed : 2,
            axisLabelVisible: true,
            title: `TP: ₹${tpP.toFixed(1)} (+₹${tpGain})`,
          });
        }
      }
    } catch (err) {
      console.warn('Error rendering paper trade price lines:', err);
    }

    return () => {
      if (lines.entry && series) {
        try { series.removePriceLine(lines.entry); } catch {}
        lines.entry = null;
      }
      if (lines.stopLoss && series) {
        try { series.removePriceLine(lines.stopLoss); } catch {}
        lines.stopLoss = null;
      }
      if (lines.target && series) {
        try { series.removePriceLine(lines.target); } catch {}
        lines.target = null;
      }
    };
}
