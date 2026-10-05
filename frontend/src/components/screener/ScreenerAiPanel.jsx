import React from 'react';
import { Sparkles, Play, RefreshCw } from 'lucide-react';
import { TN, panel, sectionTitle, btn, btnPrimary, btnGreen, input } from './terminalTheme';

// AI Screener panel — interpretation is always shown before anything is applied.
export function ScreenerAiPanel({ aiPrompt, setAiPrompt, aiLoading, aiPreview, setAiPreview, handleAiTranslate, applyAiPreview, setFormulaQuery, setQueryMode }) {
  return (
      <div style={panel({ padding: '7px 12px', display: 'flex', flexDirection: 'column', gap: 6, border: `1px solid rgba(167,139,250,0.25)` })}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, color: TN.ai, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, paddingTop: 7 }}>
            <Sparkles size={14} /> AI SCREENER
          </div>
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAiTranslate(false); } }}
            rows={2}
            placeholder="Find large-cap stocks with RSI below 40, price above EMA 200 and unusual volume…"
            aria-label="Describe the screen you want in plain English"
            style={input({ flex: 1, padding: '6px 10px', border: 'none', background: 'transparent', resize: 'none', lineHeight: 1.5 })}
          />
          <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
            <button onClick={() => handleAiTranslate(false)} disabled={aiLoading} style={btnPrimary({ opacity: aiLoading ? 0.6 : 1 })}>
              {aiLoading ? <RefreshCw size={12} className="tn-spin" /> : <Play size={12} />} Generate
            </button>
          </div>
        </div>
        {aiPreview && (
          <div style={{ background: TN.inset, border: `1px solid rgba(167,139,250,0.30)`, borderRadius: TN.radius, padding: '8px 10px', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 220, flex: 1 }}>
              <div style={sectionTitle({ color: TN.ai, marginBottom: 5 })}>AI interpretation</div>
              {(aiPreview.filters_preview || []).length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 11, marginBottom: 6 }}>
                  {aiPreview.filters_preview.map((f, i) => (
                    <React.Fragment key={i}>
                      <span style={{ color: TN.faint }}>{f.field}</span>
                      <span style={{ color: TN.text, fontFamily: TN.mono }}>{f.operator} {String(f.value)}</span>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 11, color: TN.muted, marginBottom: 6 }}>{aiPreview.explanation || 'No structured filters parsed.'}</div>
              )}
              {(aiPreview.unavailable_notes || []).map((n, i) => (
                <div key={i} style={{ fontSize: 11, color: TN.warn, marginBottom: 3 }}>{n}</div>
              ))}
              {!!(aiPreview.filters_preview || []).length && aiPreview.explanation && (
                <div style={{ fontSize: 11, color: TN.muted, marginBottom: 6 }}>{aiPreview.explanation}</div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end', minWidth: 150 }}>
              <div style={{ fontSize: 11, color: TN.info, fontFamily: TN.mono, overflow: 'hidden', textOverflow: 'ellipsis' }} title={aiPreview.formula_query}>{aiPreview.formula_query}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={applyAiPreview} style={btnGreen()}>Apply Filters</button>
                <button onClick={() => { setFormulaQuery(aiPreview.formula_query); setQueryMode('formula'); }} style={btn()}>Modify</button>
                <button onClick={() => setAiPreview(null)} style={btn(false, { border: '1px solid transparent', background: 'transparent' })}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
