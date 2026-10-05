import { getToolSpec } from './drawingToolCatalog';

// --- RAF-coalesced move processing ---

export function processMoveImpl(clientX, clientY, ctx) {
  const {
    bodyGestureRef, chartToCoord, coordToChart, dragMovedRef, dragSnapshotRef, drawingsRef,
    findMagnetSnap, fracForLogical, interval, isFreehandType, moveStateRef, setCurrentDraw,
    setDragStartPos, setDrawings, setSnapIndicator, svgRectRef, svgRef, timeForLogical,
    timeframeMs, toAnchor,
  } = ctx;

    const st = moveStateRef.current || {};
    const {
      draggingHandle: mh,
      selectedDrawingId: mid,
      selectedDrawingIds: mids,
      dragStartPos: mpos,
      lockAllDrawings: mlock,
      isDrawing: misDrawing,
      currentDraw: mdraw,
      pendingPoints: mpending,
    } = st;
    // Cached layout rect (refreshed on mousedown / resize / 1s staleness) —
    // avoids a forced reflow on every move event.
    let rect = svgRectRef.current;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!rect || (now - rect.measuredAt) > 1000) {
      const fresh = svgRef.current?.getBoundingClientRect();
      if (!fresh) return;
      rect = { left: fresh.left, top: fresh.top, width: fresh.width, height: fresh.height, measuredAt: now };
      svgRectRef.current = rect;
    }
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const snap = findMagnetSnap(x, y);
    // Change-guarded: hovering must not re-render 100×/s on an identical snap.
    setSnapIndicator((prev) => {
      if (snap === prev) return prev;
      if (!snap || !prev) return snap;
      return (snap.x === prev.x && snap.y === prev.y && snap.label === prev.label) ? prev : snap;
    });

    const finalX = snap ? snap.x : x;
    const finalY = snap ? snap.y : y;
    const chartPt = snap
      ? { logical: snap.logical, price: snap.price, time: snap.time, frac: snap.frac ?? 0 }
      : coordToChart(finalX, finalY);
    const moveTime = snap?.time ?? timeForLogical(chartPt.logical);
    const moveFrac = snap?.frac ?? fracForLogical(chartPt.logical);
    const moveOffMs = Number.isFinite(moveFrac) && timeframeMs > 0 ? moveFrac * timeframeMs : 0;

    // ── Handle dragging existing item ──
    if (mh && mid && mpos && !mlock) {
      // Rectangle corners (`rect:0..3` = TL,TR,BL,BR): the grabbed corner
      // follows the cursor while the OPPOSITE corner stays fixed — a true box
      // resize. Anchors are renormalised to (top-left, bottom-right) every
      // frame so the box never flips or shears.
      if (typeof mh === 'string' && mh.startsWith('rect:')) {
        const index = Number(mh.slice(5));
        const OPP = [3, 2, 1, 0];
        const o = OPP[index] ?? 3;
        bodyGestureRef.current = null;
        dragMovedRef.current = true;
        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== mid) return d;
            const sL = d.startLogical;
            const sP = d.startPrice;
            const eL = d.endLogical;
            const eP = d.endPrice;
            if (sL == null || eL == null || sP == null || eP == null) return d;
            if (chartPt.logical == null || chartPt.price == null) return d;
            const loL = Math.min(sL, eL);
            const hiL = Math.max(sL, eL);
            const loP = Math.min(sP, eP);
            const hiP = Math.max(sP, eP);
            const cornerL = [loL, hiL, loL, hiL];
            const cornerP = [hiP, hiP, loP, loP];
            const oL = cornerL[o];
            const oP = cornerP[o];
            const nL = chartPt.logical;
            const nP = chartPt.price;
            const nLoL = Math.min(oL, nL);
            const nHiL = Math.max(oL, nL);
            const nLoP = Math.min(oP, nP);
            const nHiP = Math.max(oP, nP);
            // Wall-clock identity follows the logical (time) axis: whichever
            // side owns the edge logical owns the anchor time.
            const rOL = Math.round(oL);
            const oTime = timeForLogical(rOL) ?? null;
            const oFrac = oL - rOL;
            const oOff = timeframeMs > 0 ? oFrac * timeframeMs : 0;
            const sFromO = nLoL === oL;
            const eFromO = nHiL === oL;
            const pS = chartToCoord(nLoL, nHiP, d.startX, d.startY);
            const pE = chartToCoord(nHiL, nLoP, d.endX, d.endY);
            return {
              ...d,
              startX: pS.x,
              startY: pS.y,
              startLogical: nLoL,
              startPrice: nHiP,
              startTime: sFromO ? oTime : moveTime,
              startFrac: sFromO ? oFrac : moveFrac,
              startOffMs: sFromO ? oOff : moveOffMs,
              endX: pE.x,
              endY: pE.y,
              endLogical: nHiL,
              endPrice: nLoP,
              endTime: eFromO ? oTime : moveTime,
              endFrac: eFromO ? oFrac : moveFrac,
              endOffMs: eFromO ? oOff : moveOffMs,
              tf: d.tf ?? interval,
            };
          })
        );
        setDragStartPos({ x: finalX, y: finalY });
        return;
      }
      // Handle/end/point drags pin directly to the cursor (time-anchored).
      if (mh === 'start' || mh === 'end' || mh === 'target' || mh === 'stop' ||
          (typeof mh === 'string' && mh.startsWith('point:'))) {
        bodyGestureRef.current = null;
        dragMovedRef.current = true;
        setDrawings((prev) =>
          prev.map((d) => {
            if (d.id !== mid) return d;
            if (mh === 'start') {
              return {
                ...d,
                startX: finalX,
                startY: finalY,
                startLogical: chartPt.logical,
                startPrice: chartPt.price,
                startTime: moveTime,
                startFrac: moveFrac,
                startOffMs: moveOffMs,
              };
            }
            if (mh === 'end') {
              return {
                ...d,
                endX: finalX,
                endY: finalY,
                endLogical: chartPt.logical,
                endPrice: chartPt.price,
                endTime: moveTime,
                endFrac: moveFrac,
                endOffMs: moveOffMs,
              };
            }
            if (mh === 'target') {
              return { ...d, targetPrice: chartPt.price };
            }
            if (mh === 'stop') {
              return { ...d, stopPrice: chartPt.price };
            }
            // Extended shapes: drag an individual anchor handle ("point:2")
            if (typeof mh === 'string' && mh.startsWith('point:')) {
              const index = Number(mh.slice(6));
              const nextPoints = Array.isArray(d.points) ? d.points.slice() : [];
              nextPoints[index] = { x: finalX, y: finalY, logical: chartPt.logical, price: chartPt.price, time: moveTime, frac: moveFrac, offMs: moveOffMs, tf: interval };
              return { ...d, points: nextPoints };
            }
            return d;
          })
        );
        setDragStartPos({ x: finalX, y: finalY });
        return;
      }
      if (mh === 'channel') {
        bodyGestureRef.current = null;
        dragMovedRef.current = true;
        // Width = perpendicular distance from the cursor to the pre-drag
        // median line (TradingView: grab the rail and pull). Resolved from the
        // snapshot so fast drags never accumulate drift.
        let nextWidth = 35;
        try {
          const snapshot = dragSnapshotRef.current || drawingsRef.current;
          const origin = snapshot.find((d) => d.id === mid);
          const A = chartToCoord(origin?.startLogical, origin?.startPrice, origin?.startX, origin?.startY);
          const B = chartToCoord(origin?.endLogical, origin?.endPrice, origin?.endX, origin?.endY);
          const mdx = (B?.x ?? 0) - (A?.x ?? 0);
          const mdy = (B?.y ?? 0) - (A?.y ?? 0);
          const len = Math.hypot(mdx, mdy);
          if (len > 0.001 && A && B) {
            nextWidth = Math.abs(((finalX - A.x) * -mdy + (finalY - A.y) * mdx) / len);
          } else if (A) {
            nextWidth = Math.abs(finalY - A.y);
          }
        } catch (_) {}
        nextWidth = Math.max(10, nextWidth);
        setDrawings((prev) =>
          prev.map((d) => (d.id === mid ? { ...d, channelWidth: nextWidth } : d))
        );
        return;
      }
      if (mh === 'body') {
        // Data-space move: total delta from gesture origin applied to the
        // pre-drag snapshot. Bars stay glued even across long / fast drags.
        const snapshot = dragSnapshotRef.current || drawingsRef.current;
        const originDrawing = snapshot.find((d) => d.id === mid);
        if (!originDrawing) {
          setDragStartPos({ x: finalX, y: finalY });
          return;
        }
        dragMovedRef.current = true;
        let gesture = bodyGestureRef.current;
        if (!gesture || gesture.drawingId !== mid) {
          gesture = {
            drawingId: mid,
            originLogical: chartPt.logical,
            originPrice: chartPt.price,
            originX: finalX,
            originY: finalY,
          };
          bodyGestureRef.current = gesture;
        }
        const dLogical = (chartPt.logical ?? gesture.originLogical ?? 0) - (gesture.originLogical ?? 0);
        const dPrice = (chartPt.price ?? gesture.originPrice ?? 0) - (gesture.originPrice ?? 0);
        const dPixX = finalX - gesture.originX;
        const dPixY = finalY - gesture.originY;

        const shiftAnchor = (logical, price, time, frac, offMs, fx, fy) => {
          if (logical == null && fx == null) return { logical, price, time, frac, offMs, x: fx, y: fy };
          const baseLogical = logical ?? gesture.originLogical;
          const basePrice = price ?? gesture.originPrice;
          const nextLogical = baseLogical != null && Number.isFinite(dLogical) ? baseLogical + dLogical : baseLogical;
          const nextPrice = basePrice != null && Number.isFinite(dPrice) ? basePrice + dPrice : basePrice;
          // Time follows the shifted logical. Past the first/last bar the
          // time is left null on purpose so resolution falls back to the
          // extrapolated logical — sticking to the OLD bar time would freeze
          // that anchor and stretch the shape toward the drag direction.
          const resolvedTime = nextLogical != null ? (timeForLogical(nextLogical) ?? null) : time;
          const nextFrac = nextLogical != null ? fracForLogical(nextLogical) : (frac ?? 0);
          // offMs is re-derived from the new frac (frac × current bar size).
          // Carrying the stale value double-counts the sub-bar offset and
          // shears the shape a little more on every move.
          const nextOff = nextLogical != null && timeframeMs > 0 ? nextFrac * timeframeMs : 0;
          const proj = (nextLogical != null && nextPrice != null)
            ? chartToCoord(nextLogical, nextPrice, (fx ?? 0) + dPixX, (fy ?? 0) + dPixY)
            : { x: (fx ?? 0) + dPixX, y: (fy ?? 0) + dPixY };
          return { logical: nextLogical, price: nextPrice, time: resolvedTime, frac: nextFrac, offMs: nextOff, x: proj.x, y: proj.y };
        };

        setDrawings((prev) =>
          prev.map((d) => {
            const movingIds = mh === 'body' && Array.isArray(mids) && mids.includes(mid) ? mids : [mid];
            if (!movingIds.includes(d.id) || d.locked) return d;
            const drawingOrigin = snapshot.find((item) => item.id === d.id);
            if (!drawingOrigin) return d;
            // Any anchor list (brush, highlighter, polyline, patterns) moves as a unit
            if (Array.isArray(drawingOrigin.points) && drawingOrigin.points.length) {
              return {
                ...d,
                points: drawingOrigin.points.map((pt) => {
                  const s = shiftAnchor(pt.logical, pt.price, pt.time, pt.frac, pt.offMs, pt.x, pt.y);
                  return { x: s.x, y: s.y, logical: s.logical, price: s.price, time: s.time, frac: s.frac, offMs: s.offMs, tf: pt.tf ?? interval };
                }),
              };
            }
            if (drawingOrigin.startLogical != null || drawingOrigin.startX != null) {
              const s = shiftAnchor(drawingOrigin.startLogical, drawingOrigin.startPrice, drawingOrigin.startTime, drawingOrigin.startFrac, drawingOrigin.startOffMs, drawingOrigin.startX, drawingOrigin.startY);
              const ePt = shiftAnchor(drawingOrigin.endLogical, drawingOrigin.endPrice, drawingOrigin.endTime, drawingOrigin.endFrac, drawingOrigin.endOffMs, drawingOrigin.endX, drawingOrigin.endY);
              return {
                ...d,
                startX: s.x,
                startY: s.y,
                startLogical: s.logical,
                startPrice: s.price,
                startTime: s.time,
                startFrac: s.frac,
                startOffMs: s.offMs,
                endX: ePt.x,
                endY: ePt.y,
                endLogical: ePt.logical,
                endPrice: ePt.price,
                endTime: ePt.time,
                endFrac: ePt.frac,
                endOffMs: ePt.offMs,
                targetPrice: d.targetPrice != null && Number.isFinite(dPrice) ? drawingOrigin.targetPrice + dPrice : d.targetPrice,
                stopPrice: d.stopPrice != null && Number.isFinite(dPrice) ? drawingOrigin.stopPrice + dPrice : d.stopPrice,
              };
            }
            return d;
          })
        );
        return;
      }
      return;
    }

    // ── Active drawing in progress ──
    if (!misDrawing || !mdraw) return;
    const cursorAnchor = toAnchor(finalX, finalY, { logical: chartPt.logical, price: chartPt.price, time: moveTime, frac: moveFrac });

    // Click-to-place preview: preview follows the cursor after the placed anchors
    if (mdraw.pending) {
      if (mdraw.legacyPending) {
        setCurrentDraw((prev) => prev && ({
          ...prev,
          endX: cursorAnchor.x,
          endY: cursorAnchor.y,
          endLogical: cursorAnchor.logical,
          endPrice: cursorAnchor.price,
          endTime: cursorAnchor.time,
          endFrac: cursorAnchor.frac,
          endOffMs: cursorAnchor.offMs,
        }));
        return;
      }
      setCurrentDraw((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          points: [...mpending, { ...cursorAnchor }],
        };
      });
      return;
    }

    // 2-anchor extended drag: move the second anchor (never append — the pair
    // stays exactly [start, cursor] so commit is a straight pass-through).
    if (mdraw.dragAnchor && Array.isArray(mdraw.points)) {
      const cursor = { ...cursorAnchor };
      setCurrentDraw((prev) => {
        if (!prev || !Array.isArray(prev.points)) return prev;
        const first = prev.points[0];
        // Skip sub-pixel jitter so hovering still doesn't re-render the layer.
        if (first && Math.abs(cursor.x - first.x) < 1 && Math.abs(cursor.y - first.y) < 1) return prev;
        return { ...prev, points: [first, cursor] };
      });
      return;
    }

    // Freehand strokes (brush / highlighter) grow while the pointer moves.
    // A 3px min-distance stops point-per-event explosion (the old code appended
    // on every mousemove event, ballooning the array and re-rendering the whole
    // layer each time); long strokes are decimated so arrays stay bounded.
    if (isFreehandType(mdraw.type) && Array.isArray(mdraw.points)) {
      const cursor = { ...cursorAnchor };
      setCurrentDraw((prev) => {
        if (!prev) return prev;
        const pts = prev.points || [];
        const last = pts[pts.length - 1];
        if (last) {
          const dx = cursor.x - last.x;
          const dy = cursor.y - last.y;
          if (dx * dx + dy * dy < 9) return prev;
        }
        let next = [...pts, cursor];
        if (next.length > 1200) next = next.filter((_, i) => i % 2 === 0 || i === next.length - 1);
        return { ...prev, points: next };
      });
      return;
    }

    // Any other points-based in-progress shape: spec decides update vs append
    // so a 2-anchor tool can never silently become a freehand stroke.
    if (Array.isArray(mdraw.points)) {
      const drawSpec = getToolSpec(mdraw.type);
      if (drawSpec && drawSpec.points === 2) {
        const cursor = { ...cursorAnchor };
        setCurrentDraw((prev) => {
          const base = Array.isArray(prev.points) && prev.points.length ? prev.points : [cursor];
          return { ...prev, points: [base[0], cursor] };
        });
      } else {
        setCurrentDraw((prev) => ({
          ...prev,
          points: [...(prev.points || []), { ...cursorAnchor }],
        }));
      }
    } else {
      setCurrentDraw((prev) => {
        if (!prev) return prev;
        // Skip no-op updates (e.g. coalesced duplicate frame) entirely.
        if (prev.endX === finalX && prev.endY === finalY) return prev;
        return {
          ...prev,
          endX: finalX,
          endY: finalY,
          endLogical: chartPt.logical,
          endPrice: chartPt.price,
          endTime: moveTime,
          endFrac: moveFrac,
          endOffMs: moveOffMs,
        };
      });
    }
}
