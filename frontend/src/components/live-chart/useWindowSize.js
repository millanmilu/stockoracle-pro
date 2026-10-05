import { useState, useEffect } from 'react';

/**
 * useWindowSize — simple hook to track viewport width for responsive layout.
 * Uses ResizeObserver on body (consistent with ChartCanvas pattern) for accuracy.
 */
export function useWindowSize() {
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    let rafId = null;
    const handler = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
        rafId = null;
      });
    };
    window.addEventListener('resize', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);
  return width;
}
