import React from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store/useStore';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
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

  const renderView = () => {
    switch (activeView) {
      case 'Dashboard':         return <Dashboard />;
      case 'Live Chart':        return <LiveChartView />;
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
      default:                  return <Dashboard />;
    }
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      backgroundColor: 'var(--bg-primary, #04050E)',
      color: 'var(--text-primary, #F0F0FF)',
      overflow: 'hidden'
    }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#0F172A', color: '#F0F0FF', border: '1px solid rgba(99,102,241,0.3)' } }} />
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        <TopHeader />

        {/* Global Training Progress Bar */}
        {trainingStatus && (
          <div style={{
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: '8px 20px',
            borderBottom: '1px solid rgba(99, 102, 241, 0.25)',
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: '15px'
          }}>
            <div style={{ fontSize: '0.82rem', color: '#818CF8', fontWeight: 'bold' }}>
              Training AI for {trainingStatus.ticker || selectedSymbol}&hellip;
            </div>
            <div style={{ flex: 1, height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${trainingStatus.progress || 0}%`, height: '100%', backgroundColor: '#818CF8', transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'JetBrains Mono, monospace' }}>
              {trainingStatus.progress || 0}%
            </div>
          </div>
        )}

        {/* Scrollable Page Content Area */}
        <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          <ErrorBoundary key={activeView}>
            {renderView()}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

