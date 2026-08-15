import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store/useStore';
import TradeOneNavbar from './components/TradeOneNavbar';
import WatchlistDrawer from './components/WatchlistDrawer';
import RightToolRail from './components/RightToolRail';
import Dashboard from './components/Dashboard';
import LiveChartView from './components/LiveChartView';
import NewsPanel from './components/NewsPanel';
import PatternsPanel from './components/PatternsPanel';
import LevelsPanel from './components/LevelsPanel';
import VolatilityPanel from './components/VolatilityPanel';
import MonteCarlo from './components/MonteCarlo';
import BacktestPanel from './components/BacktestPanel';
import AIInsightCard from './components/AIInsightCard';
import ScenarioSimulator from './components/ScenarioSimulator';
import PriceAlerts from './components/PriceAlerts';
import ErrorBoundary from './components/ErrorBoundary';
import SentimentDashboard from './components/SentimentDashboard';
import AdvancedScreener from './components/AdvancedScreener';
import MarketHeatmap from './components/MarketHeatmap';
import MacroPanel from './components/MacroPanel';
import SupplyChainPanel from './components/SupplyChainPanel';

function AIPredictionView() {
  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <AIInsightCard />
      <ScenarioSimulator />
    </div>
  );
}

export default function App() {
  const { activeView, trainingStatus, selectedSymbol } = useStore();
  const [showWatchlist, setShowWatchlist] = useState(true);

  const renderView = () => {
    switch (activeView) {
      case 'Live Chart':        return <LiveChartView />;
      case 'Dashboard':         return <Dashboard />;
      case 'AI Prediction':     return <AIPredictionView />;
      case 'News':              return <NewsPanel ticker={selectedSymbol} />;
      case 'Patterns':          return <PatternsPanel ticker={selectedSymbol} />;
      case 'Levels':            return <LevelsPanel ticker={selectedSymbol} />;
      case 'Volatility':        return <VolatilityPanel ticker={selectedSymbol} />;
      case 'Monte Carlo':       return <MonteCarlo ticker={selectedSymbol} />;
      case 'Backtest':          return <BacktestPanel ticker={selectedSymbol} />;
      case 'Price Alerts':      return <PriceAlerts />;
      case 'Sentiment':         return <SentimentDashboard />;
      case 'Adv. Screener':     return <AdvancedScreener />;
      case 'Heatmap':           return <MarketHeatmap />;
      case 'Macro Data':        return <MacroPanel />;
      case 'Supply Chain':      return <SupplyChainPanel />;
      default:                  return <LiveChartView />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary, #04050E)',
      color: 'var(--text-primary, #F0F0FF)',
      overflow: 'hidden',
    }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#0F172A', color: '#F0F0FF', border: '1px solid rgba(99,102,241,0.3)' } }} />
      
      {/* ── Top Global TradeOne Navigation ── */}
      <TradeOneNavbar 
        showWatchlist={showWatchlist} 
        onToggleWatchlist={() => setShowWatchlist(!showWatchlist)} 
      />

      {/* ── Global Training Progress Bar ── */}
      {trainingStatus && (
        <div style={{
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          padding: '6px 20px',
          borderBottom: '1px solid rgba(99, 102, 241, 0.25)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: '15px',
        }}>
          <div style={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 'bold' }}>
            Training AI Model for {trainingStatus.ticker || selectedSymbol}&hellip;
          </div>
          <div style={{ flex: 1, height: '4px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${trainingStatus.progress || 0}%`, height: '100%', backgroundColor: '#3B82F6', transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: '0.72rem', color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace' }}>
            {trainingStatus.progress || 0}%
          </div>
        </div>
      )}

      {/* ── Terminal Body: Left Watchlist + Main Center Canvas + Right Tool Rail ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left Watchlist Drawer */}
        {showWatchlist && (
          <WatchlistDrawer onClose={() => setShowWatchlist(false)} />
        )}

        {/* Main Center Content Canvas */}
        <main style={{ flex: 1, height: '100%', overflowY: 'auto', position: 'relative', backgroundColor: '#090C18' }}>
          <ErrorBoundary key={activeView}>
            {renderView()}
          </ErrorBoundary>
        </main>

        {/* Right Tool Rail */}
        <RightToolRail onToggleWatchlist={() => setShowWatchlist(!showWatchlist)} />
      </div>
    </div>
  );
}


