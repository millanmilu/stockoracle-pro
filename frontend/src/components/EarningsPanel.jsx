import React, { useEffect, useState } from "react";
import useStore from "../store/useStore";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Legend } from "recharts";
import api from "../utils/api";
import { BarChart2 } from "lucide-react";

const cardStyle = { background: "#0C1022", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 12, padding: "18px 20px" };

export default function EarningsPanel({ ticker: propTicker }) {
  const { selectedSymbol } = useStore();
  const ticker = propTicker || selectedSymbol;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/stock/${ticker}/fundamentals`)
      .then(({ data: res }) => setData(res))
      .catch(() => setError("Earnings data unavailable."))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Loading earnings data…</div>;
  if (error || !data) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>{error}</div>;

  const quarterly = (data.quarterly_results || []).slice().reverse();

  return (
    <div style={{ padding: "clamp(14px, 3vw, 24px)", display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: "clamp(1.2rem, 4vw, 1.5rem)", fontWeight: 800, color: "#F0F0FF", display: "flex", alignItems: "center", gap: 10 }}>
        <BarChart2 size={22} color="#818CF8" />Earnings — {ticker}
      </h1>

      {quarterly.length > 0 ? (
        <>
          {/* Revenue vs Net Profit combo chart */}
          <div style={cardStyle}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              Revenue vs Net Profit (₹ Cr)
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={quarterly} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#9CA3AF" }} width={48} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#9CA3AF" }} width={48} />
                <Tooltip
                  contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.78rem" }}
                  formatter={(val, name) => [val != null ? val.toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—", name]}
                />
                <Legend wrapperStyle={{ fontSize: "0.72rem", color: "#9CA3AF" }} />
                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="rgba(99,102,241,0.6)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="net_profit" name="Net Profit" stroke="#10B981" strokeWidth={2} dot={{ r: 4, fill: "#10B981" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* EPS trend */}
          <div style={cardStyle}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
              EPS Trend (₹)
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={quarterly} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9CA3AF" }} />
                <YAxis tick={{ fontSize: 10, fill: "#9CA3AF" }} width={40} />
                <Tooltip contentStyle={{ background: "#0F172A", border: "1px solid rgba(99,102,241,0.3)", borderRadius: 8, color: "#F0F0FF", fontSize: "0.78rem" }} />
                <Line type="monotone" dataKey="eps" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4, fill: "#F59E0B" }} name="EPS (₹)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div style={{ ...cardStyle, textAlign: "center", color: "#6B7280", padding: 48 }}>
          No quarterly data available for {ticker}.
        </div>
      )}
    </div>
  );
}