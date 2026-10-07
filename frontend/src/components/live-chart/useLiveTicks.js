import { useEffect, useCallback, useRef } from 'react';
import useStore from '../../store/useStore';
import {
  toChartTime, getSessionBucketStart, isCryptoSymbol, subscribeLiveTick,
  isAppendableTime, compareChartTime, INTERVAL_SLOT_SEC, computeFillSlots,
  getIstDateString, canUpdateLiveCandle,
} from '../../utils/chartHelpers';

/**
 * useLiveTicks — render-free live-tick engine for LiveChartView.
 * Ticks arrive via the 60-FPS live tick bus and are coalesced to at most one
 * candle update per animation frame; every guard (symbol, readiness, spike
 * protection, session bucketing) lives behind imperative refs so the main
 * React tree never re-renders per tick.
 */
export function useLiveTicks({
  symbolRef,
  intervalRef,
  readyRef,
  activeCandleRef,
  liveCandleTimeRef,
  lastVerifiedPriceRef,
  recentPricesRef,
  spikeCountRef,
  lastTickBucketRef,
  replayIndexRef,
  chartCanvasRef,
  setCandles,
}) {
  const pendingTickRef = useRef({ rafId: null, ltp: null });

  // Applies a verified LTP to the ongoing active candle (or spawns a new
  // session-bucket candle). Called at most once per animation frame from
  // processLiveTick — this is the ONLY hot path, kept free of React state.
  const applyTickToCandle = useCallback((ltp) => {
    const interval = intervalRef.current;
    const selectedSymbol = symbolRef.current;
    const isIntraday = interval !== '1d';
    const isCrypto = isCryptoSymbol(selectedSymbol);
    const nowMs = Date.now();

    // IST Day of Week & Market Time Calculation
    const istDate = new Date(nowMs + (5.5 * 3600 * 1000));
    const istDayOfWeek = istDate.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = istDayOfWeek === 0 || istDayOfWeek === 6;

    // Invariant: Weekend ticks must never generate artificial weekend candles (for NSE equities)
    if (isWeekend && !isCrypto) {
      return;
    }

    const istHours = istDate.getUTCHours();
    const istMinutes = istDate.getUTCMinutes();
    const istTimeMin = istHours * 60 + istMinutes;
    const isMarketHours = istTimeMin >= 555 && istTimeMin <= 930; // 09:15 to 15:30 IST

    // For intraday, ignore ticks outside continuous market hours to prevent isolated night bars (for NSE equities)
    if (isIntraday && !isMarketHours && !isCrypto) {
      return;
    }

    const storeLiveTick = useStore.getState().livePrices?.[selectedSymbol] || {};

    // Publishes a new bucket candle in ascending order, backfilling slots
    // skipped during genuine micro-stalls with flat carry-forward bars
    // (volume 0). Fills are CONTINUITY-GATED: the previous bucket must have
    // been tick-touched in this session (lastTickBucketRef) — rollovers from
    // seeded bars (history/cache restore, remount, hidden-tab return, full
    // replace) leave an honest gap instead of a fake flat line at a stale
    // price. Daily buckets and oversized skips are never filled
    // (weekends/holidays and real outages must stay visible). Same-time calls
    // only update in place (state updater returns prev → no re-render,
    // render-free hot path kept).
    const emitOrdered = (prevTime, prevClose, newCandle) => {
      const slot = INTERVAL_SLOT_SEC[interval];
      const flat = Number(prevClose);
      const flatOk = isFinite(flat) && flat > 0;
      const continuous = lastTickBucketRef.current != null && prevTime === lastTickBucketRef.current;
      const fills = (slot && flatOk && continuous && prevTime !== newCandle.time)
        ? computeFillSlots(prevTime, newCandle.time, slot, { sameDayOnly: !isCrypto })
            .map((t) => ({ time: t, open: flat, high: flat, low: flat, close: flat, volume: 0 }))
        : [];
      const ordered = [...fills, newCandle];
      for (const c of ordered) {
        // Frozen during Bar Replay — the replay cursor owns the chart surface.
        if (replayIndexRef.current == null) chartCanvasRef.current?.updateActiveCandle(c);
      }
      activeCandleRef.current = newCandle;
      lastTickBucketRef.current = newCandle.time;
      try {
        setCandles((prev) => {
          if (!Array.isArray(prev)) return prev;
          let out = prev;
          let changed = false;
          for (const c of ordered) {
            if (out.length === 0) { out = [c]; changed = true; continue; }
            const lastTime = out[out.length - 1].time;
            if (lastTime === c.time) continue;
            // Late bucket vs newer history — drop the whole publish.
            if (!isAppendableTime(lastTime, c.time)) return prev;
            out = [...out, c];
            changed = true;
          }
          return changed ? out : prev;
        });
      } catch {}
    };

    // 1. Direct Live Exchange Candle (e.g. from Binance continuous kline stream).
    // The incoming tick price always wins for close/high/low so sub-second
    // aggTrade ticks move the candle fluidly between exchange kline updates.
    if (storeLiveTick.liveCandle) {
      const rawCandle = storeLiveTick.liveCandle;
      const formattedTime = toChartTime(rawCandle.time, isIntraday);
      if (formattedTime) {
        // Guard: never regress activeCandleRef with a stale/out-of-order
        // exchange bar — lightweight-charts `setData` throws
        // "data must be asc ordered by time" if such a bar is appended.
        const curActive = activeCandleRef.current;
        if (curActive && curActive.time !== formattedTime) {
          if (typeof curActive.time !== typeof formattedTime ||
              compareChartTime(curActive.time, formattedTime) > 0) {
            return;
          }
        }
        const o = Number(rawCandle.open);
        const c = ltp;
        // Guard corrupt exchange fields: a missing/NaN open/high/low would
        // otherwise propagate as NaN OHLC into series.update() and poison the
        // PlotList (one frame later: "Value is null" in paint).
        if (!isFinite(o) || o <= 0) return;
        const rawH = Number(rawCandle.high);
        const rawL = Number(rawCandle.low);
        const liveCandle = {
          ...rawCandle,
          time: formattedTime,
          open: o,
          high: Math.max(isFinite(rawH) ? rawH : o, o, c),
          low: Math.min(isFinite(rawL) ? rawL : o, o, c),
          close: c,
          volume: Number(rawCandle.volume || 0),
        };
        liveCandleTimeRef.current = formattedTime;
        emitOrdered(curActive?.time, curActive?.close, liveCandle);
        return;
      }
    }

    // 2. Synthetic Session Bucketing for Indian Equities / Generic Ticks
    let currentBucketTime = null;
    if (isIntraday) {
      currentBucketTime = getSessionBucketStart(interval, nowMs, isCrypto);
    } else {
      // IST Market Date YYYY-MM-DD for BOTH equity and crypto (backend
      // invariant §1 + fetcher astimezone(_IST)). UTC date would map
      // 00:00–05:30 IST ticks onto yesterday's finalized candle.
      currentBucketTime = getIstDateString(nowMs);
    }

    let active = activeCandleRef.current;
    // Equity candles may only be painted from a verified-live feed — the
    // clock window can't see NSE holidays, so is_live:false (holiday/
    // broker-outage fallback) vetoes it (AGENTS.md §4). Pure helper → unit
    // tested in chartHelpers.test.js.
    const canUpdateCandle = canUpdateLiveCandle({
      isCrypto,
      isMarketHours,
      isLive: storeLiveTick.is_live,
    });

    // Check if ongoing active candle matches the current time bucket
    if (active && active.time === currentBucketTime) {
      // Only mutate ongoing active candle during live market hours, confirmed live ticks, or 24/7 crypto
      if (canUpdateCandle) {
        active.high = Math.max(Number(active.high), ltp);
        active.low = Math.min(Number(active.low), ltp);
        active.close = ltp;
        // This bucket is provably live-touched — a later rollover from it
        // may bridge micro-stall slots (continuity gate in emitOrdered).
        lastTickBucketRef.current = active.time;
        // Frozen during Bar Replay — the replay cursor owns the chart surface.
        if (replayIndexRef.current == null) chartCanvasRef.current?.updateActiveCandle(active);
      }
    } else if (currentBucketTime && canUpdateCandle) {
      // Guard: drop stale buckets (client clock behind server history, late
      // ticks, or interval-switch races). Appending a time <= active.time
      // would make `candles` non-ascending and crash lightweight-charts
      // `setData` with "data must be asc ordered by time".
      if (active && active.time !== currentBucketTime) {
        if (typeof active.time !== typeof currentBucketTime ||
            compareChartTime(active.time, currentBucketTime) > 0) {
          return;
        }
      }
      // Only spawn a NEW session candle during market hours with verified live ticks or 24/7 crypto.
      // Continuation window = the interval's own slot (1h→3600, 4h→14400) so
      // prevClose carries over on hourly buckets; the old hardcoded 300s broke
      // gap continuity on 1h/4h (open fell back to tick LTP).
      // NOTE: For daily candles, currentBucketTime is a string (YYYY-MM-DD), so
      // isContinuation falls through to `active.time === currentBucketTime` — which
      // is always false here (we're in the else-if branch where they differ).
      // This is correct: daily candles always open at the tick LTP, never prevClose.
      const slotSec = INTERVAL_SLOT_SEC[interval] || 300;
      const isContinuation = active?.time && (
        typeof active.time === 'number' && typeof currentBucketTime === 'number'
          ? (currentBucketTime - active.time) <= slotSec
          : active.time === currentBucketTime
      );
      const prevClose = (isContinuation && active?.close != null) ? Number(active.close) : null;
      const openPrice = (!isIntraday && Number(storeLiveTick.open) > 0)
        ? Number(storeLiveTick.open)
        : (prevClose && !isNaN(prevClose) ? prevClose : ltp);
      const highPrice = Math.max(openPrice, ltp);
      const lowPrice = Math.min(openPrice, ltp);

      const newCandle = {
        time: currentBucketTime,
        open: openPrice,
        high: highPrice,
        low: lowPrice,
        close: ltp,
        volume: (!isIntraday && Number(storeLiveTick.volume) > 0)
          ? Number(storeLiveTick.volume)
          : (isIntraday && storeLiveTick.liveCandle?.volume != null)
            ? Number(storeLiveTick.liveCandle.volume)
            : 0,
      };
      // Ordered publish: backfills stall-skipped slots, updates the chart
      // imperatively, and stores the SAME object reference in state so ticks
      // mutate it in place (future recomputes see fresh OHLC, one render
      // per bucket rollover — per-tick path stays render-free).
      emitOrdered(active?.time, active?.close, newCandle);
    }
  }, []);

  // 2. Real-Time Live Tick Processing — render-free path.
  // Ticks arrive via the 60-FPS live tick bus (emitLiveTick) and are applied
  // directly to the chart through imperative refs. React state is NOT touched
  // per tick: pending ticks are coalesced to one update per animation frame,
  // so bursts of ticks can never cause render jank.
  const processLiveTick = useCallback((tick) => {
    if (!tick || tick.price == null) return;
    const ltp = Number(tick.price);
    if (isNaN(ltp) || ltp <= 0) return;

    // Verify tick belongs to currently selected symbol
    const sym = symbolRef.current;
    if (tick.ticker && sym && String(tick.ticker).toUpperCase() !== String(sym).toUpperCase()) return;

    // Do not process ticks until historical data has finished loading
    if (readyRef.current.loading || !readyRef.current.hasCandles) return;

    // Outlier Spike Protection: ignore ticks deviating beyond an adaptive
    // threshold from the verified reference price. 20% static floor combined
    // with a rolling mean-absolute-deviation measure so genuine large moves in
    // high-beta stocks are kept while fat-finger errors are caught.
    const refPrice = lastVerifiedPriceRef.current || ltp;
    const staticThreshold = 0.20;
    let adaptiveThreshold = 0.05;
    const recent = recentPricesRef.current;
    if (recent.length >= 5) {
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const mad = recent.reduce((a, b) => a + Math.abs(b - mean), 0) / recent.length;
      const madBased = (mad / refPrice) * 3;
      adaptiveThreshold = Math.max(0.05, Math.min(0.30, madBased));
    }
    const effectiveThreshold = Math.max(staticThreshold, adaptiveThreshold);
    if (Math.abs(ltp - refPrice) / refPrice > effectiveThreshold) {
      spikeCountRef.current = (spikeCountRef.current || 0) + 1;
      if (spikeCountRef.current < 3) {
        return;
      }
    }
    spikeCountRef.current = 0;
    recentPricesRef.current.push(ltp);
    if (recentPricesRef.current.length > 20) {
      recentPricesRef.current.shift();
    }
    lastVerifiedPriceRef.current = ltp;

    // Coalesce ticks: apply at most one candle update per animation frame
    pendingTickRef.current.ltp = ltp;
    if (pendingTickRef.current.rafId == null) {
      pendingTickRef.current.rafId = requestAnimationFrame(() => {
        pendingTickRef.current.rafId = null;
        applyTickToCandle(pendingTickRef.current.ltp);
      });
    }
  }, [applyTickToCandle]);

  // Subscribe once — refs above keep the handler fresh without re-subscribing
  useEffect(() => {
    const unsub = subscribeLiveTick(processLiveTick);
    return () => {
      unsub();
      if (pendingTickRef.current.rafId != null) {
        cancelAnimationFrame(pendingTickRef.current.rafId);
        pendingTickRef.current.rafId = null;
      }
    };
  }, [processLiveTick]);
}
