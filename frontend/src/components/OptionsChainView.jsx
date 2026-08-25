import React, { useEffect, useState, useCallback } from "react";
import useStore from "../store/useStore";
import api from "../utils/api";
import { Layers, RefreshCw, AlertTriangle } from "lucide-react";

function GaugeLabel({ value, label }) {
  let color = "#F59E0B";
  if (value > 1.2) color = "#10B981";
  if (value < 0.8) color = "#EF5350";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ fontSize: "0.65rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color, fontFamily: "JetBrains Mono, monospace" }}>{value?.toFixed(2) ?? "—"}</div>
      <div style={{ fontSize: "0.68rem", color }}>
        {value > 1.2 ? "Bullish" : value < 0.8 ? "Bearish" : "Neutral"}
      </div>
    </div>
  );
}

export default function OptionsChainView({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
  const ticker = propTicker || selectedSymbol;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedExpiry, setSelectedExpiry] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async (expiry) => {
    setLoading(true);
    setError(null);
    try {
      const params = expiry ? `?expiry=${encodeURIComponent(expiry)}` : "";
      const { data: res } = await api.get(`/api/stock/${ticker}/options-chain${params}`);
      if (res.error && !res.chain?.length) {
        setError(res.error);
      } else {
        setData(res);
        setSelectedExpiry(res.selected_expiry);
      }
    } catch (err) {
      setError("Options data unavailable. NSE may be closed or rate-limited.");
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [ticker]);

  useEffect(() => {
    fetchData(null);
    const interval = setInterval(() => fetchData(selectedExpiry), 60000);
    return () => clearInterval(interval);
  }, [ticker]);

  const handleExpiryChange = (e) => {
    const exp = e.target.value;
    setSelectedExpiry(exp);
    fetchData(exp);
  };

  const chain = data?.chain || [];
  const underlying = data?.underlying_value;
  const maxOI = Math.max(...chain.map(c => Math.max(c.call_oi, c.put_oi)), 1);

  // ATM = closest strike to underlying
  const atmStrike = chain.length && underlying
    ? chain.reduce((prev, curr) =>
        Math.abs(curr.strike_price - underlying) < Math.abs(prev.strike_price - underlying) ? curr : prev
      ).strike_price
    : null;

  const fmt = (n, dec = 0) => n != null ? n.toLocaleString("en-IN", { maximumFractionDigits: dec }) : "—";

  return (
    <div style={{ padding: "clamp(12px, 2.5vw, 24px)", display: "flex", flexDirection: "column", gap: 16, maxWidth: 1300, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontWeight: 800, color: "#F0F0FF", display: "flex", alignItems: "center", gap: 10 }}>
          <Layers size={22} color="#818CF8" />Options Chain — {ticker}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {data?.expiry_dates?.length > 0 && (
            <select
              value={selectedExpiry || ""}
              onChange={handleExpiryChange}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.3)", background: "#0C1022", color: "#F0F0FF", fontSize: "0.82rem" }}
            >
              {data.expiry_dates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button onClick={() => fetchData(selectedExpiry)} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}>
            <RefreshCw size={12} />Refresh
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      {data && (
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <div style={{ background: "#0C1022", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "14px 24px", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: "0.68rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Underlying</div>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#F0F0FF", fontFamily: "JetBrains Mono, monospace" }}>₹{fmt(underlying, 2)}</div>
          </div>
          <div style={{ background: "#0C1022", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "14px 24px" }}>
            <GaugeLabel value={data.pcr} label="PCR (Put/Call Ratio)" />
          </div>
          {data.max_pain != null && (
            <div style={{ background: "#0C1022", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "14px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: "0.68rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>Max Pain</div>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#F59E0B", fontFamily: "JetBrains Mono, monospace" }}>₹{fmt(data.max_pain, 0)}</div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.25)", borderRadius: 10, color: "#EF5350" }}>
          <AlertTriangle size={16} />
          <span style={{ fontSize: "0.85rem" }}>{error}</span>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", color: "#6B7280", padding: 40 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid #6366F1", borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          Loading options chain…
        </div>
      )}

      {/* Options Chain Table */}
      {!loading && chain.length > 0 && (
        <div style={{ background: "#0C1022", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.08)" }}>
                <th colSpan={5} style={{ padding: "10px 12px", color: "#10B981", fontWeight: 700, textAlign: "center", borderRight: "2px solid rgba(255,255,255,0.08)", background: "rgba(16,185,129,0.05)" }}>CALLS</th>
                <th style={{ padding: "10px 12px", color: "#F59E0B", fontWeight: 800, textAlign: "center", fontSize: "0.82rem", background: "rgba(245,158,11,0.06)", minWidth: 90 }}>STRIKE</th>
                <th colSpan={5} style={{ padding: "10px 12px", color: "#EF5350", fontWeight: 700, textAlign: "center", borderLeft: "2px solid rgba(255,255,255,0.08)", background: "rgba(239,83,80,0.05)" }}>PUTS</th>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["OI", "OI Chg", "Vol", "IV", "LTP"].map(h => (
                  <th key={`c-${h}`} style={{ padding: "7px 10px", color: "#6B7280", textAlign: "right", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", background: "rgba(16,185,129,0.04)" }}>{h}</th>
                ))}
                <th style={{ padding: "7px 10px", color: "#F59E0B", textAlign: "center", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", background: "rgba(245,158,11,0.05)" }}></th>
                {["LTP", "IV", "Vol", "OI Chg", "OI"].map(h => (
                  <th key={`p-${h}`} style={{ padding: "7px 10px", color: "#6B7280", textAlign: "right", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", background: "rgba(239,83,80,0.04)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chain.map((row, i) => {
                const isATM = row.strike_price === atmStrike;
                const rowBg = isATM ? "rgba(245,158,11,0.06)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)";
                const callOIPct = (row.call_oi / maxOI) * 100;
                const putOIPct = (row.put_oi / maxOI) * 100;
                const oiChgColor = (chg) => chg > 0 ? "#10B981" : chg < 0 ? "#EF5350" : "#6B7280";
                return (
                  <tr key={i} style={{ background: rowBg, borderBottom: "1px solid rgba(255,255,255,0.03)", borderLeft: isATM ? "3px solid #F59E0B" : "3px solid transparent" }}>
                    {/* Call columns */}
                    <td style={{ padding: "6px 10px", textAlign: "right", position: "relative" }}>
                      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${callOIPct}%`, background: "rgba(16,185,129,0.08)", maxWidth: "100%" }} />
                      <span style={{ position: "relative", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>{fmt(row.call_oi)}</span>
                    </td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: oiChgColor(row.call_oi_change), fontFamily: "JetBrains Mono, monospace" }}>{row.call_oi_change > 0 ? "+" : ""}{fmt(row.call_oi_change)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>{fmt(row.call_volume)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#6B7280" }}>{row.call_iv ? `${row.call_iv.toFixed(1)}%` : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#10B981", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>₹{fmt(row.call_ltp, 2)}</td>
                    {/* Strike */}
                    <td style={{ padding: "6px 12px", textAlign: "center", fontWeight: 800, fontFamily: "JetBrains Mono, monospace", color: isATM ? "#F59E0B" : "#F0F0FF", borderLeft: "2px solid rgba(255,255,255,0.06)", borderRight: "2px solid rgba(255,255,255,0.06)", background: isATM ? "rgba(245,158,11,0.06)" : "transparent" }}>
                      {fmt(row.strike_price)}
                      {isATM && <div style={{ fontSize: "0.55rem", color: "#F59E0B", fontWeight: 600 }}>ATM</div>}
                    </td>
                    {/* Put columns */}
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#EF5350", fontFamily: "JetBrains Mono, monospace", fontWeight: 600 }}>₹{fmt(row.put_ltp, 2)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#6B7280" }}>{row.put_iv ? `${row.put_iv.toFixed(1)}%` : "—"}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>{fmt(row.put_volume)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", color: oiChgColor(row.put_oi_change), fontFamily: "JetBrains Mono, monospace" }}>{row.put_oi_change > 0 ? "+" : ""}{fmt(row.put_oi_change)}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${putOIPct}%`, background: "rgba(239,83,80,0.08)", maxWidth: "100%" }} />
                      <span style={{ position: "relative", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>{fmt(row.put_oi)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {lastRefresh && (
        <div style={{ fontSize: "0.7rem", color: "#4B5563", textAlign: "right" }}>
          Last refreshed: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 60s
        </div>
      )}
    </div>
  );
}