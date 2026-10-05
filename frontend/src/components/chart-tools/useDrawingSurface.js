import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

// --- surface sizing & inline text editing ---

export function useDrawingSurface(ctx) {
  const {
    chartReady, drawingsRef, hideAllDrawings, isOpen, mainPaneRef, saveDrawingsWithHistory,
    setSelectedDrawingId, setSurfaceSize, setTextEdit, setTextEditVal, svgRectRef, svgRef,
    textEdit, textEditVal,
  } = ctx;

  // Pane-locked overlay geometry: the SVG is sized to the main price pane
  // (not the whole terminal column), so its pixel space matches
  // logicalToCoordinate / priceToCoordinate 1:1 on every scroll/zoom frame.
  // Falls back to measuring the SVG itself when the pane ref isn't wired yet.
  const [paneHeight, setPaneHeight] = useState(null);
  useEffect(() => {
    const target = mainPaneRef?.current || svgRef.current;
    if (!target) return undefined;
    const measure = () => {
      const rect = target.getBoundingClientRect();
      setSurfaceSize({ width: rect.width, height: rect.height });
      if (mainPaneRef?.current) setPaneHeight(rect.height);
      else setPaneHeight(null);
      // Keep the move-handler's cached layout rect fresh on resize/reopen.
      try {
        const svgRect = svgRef.current?.getBoundingClientRect();
        const base = svgRect || rect;
        svgRectRef.current = {
          left: base.left, top: base.top,
          width: base.width, height: base.height,
          measuredAt: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
        };
      } catch (_) {}
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measure);
      observer.observe(target);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isOpen, hideAllDrawings, chartReady, mainPaneRef, setSurfaceSize, svgRectRef, svgRef]);

  /** Inline text editing for annotation tools (callout / note / price label / flag / pin). */
  const TEXT_EDITABLE_TYPES = new Set(['callout', 'note', 'price_label', 'price_note', 'flag', 'pin', 'text']);

  const beginTextEdit = useCallback((drawing) => {
    if (!drawing) return;
    setTextEdit({ id: drawing.id });
    setTextEditVal(drawing.text || '');
    setSelectedDrawingId(drawing.id);
  }, [setSelectedDrawingId, setTextEdit, setTextEditVal]);

  const commitTextEdit = useCallback(() => {
    if (!textEdit) return;
    const value = textEditVal.trim();
    if (value) {
      saveDrawingsWithHistory(
        drawingsRef.current.map((d) => (d.id === textEdit.id ? { ...d, text: value } : d)),
        true,
      );
      toast.success('Text updated');
    }
    setTextEdit(null);
    setTextEditVal('');
  }, [textEdit, textEditVal, saveDrawingsWithHistory, drawingsRef, setTextEdit, setTextEditVal]);

  const handleShapeDoubleClick = useCallback((event, drawing) => {
    if (event?.stopPropagation) event.stopPropagation();
    if (event?.preventDefault) event.preventDefault();
    if (drawing && TEXT_EDITABLE_TYPES.has(drawing.type)) {
      beginTextEdit(drawing);
    } else {
      setSelectedDrawingId(drawing?.id ?? null);
    }
  }, [beginTextEdit, setSelectedDrawingId]);
  return { commitTextEdit, handleShapeDoubleClick, paneHeight };
}
