import React from 'react';
import OscillatorPane from '../chart/OscillatorPane';

/**
 * OscillatorPanes — the synchronized dynamic oscillator sub-panes stacked
 * under the main chart (RSI, MACD, Stoch, CCI, …). Pane refs are registered
 * through `oscPaneRefs` so range/crosshair sync can address each pane.
 */
export default function OscillatorPanes({
  activeOscillators,
  resolveDefinition,
  chartCandles,
  hiddenIndicators,
  oscPaneRefs,
  onToggleHide,
  onClose,
  onVisibleRangeChange,
  onCrosshairMove,
}) {
  return (
    <>
      {/* Synchronized Dynamic Oscillator Sub-Panes */}
      {activeOscillators.map((osc) => {
        const resolved = resolveDefinition(osc);
        return (
          <OscillatorPane
            key={osc.id}
            ref={(el) => {
              const key = osc.oscType || osc.id;
              if (el) {
                oscPaneRefs.current[key] = el;
              } else {
                delete oscPaneRefs.current[key];
              }
            }}
            oscType={osc.oscType || osc.id}
            definition={resolved}
            candles={chartCandles}
            isHidden={hiddenIndicators.includes(osc.id)}
            onToggleHide={() => onToggleHide(osc.id)}
            onClose={() => onClose(osc.id)}
            onVisibleRangeChange={onVisibleRangeChange}
            onCrosshairMove={onCrosshairMove}
          />
        );
      })}
    </>
  );
}
