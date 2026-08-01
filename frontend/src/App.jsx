import React from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store/useStore';
import Sidebar from './components/Sidebar';
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

// We create a temporary AI Prediction view housing the components
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
      case 'Dashboard': return <Dashboard />;
      case 'Live Chart': return <LiveChartView />;
      case 'AI Prediction': return <AIPredictionView />;
      case 'News': return <NewsPanel ticker={selectedSymbol} />;
      case 'Patterns': return <PatternsPanel ticker={selectedSymbol} />;
      case 'Levels': return <LevelsPanel ticker={selectedSymbol} />;
      case 'Volatility': return <VolatilityPanel ticker={selectedSymbol} />;
      case 'Monte Carlo': return <MonteCarlo ticker={selectedSymbol} />;
      case 'Backtest': return <BacktestPanel ticker={selectedSymbol} />;
      default: return <Dashboard />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#121212', color: '#fff' }}>
      <Toaster position="top-right" />
      <Sidebar />
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        
        {/* Global Training Progress Bar */}
        {trainingStatus && (
          <div style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', 
            backgroundColor: '#1e1e1e', padding: '10px 20px', 
            borderBottom: '1px solid #333', zIndex: 50,
            display: 'flex', alignItems: 'center', gap: '15px'
          }}>
            <div style={{ fontSize: '0.9rem', color: '#0ea5e9', fontWeight: 'bold' }}>
              Training AI...
            </div>
            <div style={{ flex: 1, height: '6px', backgroundColor: '#333', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${trainingStatus.progress}%`, height: '100%', backgroundColor: '#0ea5e9', transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {/* Content Area */}
        <div style={{ paddingTop: trainingStatus ? '40px' : '0' }}>
          {renderView()}
        </div>
      </div>
    </div>
  );
}
