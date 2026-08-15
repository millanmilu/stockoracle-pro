import React from 'react';
import { PRESETS } from '../../constants/screenerConfig';

/**
 * 1-Click Quick Preset Filter Chips
 * @param {{ activePreset: string, onSelectPreset: (presetId: string) => void }} props
 */
export default function ScreenerPresets({ activePreset, onSelectPreset }) {
  return (
    <div className="screener-presets-bar">
      <span className="screener-preset-title">QUICK PRESETS:</span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`screener-preset-chip ${activePreset === p.id ? 'active' : ''}`}
          onClick={() => onSelectPreset(p.id)}
          title={p.description}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
