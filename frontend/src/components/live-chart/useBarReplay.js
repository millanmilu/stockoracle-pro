import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import { REPLAY_SPEEDS } from '../chart/ReplayBar';
import { formatReplayBarLabel } from './format';

/**
 * useBarReplay — Bar Replay (TradingView parity) transport for LiveChartView.
 * replayIndex = last VISIBLE bar (null = live). The chart surfaces render
 * `chartCandles` (history capped at the cursor) while full `candles` keep
 * growing underneath, so exiting replay is instant and lossless.
 *
 * Owns the replay state, transport handlers, auto-advance timers and the
 * keyboard shortcuts (Alt+R / Space / Arrows / Esc / Alt+V).
 */
export function useBarReplay({ candles, selectedSymbol, interval, setActiveIndicators, replayIndexRef }) {
  const [replayIndex, setReplayIndex] = useState(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(3); // index into REPLAY_SPEEDS (1x)
  const [isJumpMode, setIsJumpMode] = useState(false);
  replayIndexRef.current = replayIndex;
  const isReplaying = replayIndex != null;
  const chartCandles = useMemo(
    () => (isReplaying ? candles.slice(0, Math.max(0, Math.min(replayIndex + 1, candles.length))) : candles),
    [candles, replayIndex, isReplaying],
  );

  // ── Bar Replay transport ─────────────────────────────────────────────────
  const exitReplay = useCallback(() => {
    setReplayPlaying(false);
    setReplayIndex(null);
    setIsJumpMode(false);
  }, []);

  const startReplay = useCallback(() => {
    if (!Array.isArray(candles) || candles.length < 5) return;
    // Begin ~60 bars back so there is room to step/play forward.
    setReplayIndex(Math.max(0, candles.length - 61));
    setReplayPlaying(false);
    setIsJumpMode(false);
    toast.success('Bar Replay started (Space: Play/Pause, →/←: Step, Esc: Exit)');
  }, [candles]);

  const stepReplay = useCallback((delta) => {
    setReplayPlaying(false);
    setReplayIndex((prev) => {
      if (prev == null) return prev;
      return Math.max(0, Math.min(candles.length - 1, prev + delta));
    });
  }, [candles.length]);

  const seekReplay = useCallback((i) => {
    setReplayPlaying(false);
    setReplayIndex(() => Math.max(0, Math.min(candles.length - 1, Number(i) || 0)));
  }, [candles.length]);

  const cycleReplaySpeed = useCallback(() => {
    setReplaySpeed((s) => (s + 1) % REPLAY_SPEEDS.length);
  }, []);

  const handleChartClick = useCallback((param) => {
    if (!isJumpMode || !param || !param.time || !Array.isArray(candles)) return;
    const clickedTime = param.time;
    const idx = candles.findIndex((c) => c.time === clickedTime);
    if (idx !== -1) {
      setReplayIndex(idx);
      setReplayPlaying(false);
      setIsJumpMode(false);
      toast.success(`Replay jumped to ${formatReplayBarLabel(clickedTime)}`);
    }
  }, [isJumpMode, candles]);

  // Auto-advance while playing; reaching the live edge pauses replay.
  // Timer depends on speed/length only (NOT replayIndex) so it isn't
  // destroyed+recreated every step (uneven speed). End-of-replay toast fires
  // once via ref guard instead of on every render at the edge.
  const replayEndToastRef = useRef(false);
  useEffect(() => {
    if (!replayPlaying || replayIndex == null) return undefined;
    replayEndToastRef.current = false;
    const id = window.setInterval(() => {
      setReplayIndex((p) => {
        if (p == null) return p;
        const total = candles.length;
        if (p >= total - 1) return p;
        return p + 1;
      });
    }, REPLAY_SPEEDS[replaySpeed]?.ms || 500);
    return () => window.clearInterval(id);
  }, [replayPlaying, replaySpeed, candles.length]);
  useEffect(() => {
    if (replayPlaying && replayIndex != null && replayIndex >= candles.length - 1) {
      setReplayPlaying(false);
      if (!replayEndToastRef.current) {
        replayEndToastRef.current = true;
        toast.success('Replay reached latest candle');
      }
    } else if (replayIndex != null && replayIndex < candles.length - 1) {
      replayEndToastRef.current = false;
    }
  }, [replayPlaying, replayIndex, candles.length]);

  // Symbol / interval switches leave replay mode (fresh history).
  useEffect(() => {
    setReplayPlaying(false);
    setReplayIndex(null);
    setIsJumpMode(false);
  }, [selectedSymbol, interval]);

  // Bar Replay keyboard transport controls:
  // Alt+R toggles, Space plays/pauses, Arrow keys step forward/back, Esc exits/cancels.
  // Listener attaches ONCE (stable refs) — previously depended on `candles`
  // via startReplay/stepReplay and re-attached on every candle append.
  const startReplayRef = useRef(startReplay);
  startReplayRef.current = startReplay;
  const exitReplayRef = useRef(exitReplay);
  exitReplayRef.current = exitReplay;
  const stepReplayRef = useRef(stepReplay);
  stepReplayRef.current = stepReplay;
  const isJumpModeRef = useRef(isJumpMode);
  isJumpModeRef.current = isJumpMode;
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable) return;

      // Alt+R toggle
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key || '').toLowerCase() === 'r') {
        e.preventDefault();
        if (replayIndexRef.current != null) exitReplayRef.current();
        else startReplayRef.current();
        return;
      }

      // Alt+V toggle Volume Profile (VPVR)
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && String(e.key || '').toLowerCase() === 'v') {
        e.preventDefault();
        setActiveIndicators((prev) => {
          const exists = prev.includes('volume_profile');
          const next = exists ? prev.filter((id) => id !== 'volume_profile') : [...prev, 'volume_profile'];
          toast.success(exists ? 'Volume Profile removed' : 'Volume Profile (VPVR) added');
          return next;
        });
        return;
      }

      // Transport shortcuts active ONLY while Replay mode is active.
      // Space/Arrows preventDefault ONLY in replay mode (page scroll intact otherwise).
      if (replayIndexRef.current != null) {
        if (e.code === 'Space') {
          e.preventDefault();
          setReplayPlaying((p) => !p);
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          stepReplayRef.current(e.shiftKey ? 10 : 1);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          stepReplayRef.current(e.shiftKey ? -10 : -1);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          if (isJumpModeRef.current) {
            setIsJumpMode(false);
            toast.success('Jump mode cancelled');
          } else {
            exitReplayRef.current();
            toast.success('Exited Bar Replay (Live)');
          }
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const replayBar = isReplaying && chartCandles.length > 0 ? chartCandles[chartCandles.length - 1] : null;
  const prevReplayBar = isReplaying && chartCandles.length > 1 ? chartCandles[chartCandles.length - 2] : null;
  const replayDayChange = isReplaying
    ? (replayBar && prevReplayBar && prevReplayBar.close ? ((replayBar.close - prevReplayBar.close) / prevReplayBar.close) * 100 : (replayBar?.change_pct ?? null))
    : null;

  return {
    replayIndex,
    replayPlaying,
    setReplayPlaying,
    replaySpeed,
    isJumpMode,
    isReplaying,
    chartCandles,
    replayBar,
    prevReplayBar,
    replayDayChange,
    exitReplay,
    startReplay,
    stepReplay,
    seekReplay,
    cycleReplaySpeed,
    handleChartClick,
  };
}
