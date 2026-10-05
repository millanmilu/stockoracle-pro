import React, { useRef } from 'react';
import DrawingSettingsModal from './DrawingSettingsModal';
import { saveDrawingSettings } from './drawingSettingsSchema';

// --- Drawing settings modal host (DrawingSettingsManager wiring) ---
//
// Owns the snapshot/restore + history + tool-default persistence around
// DrawingSettingsModal. Modal edits patch live (real-time preview); Cancel
// restores the snapshot WITHOUT a history entry, Apply commits one entry.

const ACTIVE_STYLE_KEY = 'so_active_draw_style';

export function DrawingSettingsHost({
  drawings, drawingSettingsId, drawingsRef, saveDrawingsWithHistory, setDrawingSettingsId,
  timeForLogical, timeframeMs,
  magnetMode, onMagnetChange, onBringToFront, onSendToBack,
  mainPaneRef,
}) {
        const initialDrawingsRef = useRef(null);
        const initialIdRef = useRef(null);
        if (initialIdRef.current !== drawingSettingsId) {
          initialIdRef.current = drawingSettingsId;
          initialDrawingsRef.current = drawingsRef.current;
        }
        const target = drawings.find((d) => d.id === drawingSettingsId);
        if (!target) return null;
        const closeSettings = ({ cancel = false } = {}) => {
          if (cancel) {
            saveDrawingsWithHistory(initialDrawingsRef.current, false);
          } else {
            saveDrawingsWithHistory(drawingsRef.current, true, initialDrawingsRef.current);
          }
          setDrawingSettingsId(null);
        };
        const patchTarget = (patch, opts) => {
          if (opts?.reset) {
            // Reset keeps identity + anchors, drops styling customizations.
            const keep = { id: target.id, type: target.type };
            if (Array.isArray(target.points)) keep.points = target.points;
            ['startLogical', 'startPrice', 'startTime', 'startFrac', 'startOffMs', 'startX', 'startY',
             'endLogical', 'endPrice', 'endTime', 'endFrac', 'endOffMs', 'endX', 'endY', 'tf'].forEach((k) => {
              if (target[k] !== undefined) keep[k] = target[k];
            });
            const updated = drawingsRef.current.map((d) => (d.id === drawingSettingsId ? keep : d));
            saveDrawingsWithHistory(updated, false);
            return;
          }
          const updated = drawingsRef.current.map((d) => (d.id === drawingSettingsId ? { ...d, ...patch } : d));
          saveDrawingsWithHistory(updated, false);
        };
        const applyToSameType = (patch) => {
          const updated = drawingsRef.current.map((d) => (d.type === target.type ? { ...d, ...patch } : d));
          saveDrawingsWithHistory(updated, false);
        };
        const saveAsDefault = (patch) => {
          saveDrawingSettings({ toolDefaults: { [target.type]: patch } });
          // Keep the "last-used style" (new drawings) coherent with the saved
          // default for the core line keys.
          try {
            const prev = JSON.parse(localStorage.getItem(ACTIVE_STYLE_KEY) || '{}');
            const next = { ...prev };
            if (patch.color) next.color = patch.color;
            if (patch.strokeWidth) next.strokeWidth = patch.strokeWidth;
            if (patch.lineStyle) next.lineStyle = patch.lineStyle;
            localStorage.setItem(ACTIVE_STYLE_KEY, JSON.stringify(next));
          } catch (_) {}
        };
        return (
          <DrawingSettingsModal
            drawing={target}
            onPatch={patchTarget}
            onApplyToSameType={applyToSameType}
            onSaveDefault={saveAsDefault}
            onClose={closeSettings}
            timeForLogical={timeForLogical}
            timeframeMs={timeframeMs}
            magnetMode={magnetMode}
            onMagnetChange={onMagnetChange}
            onBringToFront={onBringToFront ? () => onBringToFront(target.id) : undefined}
            onSendToBack={onSendToBack ? () => onSendToBack(target.id) : undefined}
            floating={computeFloating()}
          />
        );

        // Keep settings in a stable chart corner rather than covering or
        // following the drawing being edited.
        function computeFloating() {
          try {
            const pane = mainPaneRef?.current;
            const rect = pane?.getBoundingClientRect?.();
            if (!rect || rect.width <= 0) return null;
            const CARD_W = 320;
            const margin = 12;
            const vw = window.innerWidth || rect.right;
            const vh = window.innerHeight || rect.bottom;
            const width = Math.min(CARD_W, vw - margin * 2);
            const left = Math.max(margin, Math.min(rect.right - width - margin, vw - width - margin));
            const top = Math.max(margin, Math.min(rect.top + margin, vh - 220));
            const maxHeight = Math.max(
              180,
              Math.min(560, vh - top - margin, rect.bottom - top - margin),
            );
            return { top, left, maxHeight };
          } catch (_) {
            return null;
          }
        }
}
