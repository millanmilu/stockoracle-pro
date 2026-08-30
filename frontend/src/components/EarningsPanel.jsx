import React, { useEffect, useState, useMemo } from "react";
import useStore from "../store/useStore";
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell, ReferenceLine
} from "recharts";
import api from "../utils/api";
import {
  BarChart2, TrendingUp, TrendingDown, RefreshCw, Layers, Calendar, Table,
  DollarSign, Activity, Download, ArrowUpRight, ArrowDownRight, Award,
  Sparkles, Info, ShieldCheck, CheckCircle2, ChevronUp, ChevronDown
} from "lucide-react";
import toast from "react-hot-toast";

const cardStyle = {
  background: "rgba(15, 23, 42, 0.85)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 12,
  padding: "16px 18px",
};

const labelStyle = {
  fontSize: "0.62rem",
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: 4,
  fontWeight: 700
};

const valueStyle = {
  fontSize: "1.02rem",
  fontWeight: 800,
  fontFamily: "JetBrains Mono, monospace",
  color: "#F8FAFC"
};

function GrowthPill({ value, suffix = "%" }) {
  if (value == null || isNaN(value)) return <span style={{ color: "#64748B" }}>—</span>;
  const isPos = value >= 0;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: "2px 6px",
      borderRadius: 4,
      fontSize: "0.66rem",
      fontWeight: 700,
      fontFamily: "JetBrains Mono, monospace",
      background: isPos ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 83, 80, 0.12)",
      color: isPos ? "#10B981" : "#EF5350",
      border: `1px solid ${isPos ? "rgba(16, 185, 129, 0.25)" : "rgba(239, 83, 80, 0.25)"}`
    }}>
      {isPos ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
      {isPos ? "+" : ""}{Number(value).toFixed(1)}{suffix}
    </span>
  );
}

export default function EarningsPanel({ ticker: propTicker }) {
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const ticker = (propTicker || selectedSymbol || "RELIANCE").toUpperCase();

  const [fundData, setFundData] = useState(null);
  const [deepData, setDeepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sorting state for table
  const [sortField, setSortField] = useState("idx");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [res1, res2] = await Promise.allSettled([
        api.get(`/api/stock/${ticker}/fundamentals`),
        api.get(`/api/stock/${ticker}/financials`)
      ]);
      if (res1.status === "fulfilled") setFundData(res1.value.data);
      if (res2.status === "fulfilled") setDeepData(res2.value.data);

      if (res1.status !== "fulfilled" && res2.status !== "fulfilled") {
        setError("Earnings data temporarily unavailable.");
      }
    } catch (err) {
      setError("Earnings data temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [ticker]);

  // Combine and normalize quarterly dataset in chronological order (oldest to newest)
  const enrichedQuarters = useMemo(() => {
    const rawQuarters =
      (deepData?.quarterly_results?.length ? deepData.quarterly_results : null) ||
      (fundData?.quarterly_results?.length ? fundData.quarterly_results : []);

    if (!rawQuarters || rawQuarters.length === 0) return [];

    // Normalize raw entries
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

    // Calculate QoQ, YoY, and linear trendlines
    const n = chronological.length;

    // Linear regression for EPS trendline
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, validEpsCount = 0;
    chronological.forEach((q, i) => {
      if (q.eps != null && !isNaN(q.eps)) {
        sumX += i;
        sumY += q.eps;
        sumXY += i * q.eps;
        sumXX += i * i;
        validEpsCount++;
      }
    });

    const slope = validEpsCount > 1 ? (validEpsCount * sumXY - sumX * sumY) / (validEpsCount * sumXX - sumX * sumX) : 0;
    const intercept = validEpsCount > 1 ? (sumY - slope * sumX) / validEpsCount : (chronological[0]?.eps || 0);

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
  }, [fundData, deepData]);

  // Compute Summary Aggregate Metrics
  const summaryStats = useMemo(() => {
    if (!enrichedQuarters || enrichedQuarters.length === 0) return null;

    const validRevQoQ = enrichedQuarters.map(q => q.revQoQ).filter(v => v != null);
    const validProfitQoQ = enrichedQuarters.map(q => q.profitQoQ).filter(v => v != null);
    const validEpsQoQ = enrichedQuarters.map(q => q.epsQoQ).filter(v => v != null);

    const avgRevQoQ = validRevQoQ.length ? (validRevQoQ.reduce((a, b) => a + b, 0) / validRevQoQ.length) : null;
    const avgProfitQoQ = validProfitQoQ.length ? (validProfitQoQ.reduce((a, b) => a + b, 0) / validProfitQoQ.length) : null;
    const avgEpsQoQ = validEpsQoQ.length ? (validEpsQoQ.reduce((a, b) => a + b, 0) / validEpsQoQ.length) : null;

    const latest = enrichedQuarters[enrichedQuarters.length - 1];
    const prev = enrichedQuarters.length >= 2 ? enrichedQuarters[enrichedQuarters.length - 2] : null;

    // Trend verdict
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
  }, [enrichedQuarters]);

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!enrichedQuarters || enrichedQuarters.length === 0) {
      toast.error("No quarterly earnings records to export.");
      return;
    }
    const headers = ["Period", "Revenue (Cr)", "Rev QoQ %", "Rev YoY %", "Net Profit (Cr)", "Profit QoQ %", "Profit YoY %", "EPS (Rs)", "EPS YoY %"];
    const rows = enrichedQuarters.map(q => [
      q.period,
      q.revenue ?? "",
      q.revQoQ ?? "",
      q.revYoY ?? "",
      q.net_profit ?? "",
      q.profitQoQ ?? "",
      q.profitYoY ?? "",
      q.eps ?? "",
      q.epsYoY ?? ""
    ].map(v => `"${v}"`).join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ticker}_Quarterly_Earnings_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${ticker} Quarterly Earnings exported to CSV!`);
  };

  // Table Sorting logic
  const sortedTableData = useMemo(() => {
    const dataCopy = [...enrichedQuarters];
    dataCopy.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return dataCopy;
  }, [enrichedQuarters, sortField, sortAsc]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false); // default to descending on new field
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <RefreshCw size={18} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ color: "#818CF8", fontSize: "0.86rem", fontWeight: 700 }}>Analyzing Quarterly Results, QoQ Deltas & EPS Trends…</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ ...cardStyle, height: 75, background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
        <div style={{ ...cardStyle, height: 260, background: "rgba(255,255,255,0.02)" }} />
      </div>
    );
  }

  if (error || !fundData && !deepData) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#94A3B8" }}>
        <BarChart2 size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
        <div style={{ marginBottom: 14, fontSize: "0.86rem" }}>{error || "No quarterly earnings disclosures found for this ticker."}</div>
        <button onClick={fetchData} style={{ padding: "8px 18px", borderRadius: 8, background: "rgba(99,102,241,0.18)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.35)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 700 }}>
          <RefreshCw size={13} style={{ marginRight: 6 }} />Retry Analysis
        </button>
      </div>
    );
  }

  const latestQ = summaryStats?.latest;

  return (
    <div style={{ padding: "clamp(12px, 2vw, 22px)", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1300, margin: "0 auto", color: "#F8FAFC", fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif" }}>

      {/* ── 1. HEADER SECTION COCKPIT ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
        background: "linear-gradient(180deg, rgba(17,24,39,0.98), rgba(15,23,42,0.92))",
        border: "1px solid rgba(99,102,241,0.25)", borderRadius: 12, padding: "12px 18px",
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.2))", border: "1px solid rgba(99,102,241,0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818CF8" }}>
            <BarChart2 size={20} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "1.15rem", fontWeight: 800, color: "#F8FAFC", letterSpacing: "-0.02em" }}>
                {deepData?.name || ticker} — Quarterly Earnings
              </span>
              <span style={{ fontSize: "0.68rem", background: "rgba(99,102,241,0.20)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.4)", padding: "2px 8px", borderRadius: 5, fontWeight: 800 }}>
                NSE: {ticker}
              </span>
              {latestQ && (
                <span style={{ fontSize: "0.68rem", background: "rgba(16,185,129,0.15)", color: "#10B981", border: "1px solid rgba(16,185,129,0.35)", padding: "2px 8px", borderRadius: 5, fontWeight: 700 }}>
                  Latest: {latestQ.period}
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3, fontSize: "0.66rem", color: "#64748B" }}>
              <span>Source: <strong style={{ color: "#94A3B8" }}>{deepData?.data_freshness?.data_source || fundData?.data_source || "Screener.in Consolidated + NSE Filings"}</strong></span>
              <span>•</span>
              <span>Audited Disclosures: <strong style={{ color: "#94A3B8" }}>{enrichedQuarters.length} Quarters Analyzed</strong></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            onClick={handleExportCSV}
            style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "#CBD5E1", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", fontWeight: 600 }}
          >
            <Download size={13} />Export CSV
          </button>
          <button
            onClick={fetchData}
            style={{ padding: "6px 14px", borderRadius: 6, background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: "0.74rem", fontWeight: 800, boxShadow: "0 2px 8px rgba(99,102,241,0.4)" }}
          >
            <RefreshCw size={13} />Refresh
          </button>
        </div>
      </div>

      {enrichedQuarters.length > 0 ? (
        <>
          {/* ── 2. SUMMARY STATS CARDS ROW ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            {/* Latest Quarter Card */}
            <div style={{ ...cardStyle, background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(15,23,42,0.95))", border: "1px solid rgba(99,102,241,0.3)" }}>
              <div style={labelStyle}>Latest Quarter Performance ({latestQ?.period})</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#F8FAFC", fontFamily: "JetBrains Mono, monospace" }}>
                  ₹{latestQ?.revenue != null ? Number(latestQ.revenue).toLocaleString("en-IN") : "—"} Cr
                </span>
                <GrowthPill value={latestQ?.revQoQ} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "#94A3B8", marginTop: 6, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <span>Net Profit: <strong style={{ color: "#10B981" }}>₹{latestQ?.net_profit != null ? Number(latestQ.net_profit).toLocaleString("en-IN") : "—"} Cr</strong></span>
                <span>EPS: <strong style={{ color: "#F59E0B" }}>₹{latestQ?.eps ?? "—"}</strong></span>
              </div>
            </div>

            {/* Avg Revenue Growth */}
            <div style={cardStyle}>
              <div style={labelStyle}>Avg QoQ Revenue Growth</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ ...valueStyle, color: (summaryStats?.avgRevQoQ || 0) >= 0 ? "#10B981" : "#EF5350" }}>
                  {(summaryStats?.avgRevQoQ || 0) >= 0 ? "+" : ""}{summaryStats?.avgRevQoQ != null ? `${summaryStats.avgRevQoQ.toFixed(1)}%` : "—"}
                </span>
                <GrowthPill value={summaryStats?.avgRevQoQ} />
              </div>
              <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: 6 }}>
                Mean sequential top-line momentum across {enrichedQuarters.length} quarters
              </div>
            </div>

            {/* Avg Profit Growth */}
            <div style={cardStyle}>
              <div style={labelStyle}>Avg QoQ Net Profit Growth</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{ ...valueStyle, color: (summaryStats?.avgProfitQoQ || 0) >= 0 ? "#10B981" : "#EF5350" }}>
                  {(summaryStats?.avgProfitQoQ || 0) >= 0 ? "+" : ""}{summaryStats?.avgProfitQoQ != null ? `${summaryStats.avgProfitQoQ.toFixed(1)}%` : "—"}
                </span>
                <GrowthPill value={summaryStats?.avgProfitQoQ} />
              </div>
              <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: 6 }}>
                Bottom-line profitability compounding rate
              </div>
            </div>

            {/* Revenue Trend Verdict */}
            <div style={{ ...cardStyle, border: `1px solid ${summaryStats?.trendPositive ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}` }}>
              <div style={labelStyle}>Earnings Trajectory & Verdict</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                {summaryStats?.trendPositive ? <TrendingUp size={18} color="#10B981" /> : <TrendingDown size={18} color="#F59E0B" />}
                <span style={{ fontSize: "0.92rem", fontWeight: 800, color: summaryStats?.trendPositive ? "#10B981" : "#F59E0B" }}>
                  {summaryStats?.trendVerdict}
                </span>
              </div>
              <div style={{ fontSize: "0.62rem", color: "#94A3B8", marginTop: 6 }}>
                Assessed from consecutive operating margins & bottom-line trends
              </div>
            </div>
          </div>

          {/* ── 3. REVENUE VS NET PROFIT COMPOSED CHART (Improved visual weight) ── */}
          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 6 }}>
              <div>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#F0F0FF" }}>Quarterly Revenue & Net Profit Trajectory (₹ Cr)</span>
                <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>Dual-axis comparison of gross turnover vs bottom-line net profit</div>
              </div>
              <div style={{ fontSize: "0.68rem", display: "flex", gap: 12 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#6366F1", borderRadius: 2 }} /> Revenue</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: "#10B981", borderRadius: 2 }} /> Net Profit</span>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={enrichedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="revenueBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818CF8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#4F46E5" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="profitAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#94A3B8" }} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#10B981" }} tickLine={false} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.74rem" }}
                  formatter={(val, name) => [`₹${val != null ? Number(val).toLocaleString("en-IN") : "—"} Cr`, name]}
                />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="url(#revenueBarGrad)" radius={[4, 4, 0, 0]} />
                <Area yAxisId="right" type="monotone" dataKey="net_profit" name="Net Profit Area" fill="url(#profitAreaGrad)" stroke="none" />
                <Line yAxisId="right" type="monotone" dataKey="net_profit" name="Net Profit" stroke="#10B981" strokeWidth={2.4} dot={{ r: 4, fill: "#10B981", strokeWidth: 1.5, stroke: "#0F172A" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── 4. TWO-COLUMN: REVENUE & PROFIT QOQ BARS + EPS TREND WITH TRENDLINE ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>

            {/* QoQ Growth % Divergence Bars */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#F0F0FF" }}>Quarter-on-Quarter (QoQ) Growth %</span>
                  <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>Sequential expansion across revenue vs profit</div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={enrichedQuarters} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" />
                  <Tooltip
                    contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.72rem" }}
                    formatter={(val, name) => [`${val != null ? `${val >= 0 ? "+" : ""}${val}%` : "—"}`, name]}
                  />
                  <Bar dataKey="revQoQ" name="Revenue QoQ %" fill="#6366F1" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="profitQoQ" name="Profit QoQ %" radius={[3, 3, 0, 0]}>
                    {enrichedQuarters.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={(entry.profitQoQ || 0) >= 0 ? "#10B981" : "#EF5350"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* EPS Trend with Regression Line */}
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "#F0F0FF" }}>EPS Trajectory & Trendline (₹)</span>
                  <div style={{ fontSize: "0.62rem", color: "#94A3B8" }}>Diluted Earnings Per Share with linear trajectory</div>
                </div>
                {latestQ?.eps != null && (
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "0.96rem", fontWeight: 800, color: "#F59E0B", fontFamily: "JetBrains Mono, monospace" }}>
                      ₹{latestQ.eps}
                    </span>
                    <div style={{ fontSize: "0.58rem", color: "#94A3B8" }}>Latest Diluted EPS</div>
                  </div>
                )}
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={enrichedQuarters} margin={{ top: 10, right: 15, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="period" tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} tickLine={false} tickFormatter={(v) => `₹${v}`} />
                  <Tooltip
                    contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.72rem" }}
                    formatter={(val, name) => [`₹${val != null ? val : "—"}`, name]}
                  />
                  <Line type="monotone" dataKey="eps" name="EPS (₹)" stroke="#F59E0B" strokeWidth={2.2} dot={{ r: 3.5, fill: "#F59E0B" }} />
                  <Line type="linear" dataKey="epsTrend" name="Regression Trendline" stroke="#64748B" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

          </div>

          {/* ── 5. FULL QUARTERLY EARNINGS TABLE ── */}
          <div style={{ ...cardStyle, overflowX: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#F0F0FF" }}>Comprehensive Quarterly Disclosures</span>
                <div style={{ fontSize: "0.64rem", color: "#94A3B8" }}>Detailed breakdown of quarterly sales, net margins, EPS, and YoY comparative deltas</div>
              </div>
              <div style={{ fontSize: "0.64rem", color: "#64748B", fontStyle: "italic" }}>
                * Click column header to sort
              </div>
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem", fontFamily: "JetBrains Mono, monospace" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.10)", color: "#94A3B8", textAlign: "right", fontSize: "0.66rem", textTransform: "uppercase", background: "rgba(255,255,255,0.02)" }}>
                  <th onClick={() => toggleSort("period")} style={{ textAlign: "left", padding: "8px 10px", cursor: "pointer" }}>
                    Period {sortField === "period" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("revenue")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    Revenue (₹ Cr) {sortField === "revenue" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("revQoQ")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    Rev QoQ % {sortField === "revQoQ" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("revYoY")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    Rev YoY % {sortField === "revYoY" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("net_profit")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    Net Profit (₹ Cr) {sortField === "net_profit" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("profitQoQ")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    NP QoQ % {sortField === "profitQoQ" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("eps")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    EPS (₹) {sortField === "eps" && (sortAsc ? "▲" : "▼")}
                  </th>
                  <th onClick={() => toggleSort("epsYoY")} style={{ padding: "8px 10px", cursor: "pointer" }}>
                    EPS YoY % {sortField === "epsYoY" && (sortAsc ? "▲" : "▼")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTableData.map((q, idx) => (
                  <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)", textAlign: "right", color: "#CBD5E1", background: idx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                    <td style={{ textAlign: "left", padding: "8px 10px", fontWeight: 700, color: "#F0F0FF" }}>{q.period}</td>
                    <td style={{ padding: "8px 10px" }}>{q.revenue != null ? Number(q.revenue).toLocaleString("en-IN") : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><GrowthPill value={q.revQoQ} /></td>
                    <td style={{ padding: "8px 10px" }}><GrowthPill value={q.revYoY} /></td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: "#10B981" }}>{q.net_profit != null ? Number(q.net_profit).toLocaleString("en-IN") : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><GrowthPill value={q.profitQoQ} /></td>
                    <td style={{ padding: "8px 10px", color: "#F59E0B", fontWeight: 600 }}>{q.eps != null ? `₹${q.eps}` : "—"}</td>
                    <td style={{ padding: "8px 10px" }}><GrowthPill value={q.epsYoY} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div style={{ ...cardStyle, textAlign: "center", color: "#94A3B8", padding: 48 }}>
          <Layers size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
          <div>No quarterly statements available for {ticker}.</div>
        </div>
      )}

    </div>
  );
}