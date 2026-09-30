// Pro Terminal V2 — Bottom Analytics Workspace

import React from 'react';
import { V2_COLORS, V2_BOTTOM_TABS } from '../utils/constants';
import V2Screener from './V2Screener';
import V2Fundamentals from './V2Fundamentals';
import V2AIAnalysis from './V2AIAnalysis';
import V2NewsPanel from './V2NewsPanel';
import V2MarketOverview from './V2MarketOverview';

export default function V2BottomTabs({
  activeTab,
  onTabChange,
  screenerFilters,
  onAddFilter,
  onRemoveFilter,
  screenerResults,
  fundamentals,
  aiAnalysis,
  news,
  marketIndices,
  sectors,
}) {
  return (
    <div style={{
      height: 280,
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
        {activeTab === 'screener' && (
          <V2Screener
            filters={screenerFilters}
            onAddFilter={onAddFilter}
            onRemoveFilter={onRemoveFilter}
            results={screenerResults}
          />
        )}
        {activeTab === 'financials' && <V2Fundamentals fundamentals={fundamentals} />}
        {activeTab === 'technicals' && (
          <div style={{ padding: 12, fontSize: 11, color: V2_COLORS.text.muted }}>
            Technical analysis view — coming soon
          </div>
        )}
        {activeTab === 'ai_analysis' && <V2AIAnalysis aiAnalysis={aiAnalysis} />}
        {activeTab === 'peers' && (
          <div style={{ padding: 12, fontSize: 11, color: V2_COLORS.text.muted }}>
            Peer comparison — coming soon
          </div>
        )}
        {activeTab === 'shareholding' && <V2Fundamentals fundamentals={fundamentals} />}
        {activeTab === 'corporate_actions' && <V2Fundamentals fundamentals={fundamentals} />}
        {activeTab === 'historical' && (
          <div style={{ padding: 12, fontSize: 11, color: V2_COLORS.text.muted }}>
            Historical data — coming soon
          </div>
        )}
        {activeTab === 'news' && <V2NewsPanel news={news} />}
        {activeTab === 'options' && (
          <div style={{ padding: 12, fontSize: 11, color: V2_COLORS.text.muted }}>
            Options chain — coming soon
          </div>
        )}
      </div>
    </div>
  );
}
