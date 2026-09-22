# 09 — Gotchas (aam galtiyaan + fix)

1. **Intraday SQLite me daal diya?** → Kabhi mat karo. Sirf memory cache. Test `test_data_invariants.py` pakad lega.
2. **`dropna` se candles gayab?** → `enrich_stock_dataframe` me dropna mana hai. `min_periods=1` use karo.
3. **Weekend pe candle ban gayi?** → `get_combined_stock_data` ka weekday+9AM check dekho.
4. **WS me fake price?** → Hardcoded fallback hatao, historical close use karo. Test: `test_ws_broadcast_fallback.py`.
5. **Chart me gap = bug?** → Nahi. Bada outage gap whitespace ke roop me dikhna chahiye (lightweight-charts behavior). Sirf <=30 slots fill hote hain.
6. **ML 503 de raha?** → `require_real_data` ne synthetic block kiya = broker offline ya history nahi. Pehle `/api/stocks/session` dekho.
7. **Heuristic prediction pe confidence?** → "Uncalibrated" label me confidence None hota hai — UI me "model trained nahi" dikhao.
8. **Vault decrypt fail?** → Prod me JWT_SECRET badla hoga. Purani rows legacy key se padhi jaati hain; nahi khule to key wapas lao.
9. **CORS/API 403?** → Prod me `X-API-Key` header bhejo; `?api_key=` deprecated hai.
10. **Terminal khaali?** → `python verify_terminal.py` chalao; OpenBB optional hai, native engine fallback hai.
11. **Crypto seed DB me gaya?** → `_generate_crypto_seed_data` sirf charts ke liye hai — persist mat karo (DB me gaya to `sqlite` source banke ML me ghus jayega). Guard list me `crypto_seed` hai.
12. **52W high/low unknown?** → `current*1.15` jaisa estimate mat banao — `null` bhejo.
13. **Naya router bina auth?** → `dependencies=[Security(verify_api_key)]` lagao (research/ml pattern). Prod me `API_KEY` unset ho to startup par loud error aata hai.
