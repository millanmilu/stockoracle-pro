import React, { useEffect, useState } from "react";
import api from "../utils/api";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Wallet, PlusCircle, Trash2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const SECTOR_COLORS = {
  "Energy": "#F59E0B", "IT": "#6366F1", "Banking": "#0EA5E9", "Telecom": "#8B5CF6",
  "FMCG": "#10B981", "Infrastructure": "#F97316", "Auto": "#EC4899",
  "Pharma": "#14B8A6", "Metals": "#94A3B8", "Consumer": "#A78BFA", "Other": "#6B7280"
};

const cardStyle = { background: "#0C1022", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "18px 20px" };
const fmt = (n) => typeof n === "number" ? `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "₹—";
const fmtPct = (n) => typeof n === "number" ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—";

export default function PortfolioView() {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ticker: "", shares: "", buy_price: "" });
  const [formError, setFormError] = useState("");
  const [adding, setAdding] = useState(false);

  const fetchPortfolio = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/portfolio");
      setPositions(data);
    } catch {
      toast.error("Failed to load portfolio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPortfolio(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const ticker = form.ticker.trim().toUpperCase();
    const shares = parseFloat(form.shares);
    const buy_price = parseFloat(form.buy_price);
    if (!ticker || isNaN(shares) || shares <= 0 || isNaN(buy_price) || buy_price <= 0) {
      setFormError("Please enter a valid ticker, shares (>0), and buy price (>0).");
      return;
    }
    setFormError("");
    setAdding(true);
    try {
      await api.post("/api/portfolio", { ticker, shares, buy_price });
      toast.success(`${ticker} added to portfolio!`);
      setForm({ ticker: "", shares: "", buy_price: "" });
      fetchPortfolio();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to add position.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, ticker) => {
    try {
      await api.delete(`/api/portfolio/${id}`);
      toast.success(`${ticker} removed.`);
      setPositions((p) => p.filter((pos) => pos.id !== id));
    } catch {
      toast.error("Failed to remove position.");
    }
  };

  // Summary calculations
  const totalInvested = positions.reduce((s, p) => s + p.buy_price * p.shares, 0);
  const totalCurrent = positions.reduce((s, p) => s + p.current_price * p.shares, 0);
  const totalPnl = totalCurrent - totalInvested;
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  // Sector allocation for pie chart
  const sectorMap = {};
  positions.forEach((p) => {
    const sec = p.sector || "Other";
    if (!sectorMap[sec]) sectorMap[sec] = 0;
    sectorMap[sec] += p.current_price * p.shares;
  });
  const pieData = Object.entries(sectorMap).map(([name, value]) => ({ name, value: Math.round(value) }));

  return (
    <div style={{ padding: "clamp(14px, 3vw, 24px)", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: "clamp(1.2rem, 4vw, 1.6rem)", fontWeight: 800, color: "#F0F0FF", display: "flex", alignItems: "center", gap: 10 }}>
          <Wallet size={22} color="#818CF8" />My Portfolio
        </h1>
        <button onClick={fetchPortfolio} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(99,102,241,0.1)", color: "#818CF8", border: "1px solid rgba(99,102,241,0.2)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: "0.78rem" }}>
          <RefreshCw size={12} />Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {positions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {[
            { label: "Total Invested", value: fmt(totalInvested), color: "#9CA3AF" },
            { label: "Current Value", value: fmt(totalCurrent), color: "#F0F0FF" },
            { label: "Total P&L", value: fmt(totalPnl), color: totalPnl >= 0 ? "#10B981" : "#EF5350" },
            { label: "Total Return", value: fmtPct(totalPnlPct), color: totalPnlPct >= 0 ? "#10B981" : "#EF5350" },
          ].map(({ label, value, color }) => (
            <div key={label} style={cardStyle}>
              <div style={{ fontSize: "0.68rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color, fontFamily: "JetBrains Mono, monospace" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: positions.length > 0 && pieData.length > 0 ? "repeat(auto-fit, minmax(320px, 1fr))" : "1fr", gap: 16 }}>
        {/* Main column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Add Position Form */}
          <div style={cardStyle}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#F0F0FF", marginBottom: 14 }}>Add Position</div>
            <form onSubmit={handleAdd} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              {[
                { key: "ticker", placeholder: "RELIANCE", label: "Ticker", width: 120 },
                { key: "shares", placeholder: "10", label: "Shares", type: "number", width: 100 },
                { key: "buy_price", placeholder: "2800.00", label: "Buy Price (₹)", type: "number", width: 130 },
              ].map(({ key, placeholder, label, type = "text", width }) => (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: width }}>
                  <label style={{ fontSize: "0.7rem", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
                  <input
                    type={type} placeholder={placeholder} value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(99,102,241,0.25)", background: "rgba(255,255,255,0.04)", color: "#F0F0FF", fontSize: "0.85rem" }}
                  />
                </div>
              ))}
              <button type="submit" disabled={adding} style={{ padding: "8px 16px", borderRadius: 8, background: "#6366F1", color: "#fff", border: "none", cursor: "pointer", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", alignSelf: "flex-end" }}>
                <PlusCircle size={15} />{adding ? "Adding…" : "Add"}
              </button>
            </form>
            {formError && <p style={{ color: "#EF5350", fontSize: "0.8rem", marginTop: 8 }}>{formError}</p>}
          </div>

          {/* Holdings Table */}
          {loading ? (
            <div style={{ textAlign: "center", color: "#6B7280", padding: 40 }}>Loading portfolio…</div>
          ) : positions.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", color: "#6B7280", padding: 48 }}>
              <Wallet size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
              <div>No positions yet. Add your first holding above.</div>
            </div>
          ) : (
            <div style={{ ...cardStyle, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    {["Ticker", "Sector", "Shares", "Buy Price", "Current", "P&L (₹)", "P&L (%)", ""].map(h => (
                      <th key={h} style={{ padding: "8px 10px", color: "#6B7280", fontWeight: 600, fontSize: "0.68rem", textTransform: "uppercase", textAlign: h === "Ticker" || h === "Sector" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "10px", fontWeight: 700, color: "#818CF8" }}>{pos.ticker}</td>
                      <td style={{ padding: "10px", color: "#9CA3AF" }}>
                        <span style={{ padding: "2px 7px", borderRadius: 10, background: `${SECTOR_COLORS[pos.sector] || "#6B7280"}22`, color: SECTOR_COLORS[pos.sector] || "#6B7280", fontSize: "0.7rem", fontWeight: 600 }}>
                          {pos.sector}
                        </span>
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", color: "#F0F0FF", fontFamily: "JetBrains Mono, monospace" }}>{pos.shares}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "#9CA3AF", fontFamily: "JetBrains Mono, monospace" }}>{fmt(pos.buy_price)}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: "#F0F0FF", fontFamily: "JetBrains Mono, monospace" }}>{fmt(pos.current_price)}</td>
                      <td style={{ padding: "10px", textAlign: "right", color: pos.pnl >= 0 ? "#10B981" : "#EF5350", fontFamily: "JetBrains Mono, monospace", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                        {pos.pnl >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{fmt(pos.pnl)}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", color: pos.pnl_pct >= 0 ? "#10B981" : "#EF5350", fontFamily: "JetBrains Mono, monospace" }}>{fmtPct(pos.pnl_pct)}</td>
                      <td style={{ padding: "10px", textAlign: "right" }}>
                        <button onClick={() => handleDelete(pos.id, pos.ticker)} style={{ background: "none", border: "none", cursor: "pointer", color: "#EF5350", opacity: 0.7, padding: 4 }} title="Remove">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sector Pie */}
        {positions.length > 0 && pieData.length > 0 && (
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Sector Allocation</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={3}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={SECTOR_COLORS[entry.name] || "#6B7280"} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`₹${v.toLocaleString("en-IN")}`, ""]} contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.78rem" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%", marginTop: 8 }}>
              {pieData.map((entry) => {
                const pct = totalCurrent > 0 ? (entry.value / totalCurrent * 100).toFixed(1) : 0;
                return (
                  <div key={entry.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.72rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: SECTOR_COLORS[entry.name] || "#6B7280" }} />
                      <span style={{ color: "#9CA3AF" }}>{entry.name}</span>
                    </div>
                    <span style={{ color: "#F0F0FF", fontFamily: "JetBrains Mono, monospace" }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}