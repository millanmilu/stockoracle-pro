import ScreenerFilters from './ScreenerFilters';
import ScreenerFilterBuilder from './ScreenerFilterBuilder';
import { TN, panel, btn, btnGreen, input } from './terminalTheme';

// Filter drawer: sliders + builder + formula
export function ScreenerFilterDrawer({
  queryMode, setQueryMode, builderEnabled, setBuilderEnabled, handleResetFilters, runScreen, loading, setFiltersOpen,
  builderGroups, setBuilderGroups, builderTopLogic, setBuilderTopLogic,
  universe, setUniverse, handleUniverseChange, universeOptions,
  selectedSector, setSelectedSector, marketCapCat, setMarketCapCat,
  visualSetters, minRoce, minRoe, maxPe, maxPb, maxDebt, minSalesGrowth, minProfitGrowth, minRsi, maxRsi, minVolRatio, minAiScore,
  touchedFilters, activeChips, formulaQuery, setFormulaQuery,
}) {
  return (
      <div style={panel({ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, width: '100%', minWidth: 0, boxSizing: 'border-box' })}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {[['visual', 'Visual + Builder'], ['formula', 'Formula DSL']].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setQueryMode(id)} style={btn(queryMode === id)}>{label}</button>
          ))}
          <span style={{ flex: 1 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: TN.muted }}>
            <input type="checkbox" checked={builderEnabled} onChange={(e) => setBuilderEnabled(e.target.checked)} style={{ accentColor: '#7C8CF8' }} /> Advanced builder (AND/OR/NOT)
          </label>
          <button type="button" onClick={handleResetFilters} style={btn()}>Reset</button>
          <button type="button" onClick={() => runScreen()} disabled={loading} style={btnGreen({ opacity: loading ? 0.6 : 1 })}>{loading ? 'Running…' : 'Apply & Run'}</button>
          <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" style={{ background: 'transparent', border: 'none', color: TN.faint, cursor: 'pointer' }}>✕</button>
        </div>
        {queryMode === 'visual' ? (
          <>
            {builderEnabled ? (
              <ScreenerFilterBuilder groups={builderGroups} setGroups={setBuilderGroups} topLogic={builderTopLogic} setTopLogic={setBuilderTopLogic} />
            ) : (
              <ScreenerFilters
                universe={universe} setUniverse={setUniverse} onUniverseChange={handleUniverseChange}
                universeOptions={universeOptions}
                selectedSector={selectedSector} setSelectedSector={setSelectedSector}
                marketCapCat={marketCapCat} setMarketCapCat={setMarketCapCat}
                minRoce={minRoce} setMinRoce={visualSetters.setMinRoce}
                minRoe={minRoe} setMinRoe={visualSetters.setMinRoe}
                maxPe={maxPe} setMaxPe={visualSetters.setMaxPe}
                maxPb={maxPb} setMaxPb={visualSetters.setMaxPb}
                maxDebt={maxDebt} setMaxDebt={visualSetters.setMaxDebt}
                minSalesGrowth={minSalesGrowth} setMinSalesGrowth={visualSetters.setMinSalesGrowth}
                minProfitGrowth={minProfitGrowth} setMinProfitGrowth={visualSetters.setMinProfitGrowth}
                minRsi={minRsi} setMinRsi={visualSetters.setMinRsi}
                maxRsi={maxRsi} setMaxRsi={visualSetters.setMaxRsi}
                minVolRatio={minVolRatio} setMinVolRatio={visualSetters.setMinVolRatio}
                minAiScore={minAiScore} setMinAiScore={visualSetters.setMinAiScore}
                touchedFilters={touchedFilters}
                activeFilterCount={activeChips.length}
              />
            )}
          </>
        ) : (
          <div>
            <textarea value={formulaQuery} onChange={(e) => setFormulaQuery(e.target.value)} rows={3} style={input({ width: '100%', padding: '8px 10px', color: TN.info, fontFamily: TN.mono, fontSize: 12, boxSizing: 'border-box', resize: 'vertical' })} />
            <div style={{ fontSize: 11, color: TN.faint, marginTop: 4 }}>Whitelisted: ROCE ROE PE PB DebtToEquity MarketCap RSI14 VolumeRatio20D EMA ADX ATR BB Stoch CCI ROC Williams MACD Supertrend Structure Regime Breakout Confluence AIConsensus RsNifty Sentiment… Unavailable fields show “Data unavailable for this condition.”</div>
          </div>
        )}
      </div>
  );
}
