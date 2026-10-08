import React from 'react';
import { BookOpen } from 'lucide-react';

export function GuideTab() {
  return (
            <div style={{
              background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(99,102,241,0.25)',
              borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={18} color="#818CF8" />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Backtest Studio — Step-by-Step User Guide (गाइड)
                </h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#818CF8', fontSize: '0.82rem', marginBottom: 6 }}>
                    1. Ticker & Strategy Chunna (Selection)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    Top bar me instant chips (`RELIANCE`, `TCS`, `INFY`, `ICICIBANK`, `BTC`) ya search box se koi bhi stock chunein. Fir Strategy dropdown se apni strategy select karein (jaise EMA Golden Cross ya Supertrend).
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#38BDF8', fontSize: '0.82rem', marginBottom: 6 }}>
                    2. One-Click Presets Use Karein
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    Bina manually settings badle, <strong>Conservative</strong>, <strong>Momentum Trend</strong>, <strong>Quant AI</strong>, ya <strong>Swing Cross</strong> presets par click karein. Ye automatically optimal Stop Loss, Take Profit aur periods set kar dete hain.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#10B981', fontSize: '0.82rem', marginBottom: 6 }}>
                    3. Key Metrics Kaise Samjhein?
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    • <strong>Alpha</strong>: Buy & Hold benchmark se kitna zyada return diya.<br />
                    • <strong>Sharpe & Sortino</strong>: &gt; 1.0 matlab excellent risk-adjusted performance.<br />
                    • <strong>Profit Factor</strong>: &gt; 1.5 matlab strategy profitable aur consistent hai.<br />
                    • <strong>Expectancy</strong>: Har trade par mathematically average expected gain.
                  </div>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.25)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 800, color: '#C084FC', fontSize: '0.82rem', marginBottom: 6 }}>
                    4. Heatmap & Journal Export
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', lineHeight: 1.6 }}>
                    <strong>Monthly Heatmap</strong> tab me saal-dar-saal mahine ka return grid dekhein. <strong>Trade Journal</strong> se individual buy/sell price, holding period aur exit reason filter karke CSV download karein.
                  </div>
                </div>
              </div>
            </div>

  );
}

export function GuideModal({ setShowGuideModal }) {
  return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#0F172A', border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 16, maxWidth: 700, width: '100%', maxHeight: '85vh',
            overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BookOpen size={20} color="#818CF8" />
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                  Backtest Studio — Complete Practical Guide
                </h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 6,
                  color: '#94A3B8', padding: '4px 10px', cursor: 'pointer', fontWeight: 800
                }}>
                ✕ Close
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#CBD5E1', lineHeight: 1.7, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0 }}>
                <strong>Backtest Studio</strong> StockOracle Pro ka institutional-grade walk-forward simulation engine hai. Iska use karke aap kisi bhi strategy ko historical data par test kar sakte hain bina kisi curve-fitting ya look-ahead bias ke.
              </p>

              <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', padding: 12, borderRadius: 8 }}>
                <strong style={{ color: '#818CF8' }}>7 Strategy Rules:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.74rem' }}>
                  <li><strong>AI Walk-Forward ML</strong>: Machine learning model jo price predict karke statistical edge nikalta hai.</li>
                  <li><strong>EMA Golden Cross</strong>: Fast moving average jab slow moving average ko upar cross karta hai toh buy, niche cross karne par exit.</li>
                  <li><strong>RSI + Bollinger Mean Reversion</strong>: Jab stock oversold (RSI &lt; 30) aur lower band ke paas ho tab buy karta hai, upper band par profit book.</li>
                  <li><strong>20D Momentum Breakout</strong>: 20-day high breakout with heavy volume par buy karta hai (Classic Turtle trading).</li>
                  <li><strong>MACD Signal Cross</strong>: MACD line signal line ke upar aane par bullish entry.</li>
                  <li><strong>Supertrend Volatility Trail</strong>: Dynamic ATR trailing stop jo trend ke sath ride karta hai aur reversal par exit karta hai.</li>
                  <li><strong>SMC Pro</strong>: Intraday 4×/16× bias, confirmed BOS/CHoCH, liquidity sweeps, untouched OB/FVG aur session confluence; long/short entries ke structural swing stops/targets.</li>
                </ul>
              </div>

              <div>
                <strong style={{ color: '#F8FAFC' }}>Strategy Run Karne Ka Tarika (Step-by-Step):</strong>
                <ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.74rem' }}>
                  <li>Upar chips se stock chunein (jaise `RELIANCE` ya `ICICIBANK`).</li>
                  <li>Apni manpasand strategy select karein ya Quick Preset (jaise *Conservative* ya *Momentum*) par click karein.</li>
                  <li>SMC Pro ke liye candle interval aur lookback chunein. Strategy structural exits use karti hai; holding limit candles me hoti hai.</li>
                  <li><strong>Config & Risk</strong> me position sizing/slippage set karein; normal strategies ke liye percentage stops, aur SMC Pro ke liye structure-based exits use hote hain.</li>
                  <li><strong>Run Backtest</strong> button par click karein.</li>
                  <li>Results me **Equity Curve**, **Drawdown**, **Monthly Heatmap**, aur **Trade Journal** dekhein.</li>
                  <li>Trades ko Excel/CSV me download karne ke liye <strong>"Export CSV"</strong> use karein.</li>
                </ol>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{
                  background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none',
                  borderRadius: 8, padding: '7px 18px', color: '#fff', fontSize: '0.78rem',
                  fontWeight: 800, cursor: 'pointer'
                }}>
                Got it (Samajh Aa Gaya)
              </button>
            </div>
          </div>
        </div>

  );
}
