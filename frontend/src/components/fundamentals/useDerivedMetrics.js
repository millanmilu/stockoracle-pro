import { useMemo } from 'react';

export function useDerivedMetrics({
  data,
  deepData,
  ticker,
  qTimeframe,
  aTimeframe,
  sortField,
  sortAsc,
  dcfGrowthRate,
  dcfWacc,
  dcfTerminalGrowth,
}) {
  // Defensive Normalizations & Comprehensive Quarterly Analytics
  const enrichedQuarters = useMemo(() => {
    const rawQuarters =
      (deepData?.quarterly_results?.length ? deepData.quarterly_results : null) ||
      (data?.quarterly_results?.length ? data.quarterly_results : []);

    if (!rawQuarters || rawQuarters.length === 0) return [];

    const chronological = rawQuarters.map((q, idx) => ({
      rawIndex: idx,
      period: q.period || `Q${idx + 1}`,
      revenue: q.revenue ?? q.Sales ?? q["Sales+"] ?? q.Revenue ?? null,
      net_profit: q.net_profit ?? q["Net Profit"] ?? q["Net Profit+"] ?? null,
      eps: q.eps ?? q["EPS in Rs"] ?? null,
      opm: q["OPM %"] ?? (q.revenue && q.net_profit ? ((q.net_profit / q.revenue) * 100) : null),
      revenue_qoq_pct: q.revenue_qoq_pct,
      profit_qoq_pct: q.profit_qoq_pct,
    }));

    // Linear regression for EPS trendline
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, validEpsCount = 0;
    chronological.forEach((q, i) => {
      if (q.eps != null && !isNaN(q.eps)) {
        sumX += i;
        sumY += Number(q.eps);
        sumXY += i * Number(q.eps);
        sumXX += i * i;
        validEpsCount++;
      }
    });

    const denom = validEpsCount * sumXX - sumX * sumX;
    const slope = (validEpsCount > 1 && denom !== 0)
      ? (validEpsCount * sumXY - sumX * sumY) / denom
      : 0;
    const intercept = validEpsCount > 0
      ? (sumY - slope * sumX) / validEpsCount
      : 0;

    return chronological.map((q, i) => {
      const prevQ = i > 0 ? chronological[i - 1] : null;
      const prevYearQ = i >= 4 ? chronological[i - 4] : null;

      const revQoQ = q.revenue_qoq_pct != null
        ? q.revenue_qoq_pct
        : (prevQ?.revenue && q.revenue != null ? ((q.revenue - prevQ.revenue) / Math.abs(prevQ.revenue)) * 100 : null);

      const profitQoQ = q.profit_qoq_pct != null
        ? q.profit_qoq_pct
        : (prevQ?.net_profit && q.net_profit != null ? ((q.net_profit - prevQ.net_profit) / Math.abs(prevQ.net_profit)) * 100 : null);

      const epsQoQ = prevQ?.eps && q.eps != null ? ((q.eps - prevQ.eps) / Math.abs(prevQ.eps)) * 100 : null;

      const revYoY = prevYearQ?.revenue && q.revenue != null ? ((q.revenue - prevYearQ.revenue) / Math.abs(prevYearQ.revenue)) * 100 : null;
      const profitYoY = prevYearQ?.net_profit && q.net_profit != null ? ((q.net_profit - prevYearQ.net_profit) / Math.abs(prevYearQ.net_profit)) * 100 : null;
      const epsYoY = prevYearQ?.eps && q.eps != null ? ((q.eps - prevYearQ.eps) / Math.abs(prevYearQ.eps)) * 100 : null;

      const epsTrend = Number((slope * i + intercept).toFixed(2));

      return {
        ...q,
        idx: i,
        revQoQ: revQoQ != null ? Number(revQoQ.toFixed(1)) : null,
        profitQoQ: profitQoQ != null ? Number(profitQoQ.toFixed(1)) : null,
        epsQoQ: epsQoQ != null ? Number(epsQoQ.toFixed(1)) : null,
        revYoY: revYoY != null ? Number(revYoY.toFixed(1)) : null,
        profitYoY: profitYoY != null ? Number(profitYoY.toFixed(1)) : null,
        epsYoY: epsYoY != null ? Number(epsYoY.toFixed(1)) : null,
        epsTrend,
      };
    });
  }, [data, deepData]);

  // Filtered Quarters based on Timeframe selector
  const displayedQuarters = useMemo(() => {
    if (qTimeframe === '4q') return enrichedQuarters.slice(-4);
    if (qTimeframe === '8q') return enrichedQuarters.slice(-8);
    return enrichedQuarters;
  }, [enrichedQuarters, qTimeframe]);

  // Aggregate summary metrics for quarterly results — computed over the
  // timeframe-filtered quarters so the selector affects KPIs and charts alike.
  const summaryStats = useMemo(() => {
    if (!displayedQuarters || displayedQuarters.length === 0) return null;

    const validRevQoQ = displayedQuarters.map(q => q.revQoQ).filter(v => v != null);
    const validProfitQoQ = displayedQuarters.map(q => q.profitQoQ).filter(v => v != null);
    const validEpsQoQ = displayedQuarters.map(q => q.epsQoQ).filter(v => v != null);

    const avgRevQoQ = validRevQoQ.length ? (validRevQoQ.reduce((a, b) => a + b, 0) / validRevQoQ.length) : null;
    const avgProfitQoQ = validProfitQoQ.length ? (validProfitQoQ.reduce((a, b) => a + b, 0) / validProfitQoQ.length) : null;
    const avgEpsQoQ = validEpsQoQ.length ? (validEpsQoQ.reduce((a, b) => a + b, 0) / validEpsQoQ.length) : null;

    const latest = displayedQuarters[displayedQuarters.length - 1];
    const prev = displayedQuarters.length >= 2 ? displayedQuarters[displayedQuarters.length - 2] : null;

    let trendVerdict = "Stable Trajectory";
    let trendPositive = true;
    if (avgRevQoQ != null && avgProfitQoQ != null) {
      if (avgRevQoQ > 3 && avgProfitQoQ > 5) {
        trendVerdict = "Strong Expansion";
        trendPositive = true;
      } else if (avgRevQoQ > 0 && avgProfitQoQ > 0) {
        trendVerdict = "Moderate Growth";
        trendPositive = true;
      } else if (avgRevQoQ < 0 && avgProfitQoQ < 0) {
        trendVerdict = "Cyclical Contraction";
        trendPositive = false;
      } else {
        trendVerdict = "Mixed Margin Volatility";
        trendPositive = avgProfitQoQ >= 0;
      }
    }

    return {
      avgRevQoQ,
      avgProfitQoQ,
      avgEpsQoQ,
      trendVerdict,
      trendPositive,
      latest,
      prev,
    };
  }, [displayedQuarters]);

  // Quarterly Table Sorting Logic
  const sortedTableData = useMemo(() => {
    const dataCopy = [...displayedQuarters];
    dataCopy.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return dataCopy;
  }, [displayedQuarters, sortField, sortAsc]);

  const quarterly = enrichedQuarters;

  const annualPl = useMemo(() => {
    const raw = (deepData?.annual_pl?.length ? deepData.annual_pl : (data?.annual_pl || [])).map(a => ({
      ...a,
      Sales: a.Sales ?? a.revenue ?? a['Sales+'] ?? null,
      'Net Profit': a['Net Profit'] ?? a.net_profit ?? a['Net Profit+'] ?? null,
      'EPS in Rs': a['EPS in Rs'] ?? a.eps ?? null,
    }));
    if (aTimeframe === '3y') return raw.slice(-3);
    if (aTimeframe === '5y') return raw.slice(-5);
    return raw;
  }, [deepData, data, aTimeframe]);

  const balanceSheet = useMemo(() => {
    const raw = deepData?.balance_sheet?.length ? deepData.balance_sheet : (data?.balance_sheet || []);
    if (aTimeframe === '3y') return raw.slice(-3);
    if (aTimeframe === '5y') return raw.slice(-5);
    return raw;
  }, [deepData, data, aTimeframe]);

  const cashFlow = useMemo(() => {
    const raw = (deepData?.cash_flow?.length ? deepData.cash_flow : (data?.cash_flow || [])).map(cf => ({
      ...cf,
      'Cash from Operating Activity': cf['Cash from Operating Activity'] ?? cf['Operating Activity'] ?? cf['CFO'] ?? null,
      'Cash from Investing Activity': cf['Cash from Investing Activity'] ?? cf['Investing Activity'] ?? cf['CFI'] ?? null,
      'Cash from Financing Activity': cf['Cash from Financing Activity'] ?? cf['Financing Activity'] ?? cf['CFF'] ?? null,
      'Net Cash Flow': cf['Net Cash Flow'] ?? cf.net_cash_flow ?? null,
    }));
    if (aTimeframe === '3y') return raw.slice(-3);
    if (aTimeframe === '5y') return raw.slice(-5);
    return raw;
  }, [deepData, data, aTimeframe]);

  const shareholding = (deepData?.shareholding?.length ? deepData.shareholding : (data?.shareholding || [])).map(s => ({
    ...s,
    promoter: s.promoter ?? s.Promoters ?? null,
    fii: s.fii ?? s.FIIs ?? s.FII ?? null,
    dii: s.dii ?? s.DIIs ?? s.DII ?? null,
    public: s.public ?? s.Public ?? null,
  }));

  const peers = (deepData?.peers?.length ? deepData.peers : (data?.peers || [])).map(p => ({
    ...p,
    pe_ratio: p.pe_ratio ?? p.pe ?? null,
    roce: p.roce ?? null,
  }));

  const cagr = deepData?.ratios_cagr || {};
  const piotroski = deepData?.piotroski_f_score || { score: null, rating: 'INSUFFICIENT DATA', summary: 'Piotroski Score — insufficient data to evaluate.', criteria: [] };
  const altman = deepData?.altman_z_score || { z_score: null, zone: 'Insufficient Data', description: 'Altman Z-Score not computable — required statements unavailable.' };
  const dcf = deepData?.dcf_valuation || {};
  const ratioTrends = deepData?.ratio_trends || [];
  const corpCal = deepData?.corporate_calendar || {};

  // Extract sparkline arrays
  const roceSpark = ratioTrends.map(r => r.roce);
  const roeSpark = ratioTrends.map(r => r.roe);
  const deSpark = ratioTrends.map(r => r.debt_to_equity);

  // Merged top ratio values
  const peVal = data?.pe_ratio ?? deepData?.pe_ratio;
  const pbVal = data?.pb_ratio ?? deepData?.pb_ratio;
  const roceVal = data?.roce ?? deepData?.roce ?? (ratioTrends.length ? ratioTrends[ratioTrends.length - 1]?.roce : null);
  const roeVal = data?.roe ?? deepData?.roe ?? (ratioTrends.length ? ratioTrends[ratioTrends.length - 1]?.roe : null);
  const deVal = data?.debt_to_equity ?? deepData?.debt_to_equity ?? (ratioTrends.length ? ratioTrends[ratioTrends.length - 1]?.debt_to_equity : null);
  const promoterVal = data?.promoter_holding ?? deepData?.promoter_holding ?? (shareholding.length ? shareholding[shareholding.length - 1]?.promoter : null);
  // Prefer the numeric market-cap (₹ Cr) field; fall back to the legacy display string.
  const mcapVal = data?.market_cap_cr ?? deepData?.market_cap_cr ?? data?.market_cap ?? deepData?.market_cap;
  const divYieldVal = data?.dividend_yield ?? deepData?.dividend_yield ?? corpCal?.dividend_yield_pct;

  // ── DUPONT 3-STAGE DECOMPOSITION CALCULATIONS ──
  const dupontData = useMemo(() => {
    if (!annualPl.length || !balanceSheet.length) return null;
    const latestPl = annualPl[annualPl.length - 1];
    const latestBs = balanceSheet[balanceSheet.length - 1];

    const sales = Number(latestPl.Sales);
    const netProfit = Number(latestPl['Net Profit']);
    const totalAssets = Number(latestBs['Total Assets']);
    const equity = Number(latestBs['Equity Capital'] || 0) + Number(latestBs['Reserves'] || 0);

    if (!sales || isNaN(sales) || !totalAssets || isNaN(totalAssets) || !equity || isNaN(equity) || isNaN(netProfit)) {
      return null;
    }

    const netMargin = (netProfit / sales) * 100;
    const assetTurnover = sales / totalAssets;
    const equityMultiplier = totalAssets / equity;
    const calculatedRoe = (netMargin / 100) * assetTurnover * equityMultiplier * 100;

    return {
      netMargin: Number(netMargin.toFixed(2)),
      assetTurnover: Number(assetTurnover.toFixed(2)),
      equityMultiplier: Number(equityMultiplier.toFixed(2)),
      calculatedRoe: Number(calculatedRoe.toFixed(2)),
      sales, netProfit, totalAssets, equity
    };
  }, [annualPl, balanceSheet]);

  // ── DYNAMIC LIVE DCF VALUATION SANDBOX ──
  // Zero-fake-data rule: no ₹1000 CMP anchor. Missing CMP → margin-of-safety
  // and CMP-relative coloring render "—", while the EPS-anchored fair value
  // from the sandbox sliders still displays. Missing EPS → no honest fair
  // value either (fair value "—", sliders still interactive).
  const liveDcf = useMemo(() => {
    const cmpRaw = data?.current_price ?? deepData?.current_price ?? (peers.find(p => p.name?.includes(ticker))?.price) ?? null;
    const cmp = cmpRaw != null && !isNaN(Number(cmpRaw)) && Number(cmpRaw) > 0 ? Number(cmpRaw) : null;
    const epsRaw = deepData?.eps ?? data?.eps ?? (annualPl.length ? annualPl[annualPl.length - 1]?.['EPS in Rs'] : null);
    const eps = epsRaw != null && !isNaN(Number(epsRaw)) ? Number(epsRaw) : null;
    const bvps = deepData?.book_value != null && !isNaN(Number(deepData.book_value)) ? Number(deepData.book_value) : null;

    const baseFcf = eps != null && eps > 0 ? Math.max(1.0, eps * 0.85) : null;
    const g = dcfGrowthRate / 100.0;
    const w = Math.max(0.06, dcfWacc / 100.0);
    const tg = Math.min(w - 0.01, dcfTerminalGrowth / 100.0);

    let pvSum = 0;
    let fcfT = baseFcf;
    const projected = [];

    if (baseFcf != null) {
      for (let yr = 1; yr <= 5; yr++) {
        fcfT *= (1.0 + g);
        const df = 1.0 / Math.pow(1.0 + w, yr);
        const pv = fcfT * df;
        pvSum += pv;
        projected.push({
          year: `FY+${yr}`,
          fcf: Number(fcfT.toFixed(2)),
          pv: Number(pv.toFixed(2)),
          discountFactor: Number(df.toFixed(3))
        });
      }
    }

    const terminalVal = baseFcf != null ? (fcfT * (1.0 + tg)) / Math.max(0.01, (w - tg)) : 0;
    const pvTerminal = baseFcf != null ? terminalVal / Math.pow(1.0 + w, 5) : 0;
    const fairValue = baseFcf != null ? Number((pvSum + pvTerminal).toFixed(2)) : null;

    const marginOfSafetyPct = (cmp != null && fairValue != null && fairValue !== 0)
      ? Number((((fairValue - cmp) / cmp) * 100).toFixed(1))
      : null;
    const grahamNumber = (eps != null && bvps != null && eps > 0 && bvps > 0)
      ? Number(Math.sqrt(22.5 * eps * bvps).toFixed(2))
      : null;
    const peterLynchValue = (eps != null && eps > 0)
      ? Number((eps * Math.min(30, Math.max(5, dcfGrowthRate))).toFixed(2))
      : null;

    // Sensitivity Grid: WACC (9% to 14%) vs Terminal Growth (3.5% to 5.5%)
    const waccSteps = [9.0, 10.0, 11.0, 12.0, 13.0, 14.0];
    const tgSteps = [3.5, 4.0, 4.5, 5.0, 5.5];

    const sensitivityMatrix = waccSteps.map(wStep => {
      const row = { wacc: wStep };
      tgSteps.forEach(tgStep => {
        const wFrac = wStep / 100.0;
        const tgFrac = tgStep / 100.0;
        if (wFrac <= tgFrac || baseFcf == null) {
          row[`tg_${tgStep}`] = null;
          return;
        }
        let pSum = 0;
        let cF = baseFcf;
        for (let y = 1; y <= 5; y++) {
          cF *= (1.0 + g);
          pSum += cF / Math.pow(1.0 + wFrac, y);
        }
        const tVal = (cF * (1.0 + tgFrac)) / (wFrac - tgFrac);
        const pvT = tVal / Math.pow(1.0 + wFrac, 5);
        const val = Number((pSum + pvT).toFixed(0));
        row[`tg_${tgStep}`] = val;
      });
      return row;
    });

    return {
      fairValue,
      cmp,
      marginOfSafetyPct,
      grahamNumber,
      peterLynchValue,
      projected,
      pvSum: Number(pvSum.toFixed(2)),
      pvTerminal: Number(pvTerminal.toFixed(2)),
      sensitivityMatrix,
      waccSteps,
      tgSteps
    };
  }, [dcfGrowthRate, dcfWacc, dcfTerminalGrowth, data, deepData, peers, annualPl, ticker]);

  // Ownership Net QoQ Delta
  const ownershipDelta = useMemo(() => {
    if (shareholding.length < 2) return null;
    const latest = shareholding[shareholding.length - 1];
    const prev = shareholding[shareholding.length - 2];
    const dProm = latest.promoter != null && prev.promoter != null ? Number((latest.promoter - prev.promoter).toFixed(2)) : null;
    const dFii = latest.fii != null && prev.fii != null ? Number((latest.fii - prev.fii).toFixed(2)) : null;
    const dDii = latest.dii != null && prev.dii != null ? Number((latest.dii - prev.dii).toFixed(2)) : null;
    const dPub = latest.public != null && prev.public != null ? Number((latest.public - prev.public).toFixed(2)) : null;

    let sentiment = 'Neutral Ownership Shift';
    if ((dFii || 0) + (dDii || 0) > 0.5) sentiment = 'Institutional Accumulation (Smart Money Inflow)';
    else if ((dFii || 0) + (dDii || 0) < -0.5) sentiment = 'Institutional Distribution (Smart Money Outflow)';
    else if ((dProm || 0) > 0.3) sentiment = 'Promoter Stake Increase (Bullish Insider Signal)';

    return { dProm, dFii, dDii, dPub, sentiment, latestPeriod: latest.quarter };
  }, [shareholding]);

  return {
    enrichedQuarters,
    displayedQuarters,
    summaryStats,
    sortedTableData,
    annualPl,
    balanceSheet,
    cashFlow,
    shareholding,
    peers,
    cagr,
    piotroski,
    altman,
    corpCal,
    roceSpark,
    roeSpark,
    deSpark,
    peVal,
    pbVal,
    roceVal,
    roeVal,
    deVal,
    promoterVal,
    mcapVal,
    divYieldVal,
    dupontData,
    liveDcf,
    ownershipDelta,
  };
}
