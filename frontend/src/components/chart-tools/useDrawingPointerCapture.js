import { useEffect, useRef } from 'react';

// --- window-level pointer capture ---

export function useDrawingPointerCapture(ctx) {
  const {
    draggingHandle, gestureActiveRef, handleSvgMouseMove, handleSvgMouseUp, mainPaneRef,
    selectedDrawingId, setSelectedDrawingId, svgRef,
  } = ctx;

  // ── Window-level pointer capture (TradingView parity) ─────────────────────
  // In cursor/selection modes the SVG overlay is click-through so the chart
  // keeps panning — but then moves/releases over empty chart space never reach
  // the svg handlers and anchor drags freeze mid-gesture. Mirroring the move
  // and release on `window` keeps every drag glued to the cursor no matter
  // what sits under the pointer. The mouse-up guard above makes the double
  // delivery (svg + window) commit exactly once.
  const svgMoveRef = useRef(null);
  const svgUpRef = useRef(null);
  svgMoveRef.current = handleSvgMouseMove;
  svgUpRef.current = handleSvgMouseUp;

  useEffect(() => {
    const onMove = (e) => {
      if (gestureActiveRef.current) {
        svgMoveRef.current?.(e);
        return;
      }
      // Hover (no gesture): only magnet-track when the pointer is over the
      // overlay itself, so moving over side panels costs nothing.
      try {
        if (svgRef.current && e?.target instanceof Node && svgRef.current.contains(e.target)) {
          svgMoveRef.current?.(e);
        }
      } catch (_) {}
    };
    const onUp = (e) => {
      if (gestureActiveRef.current) svgUpRef.current?.(e);
    };
    const onBlur = () => {
      // Pointer left the window mid-gesture (Alt+Tab, chrome UI): commit what
      // we have instead of leaving a stuck drag behind.
      if (gestureActiveRef.current) svgUpRef.current?.({});
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [gestureActiveRef, svgRef]);

  // Touch equivalent while a drag is live (touchmove must be non-passive to
  // keep the gesture from scrolling the page mid-drag).
  useEffect(() => {
    if (!draggingHandle) return undefined;
    const onMove = (e) => svgMoveRef.current?.(e);
    const onUp = (e) => svgUpRef.current?.(e);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
    return () => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
    };
  }, [draggingHandle]);

  // ── Click empty chart → deselect (TradingView parity) ─────────────────────
  // In cursor modes the overlay is click-through, so empty-chart clicks never
  // reach the svg deselect path and the selection would stick forever. Detect
  // them on window instead: a press+release with <6px movement whose target
  // sits inside the price pane but OUTSIDE the overlay (i.e. not on a shape,
  // toolbar, menu or popup) clears the selection. Pans keep the selection.
  const emptyClickRef = useRef(null);
  useEffect(() => {
    if (selectedDrawingId == null) return undefined;
    const isEmptyPaneTarget = (t) => {
      try {
        const pane = mainPaneRef?.current;
        if (!t || !(t instanceof Node) || !pane || !svgRef.current) return false;
        return pane.contains(t) && !svgRef.current.contains(t);
      } catch (_) {
        return false;
      }
    };
    const onDown = (e) => {
      emptyClickRef.current = null;
      if (e?.button != null && e.button !== 0) return; // left button / touch only
      if (!isEmptyPaneTarget(e.target)) return;
      emptyClickRef.current = {
        x: e?.changedTouches?.[0]?.clientX ?? e?.clientX ?? 0,
        y: e?.changedTouches?.[0]?.clientY ?? e?.clientY ?? 0,
      };
    };
    const onUp = (e) => {
      const start = emptyClickRef.current;
      emptyClickRef.current = null;
      if (!start || !isEmptyPaneTarget(e?.target)) return;
      const cx = e?.changedTouches?.[0]?.clientX ?? e?.clientX ?? start.x;
      const cy = e?.changedTouches?.[0]?.clientY ?? e?.clientY ?? start.y;
      const dx = cx - start.x;
      const dy = cy - start.y;
      if (dx * dx + dy * dy > 36) return; // it was a pan — keep selection
      setSelectedDrawingId(null);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchstart', onDown);
      window.removeEventListener('touchend', onUp);
    };
  }, [selectedDrawingId, mainPaneRef, setSelectedDrawingId, svgRef]);
}
