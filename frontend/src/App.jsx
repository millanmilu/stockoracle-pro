import React, { useState, lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store/useStore';
import TradeOneNavbar from './components/TradeOneNavbar';
import WatchlistDrawer from './components/WatchlistDrawer';
import RightToolRail from './components/RightToolRail';
import Dashboard from './components/Dashboard';
import LiveChartView from './components/LiveChartView';
import ErrorBoundary from './components/ErrorBoundary';

const MultiChartGrid = lazy(() => import('./components/MultiChartGrid'));
const NewsPanel = lazy(() => import('./components/NewsPanel'));
const PatternsPanel = lazy(() => import('./components/PatternsPanel'));
const LevelsPanel = lazy(() => import('./components/LevelsPanel'));
const VolatilityPanel = lazy(() => import('./components/VolatilityPanel'));
const MonteCarlo = lazy(() => import('./components/MonteCarlo'));
const BacktestPanel = lazy(() => import('./components/BacktestPanel'));
const AIInsightCard = lazy(() => import('./components/AIInsightCard'));
const ScenarioSimulator = lazy(() => import('./components/ScenarioSimulator'));
const PriceAlerts = lazy(() => import('./components/PriceAlerts'));
const SentimentDashboard = lazy(() => import('./components/SentimentDashboard'));
const AdvancedScreener = lazy(() => import('./components/AdvancedScreener'));
const MarketHeatmap = lazy(() => import('./components/MarketHeatmap'));
const MacroPanel = lazy(() => import('./components/MacroPanel'));
const SupplyChainPanel = lazy(() => import('./components/SupplyChainPanel'));
const AIChatPanel = lazy(() => import('./components/AIChatPanel'));
const FundamentalsPanel = lazy(() => import('./components/FundamentalsPanel'));
const EarningsPanel = lazy(() => import('./components/EarningsPanel'));
const OptionsChainView = lazy(() => import('./components/OptionsChainView'));
const PaperTradingView = lazy(() => import('./components/PaperTradingView'));

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
      <div className="spinner" />
    </div>
  );
}

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
  const [showWatchlist, setShowWatchlist] = useState(false);

  const renderView = () => {
    switch (activeView) {
      case 'Live Chart':        return <LiveChartView />;
      case 'Chart Grid':        return <Suspense fallback={<LoadingFallback />}><MultiChartGrid /></Suspense>;
      case 'Dashboard':         return <Dashboard />;
      case 'Paper Trading':     return <Suspense fallback={<LoadingFallback />}><PaperTradingView /></Suspense>;
      case 'AI Prediction':     return <Suspense fallback={<LoadingFallback />}><AIPredictionView /></Suspense>;
      case 'AI Chat':           return <Suspense fallback={<LoadingFallback />}><AIChatPanel ticker={selectedSymbol} /></Suspense>;
      case 'News':              return <Suspense fallback={<LoadingFallback />}><NewsPanel ticker={selectedSymbol} /></Suspense>;
      case 'Patterns':          return <Suspense fallback={<LoadingFallback />}><PatternsPanel ticker={selectedSymbol} /></Suspense>;
      case 'Levels':            return <Suspense fallback={<LoadingFallback />}><LevelsPanel ticker={selectedSymbol} /></Suspense>;
      case 'Volatility':        return <Suspense fallback={<LoadingFallback />}><VolatilityPanel ticker={selectedSymbol} /></Suspense>;
      case 'Monte Carlo':       return <Suspense fallback={<LoadingFallback />}><MonteCarlo ticker={selectedSymbol} /></Suspense>;
      case 'Backtest':          return <Suspense fallback={<LoadingFallback />}><BacktestPanel ticker={selectedSymbol} /></Suspense>;
      case 'Price Alerts':      return <Suspense fallback={<LoadingFallback />}><PriceAlerts /></Suspense>;
      case 'Sentiment':         return <Suspense fallback={<LoadingFallback />}><SentimentDashboard /></Suspense>;
      case 'Adv. Screener':     return <Suspense fallback={<LoadingFallback />}><AdvancedScreener /></Suspense>;
      case 'Heatmap':           return <Suspense fallback={<LoadingFallback />}><MarketHeatmap /></Suspense>;
      case 'Macro Data':        return <Suspense fallback={<LoadingFallback />}><MacroPanel /></Suspense>;
      case 'Supply Chain':      return <Suspense fallback={<LoadingFallback />}><SupplyChainPanel /></Suspense>;
      case 'Fundamentals':      return <Suspense fallback={<LoadingFallback />}><FundamentalsPanel ticker={selectedSymbol} /></Suspense>;
      case 'Earnings':          return <Suspense fallback={<LoadingFallback />}><EarningsPanel ticker={selectedSymbol} /></Suspense>;
      case 'Options Chain':     return <Suspense fallback={<LoadingFallback />}><OptionsChainView ticker={selectedSymbol} /></Suspense>;
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


