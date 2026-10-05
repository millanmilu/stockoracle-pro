import React from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

export default function ChartCanvasOverlays({
  chartSettings,
  legendVisible,
  tk,
  selectedSymbol,
  interval,
  overlayIndicators,
  hiddenIndicators,
  indicatorValRefs,
  onToggleHideIndicator,
  onRemoveIndicator,
  openRef,
  highRef,
  lowRef,
  closeRef,
  chgRef,
  volRef,
  timeRef,
}) {
  return (
    <>
      {/* TradingView-style top-left OHLC legend (wired to the zero-latency DOM refs).
          Each field group is independently toggleable from Chart Settings → Status Line. */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          zIndex: 15,
          display: legendVisible ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'none',
          maxWidth: 'calc(100% - 90px)',
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        }}
      >
        <div style={{ display: chartSettings.showLegendTitle ? 'flex' : 'none', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: tk.legendText, letterSpacing: '0.01em' }}>
            {selectedSymbol}
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: tk.legendMuted }}>
            {String(interval || '').toUpperCase()}
          </span>
          <span ref={timeRef} style={{ fontSize: 11, color: tk.legendMuted }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ display: chartSettings.showOHLC ? undefined : 'none' }}>
            <span style={{ color: tk.legendMuted }}>O</span>
            <span ref={openRef} style={{ color: tk.legendText, fontWeight: 500, marginLeft: 3 }}>—</span>
            <span style={{ color: tk.legendMuted, marginLeft: 6 }}>H</span>
            <span ref={highRef} style={{ color: tk.legendText, fontWeight: 500, marginLeft: 3 }}>—</span>
            <span style={{ color: tk.legendMuted, marginLeft: 6 }}>L</span>
            <span ref={lowRef} style={{ color: tk.legendText, fontWeight: 500, marginLeft: 3 }}>—</span>
            <span style={{ color: tk.legendMuted, marginLeft: 6 }}>C</span>
            <span ref={closeRef} style={{ color: tk.legendText, fontWeight: 500, marginLeft: 3 }}>—</span>
          </span>
          <span ref={chgRef} style={{ fontWeight: 600, display: chartSettings.showBarChange ? undefined : 'none' }}>—</span>
          <span style={{ display: chartSettings.showVolumeLegend ? undefined : 'none' }}>
            <span style={{ color: tk.legendMuted }}>Vol</span>
            <span ref={volRef} style={{ color: tk.legendText, marginLeft: 3 }}>—</span>
          </span>
        </div>
      </div>
      {/* Active overlay indicator controls remain available over the chart. */}
      <div
        style={{
          position: 'absolute',
          top: legendVisible ? 62 : 8,
          left: 10,
          zIndex: 15,
          display: chartSettings.showIndicatorLegend ? 'flex' : 'none',
          flexDirection: 'column',
          gap: 2,
          pointerEvents: 'auto',
          maxWidth: 'calc(100% - 90px)',
        }}
      >
        {overlayIndicators.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {overlayIndicators.map((ind) => {
              const isHidden = hiddenIndicators.includes(ind.id);
              return (
                <div
                  key={ind.id}
                  className="tv-ind-row"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '1px 2px',
                    borderRadius: 0,
                    backgroundColor: 'transparent',
                    border: 0,
                    fontSize: 12,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, sans-serif",
                    color: isHidden ? '#787B86' : tk.legendText,
                    opacity: isHidden ? 0.55 : 1,
                  }}
                >
                  <div
                    style={{
                      width: 9,
                      height: 2,
                      borderRadius: 1,
                      backgroundColor: ind.color,
                      opacity: isHidden ? 0.4 : 1,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 500, color: isHidden ? '#787B86' : tk.legendMuted }}>
                    {ind.shortName}
                  </span>
                  <span
                    ref={(el) => {
                      if (el) indicatorValRefs.current[ind.id] = el;
                    }}
                    style={{
                      fontWeight: 500,
                      color: isHidden ? '#787B86' : ind.color,
                      minWidth: 30,
                    }}
                  >
                    —
                  </span>

                  {/* Hide / Show Eye Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleHideIndicator(ind.id);
                    }}
                    title={isHidden ? 'Show indicator' : 'Hide indicator'}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#787B86',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 2,
                      opacity: 0,
                    }}
                    className="tv-legend-action"
                    onMouseEnter={(e) => (e.currentTarget.style.color = tk.legendText)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#787B86')}
                  >
                    {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                  </button>

                  {/* Remove (X) Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveIndicator(ind.id);
                    }}
                    title="Remove indicator"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#787B86',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: 2,
                      opacity: 0,
                    }}
                    className="tv-legend-action"
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#EF5350')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#787B86')}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* TradingView-style symbol watermark (Chart Settings → Appearance) */}
      {chartSettings.showWatermark && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
          }}
        >
          <span
            style={{
              fontSize: 'clamp(48px, 14vw, 160px)',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: tk.legendText,
              opacity: 0.06,
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {selectedSymbol}
          </span>
        </div>
      )}
    </>
  );
}
