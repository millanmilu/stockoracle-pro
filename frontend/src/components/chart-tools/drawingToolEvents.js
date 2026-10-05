// --- mouse / touch event helpers ---

  // Helper for mouse/touch position.
  // NOTE: `touchend` carries no `touches` — coordinates live in
  // `changedTouches`. Without this fallback every touch release resolved to
  // NaN and the commit was silently discarded (nothing ever got placed).
  export const pickTouch = (e) => {
    if (e?.touches && e.touches.length > 0) return e.touches[0];
    if (e?.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0];
    return null;
  };
  export const getEventPos = (e, svgRef) => {
    const rect = svgRef.current?.getBoundingClientRect() || e.currentTarget.getBoundingClientRect();
    const t = pickTouch(e);
    const clientX = t ? t.clientX : e.clientX;
    const clientY = t ? t.clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
      clientX,
      clientY,
    };
  };
