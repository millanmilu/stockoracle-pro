import { TN, btn, btnGreen } from './terminalTheme';

const inputStyle = { display: 'block', width: '100%', marginTop: 4, background: TN.inset, border: `1px solid ${TN.borderStrong}`, borderRadius: TN.radius, padding: '6px 10px', color: TN.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' };

// Alert-from-screener modal (real smart-alerts API)
export function ScreenerAlertModal({ setShowAlertModal, alertDraft, setAlertDraft, handleCreateAlert }) {
  return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,4,10,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 260 }}>
        <div style={{ background: TN.panel, border: `1px solid ${TN.borderStrong}`, borderRadius: TN.radius, padding: 18, width: 380, maxWidth: '92vw' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TN.text, marginBottom: 4 }}>Create Alert</div>
          <div style={{ fontSize: 11, color: TN.faint, marginBottom: 12 }}>Evaluated by the backend scheduler. Examples: RSI crosses above 30, AI Score &gt; 80 with volume &gt; 2x.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 11, color: TN.muted }}>Ticker<input value={alertDraft.ticker} onChange={(e) => setAlertDraft({ ...alertDraft, ticker: e.target.value })} placeholder="RELIANCE" style={inputStyle} /></label>
            <label style={{ fontSize: 11, color: TN.muted }}>Condition
              <select value={alertDraft.type} onChange={(e) => setAlertDraft({ ...alertDraft, type: e.target.value })} style={inputStyle}>
                <option value="rsi_below">RSI crosses below</option>
                <option value="rsi_above">RSI crosses above</option>
                <option value="price_above">Price above</option>
                <option value="price_below">Price below</option>
                <option value="volume_spike">Volume spike ratio above</option>
              </select>
            </label>
            <label style={{ fontSize: 11, color: TN.muted }}>Threshold<input value={alertDraft.value} onChange={(e) => setAlertDraft({ ...alertDraft, value: e.target.value })} placeholder="30" style={inputStyle} /></label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={handleCreateAlert} style={btnGreen({ flex: 1, justifyContent: 'center' })}>Create Alert</button>
              <button onClick={() => setShowAlertModal(false)} style={btn()}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
  );
}
