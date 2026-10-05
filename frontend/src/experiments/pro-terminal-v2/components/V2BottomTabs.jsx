// Pro Terminal V2 — Bottom Analytics Workspace

import React from 'react';
import { V2_COLORS, V2_BOTTOM_TABS } from '../utils/constants';
import V2Screener from './V2Screener';
import V2Fundamentals from './V2Fundamentals';
import V2AIAnalysis from './V2AIAnalysis';
import V2NewsPanel from './V2NewsPanel';
import V2MarketOverview from './V2MarketOverview';
import {
  HistoricalTable,
  TechnicalReport,
  PeerComparison,
  OptionsChain,
  ShareholdingTable,
  CorporateActionsTable,
} from './V2BottomTabViews';

export default function V2BottomTabs({
  activeTab,
  onTabChange,
  screenerFilters,
  onAddFilter,
  onRemoveFilter,
  screenerResults,
  scanning,
  onScan,
  onSaveFilters,
  screenerSymbol,
  fundamentals,
  aiAnalysis,
  news,
  marketIndices,
  sectors,
  candles,
  technical,
  currentPrice,
  watchlist,
  onToggleWatchlist,
  onOpenSymbol,
}) {
  return (
    <div className="v2-bottomtabs" style={{
      background: V2_COLORS.bg.secondary,
      borderTop: `1px solid ${V2_COLORS.bg.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderBottom: `1px solid ${V2_COLORS.bg.border}`,
        overflowX: 'auto',
        flexShrink: 0,
      }}>
        {V2_BOTTOM_TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 600,
              color: activeTab === tab.id ? V2_COLORS.accent.primary : V2_COLORS.text.muted,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${V2_COLORS.accent.primary}` : '2px solid transparent',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'overview' && (
          <V2MarketOverview
            indices={marketIndices}
            sectors={sectors}
            watchlist={watchlist}
            onOpenSymbol={onOpenSymbol}
          />
        )}
        {activeTab === 'screener' && (
          <V2Screener
            filters={screenerFilters}
            onAddFilter={onAddFilter}
            onRemoveFilter={onRemoveFilter}
            results={screenerResults}
            scanning={scanning}
            onScan={onScan}
            onSaveFilters={onSaveFilters}
            onOpenSymbol={onOpenSymbol}
            watchlist={watchlist}
            onToggleWatchlist={onToggleWatchlist}
          />
        )}
        {activeTab === 'financials' && <V2Fundamentals fundamentals={fundamentals} />}
        {activeTab === 'technicals' && (
          <TechnicalReport technical={technical} symbol={screenerSymbol} />
        )}
        {activeTab === 'ai_analysis' && <V2AIAnalysis aiAnalysis={aiAnalysis} />}
        {activeTab === 'peers' && (
          <PeerComparison symbol={screenerSymbol} onOpenSymbol={onOpenSymbol} />
        )}
        {activeTab === 'shareholding' && <ShareholdingTable />}
        {activeTab === 'corporate_actions' && <CorporateActionsTable />}
        {activeTab === 'historical' && (
          <HistoricalTable candles={candles} symbol={screenerSymbol} />
        )}
        {activeTab === 'news' && <V2NewsPanel news={news} />}
        {activeTab === 'options' && (
          <OptionsChain price={currentPrice} symbol={screenerSymbol} />
        )}
      </div>
    </div>
  );
}
