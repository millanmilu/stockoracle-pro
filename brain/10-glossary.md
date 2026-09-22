# 10 — Glossary (Hinglish)

- **OHLCV** — Open/High/Low/Close/Volume; ek candle ka data.
- **LTP** — Last Traded Price; sabse taaza price.
- **IST trading day** — NSE ka din (09:15–15:30 IST, Mon–Fri, holiday chhod ke).
- **Candle/Bar** — ek time slice ka OHLCV (1m, 5m, 1h, 1d...).
- **Intraday** — din ke andar ke chhote intervals; SQLite me save nahi hote.
- **Slot-fill** — chhote missing minutes ko prev-close se bharna (vol 0).
- **SMA/EMA** — average price lines; trend dikhati hain.
- **RSI** — momentum 0–100; <30 oversold, >70 overbought.
- **MACD** — trend momentum crossover.
- **Bollinger Bands** — volatility ke upper/lower lines; %B batata hai price kaha hai.
- **ATR/ADX** — volatility / trend-strength.
- **VWAP** — volume-weighted average price (intraday benchmark).
- **Supertrend** — volatility trail se BUY/SELL line.
- **PCR** — Put-Call Ratio; options sentiment.
- **Max Pain** — option writers ka sabse kam nuksaan wala strike.
- **Greeks** — Delta/Gamma/Theta/Vega; option price sensitivity.
- **DCF** — future cash flow se fair value.
- **VaR/CVaR** — kitna loss ho sakta hai (risk).
- **Sharpe/Sortino/Calmar** — return-per-risk scores.
- **Drawdown** — peak se sabse bada girawat.
- **Backtest** — purane data pe strategy ka trial.
- **Walk-forward** — past pe train, future pe test (no cheating).
- **Look-ahead bias** — future data se past me cheat karna (mana hai).
- **Paper trading** — nakli paison se real-style trading (₹10L).
- **Screener** — condition pe stocks filter (RSI, PE...).
- **Heatmap** — poori market ka rang-biranga return map.
- **VPVR** — price levels pe volume bars.
- **Fear & Greed** — market sentiment meter.
- **TTL cache** — kuch second/minute ke liye yaad rakha data.
- **TimescaleDB** — time-series ke liye Postgres extension.
- **Celery/Redis** — background jobs + queue.

## Chart / AI engine ke terms
- **Overlay** — price ke saath **same scale** pe chalti line (SMA, Bollinger, Supertrend, forecast bands).
- **Sub-pane / Oscillator** — apna **alag scale** wala pane (RSI, MACD, AI Trend/Momentum/Exhaustion).
  Bounded score (jo −100…+100 ya 0…100 ho) kabhi price scale pe nahi daal sakte — isliye alag pane.
- **Warmup** — indicator ke shuru ke bars jahan value nahi hoti (period pura hone se pehle). Ye khaali
  hona normal hai, bug nahi.
- **Marker** — chart pe symbol (arrow up/down, circle) jo event dikhata hai (BRK breakout, EXH exhaustion,
  pattern shapes).
- **Regime** — market ka mood: `TREND` / `RANGE` / `BREAKOUT` / `HIGH-VOL` (+ `TRANSITION`).
- **Impulse** — breakout ke waqt move ki strength (−100…+100).
- **Squeeze** — Bollinger bandwidth percentile bahut kam = volatility compress ho rahi hai, break nazdeek.
- **Exhaustion** — move thak gaya? Divergence + rejection wicks + overextension se score banta hai.
  Sign ka matlab: **positive = sellers exhausted (bullish bounce ke chance)**, negative = buyers exhausted.
- **Divergence** — price naya high/low banata hai par oscillator nahi (ya ulta) → reversal ka hint.
- **Confluence** — kitne sub-models ek hi direction me hain (buy / sell / neutral counts).
- **MTF / HTF** — Multi-Timeframe / Higher-Timeframe (1m se 1W tak alignment).

## Research / screener ke terms
- **DSL** — Domain-Specific Language; yahan Screener.in jaisa formula language (jo safe SQL me
  compile hota hai — `eval` nahi).
- **Point-in-time** — backtest me us din ka asli data (aaj ka nahi) use karna — look-ahead bias se bachne ke liye.
- **STT** — Securities Transaction Tax; backtest me friction/cost ke roop me lagta hai.
- **Validation MAPE** — hold-out validation ka Mean Absolute Percentage Error; isi se model ki
  certified confidence banti hai (na ho to model ki confidence report nahi hoti).
