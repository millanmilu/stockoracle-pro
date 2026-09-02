import React, { useState, lazy, Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import useStore from './store/useStore';
import Dashboard from './components/Dashboard';
import LiveChartView from './components/LiveChartView';
import ErrorBoundary from './components/ErrorBoundary';

import ProTopBar from './components/ProTopBar';
import ProSidebar from './components/ProSidebar';
import ProRightPanel from './components/ProRightPanel';

import KeymapModal from './components/KeymapModal';
import CommandPalette from './components/terminal/CommandPalette';

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
const OptionsChainView = lazy(() => import('./components/OptionsChainView'));
const PaperTradingView = lazy(() => import('./components/PaperTradingView'));

const ValuationTerminalView = lazy(() => import('./components/terminal/ValuationTerminalView'));
const RRGRotationView = lazy(() => import('./components/terminal/RRGRotationView'));
const OptionsStrategyLabView = lazy(() => import('./components/terminal/OptionsStrategyLabView'));
const MacroTerminalView = lazy(() => import('./components/terminal/MacroTerminalView'));
const QuantRiskCockpit = lazy(() => import('./components/terminal/QuantRiskCockpit'));
const MultiTileWorkspace = lazy(() => import('./components/terminal/MultiTileWorkspace'));
const TechnicalLabView = lazy(() => import('./components/terminal/TechnicalLabView'));
const OptionsLabView = lazy(() => import('./components/terminal/OptionsLabView'));
const MarketIntelligenceView = lazy(() => import('./components/terminal/MarketIntelligenceView'));
const SentimentTAView = lazy(() => import('./components/SentimentTAView'));
const BrokerSettingsView = lazy(() => import('./components/BrokerSettingsView'));


function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300 }}>
      <div className="spinner" />
    </div>
  );
}

function AIPredictionView() {
  return (
    <div style={{ padding: 'clamp(14px, 2.5vw, 24px)', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1600px', margin: '0 auto', width: '100%' }}>
      <AIInsightCard />
      <ScenarioSimulator />
    </div>
  );
}

export default function App() {
  const activeView = useStore(s => s.activeView);
  const trainingStatus = useStore(s => s.trainingStatus);
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showKeymapModal, setShowKeymapModal] = useState(false);

  // Global Keyboard Listener for / or Ctrl+K (Command Palette) and ? (Keymap)
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
      } else if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowCommandPalette(true);
      } else if ((e.key === '?' || (e.shiftKey && e.key === '/')) && !isInput) {
        e.preventDefault();
        setShowKeymapModal(prev => !prev);
      } else if (e.key === 'Escape') {
        setShowCommandPalette(false);
        setShowKeymapModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderView = () => {
    switch (activeView) {
      case 'Technical Lab':     return <Suspense fallback={<LoadingFallback />}><TechnicalLabView /></Suspense>;
      case 'Options Lab':       return <Suspense fallback={<LoadingFallback />}><OptionsLabView /></Suspense>;
      case 'Market Intelligence': return <Suspense fallback={<LoadingFallback />}><MarketIntelligenceView /></Suspense>;

      // Aliases & Sub-View Routing for Unified Workspaces
      case 'Patterns':          return <Suspense fallback={<LoadingFallback />}><TechnicalLabView initialTab="patterns" /></Suspense>;
      case 'Levels':            return <Suspense fallback={<LoadingFallback />}><TechnicalLabView initialTab="levels" /></Suspense>;
      case 'Volatility':        return <Suspense fallback={<LoadingFallback />}><TechnicalLabView initialTab="volatility" /></Suspense>;
      case 'Options Chain':     return <Suspense fallback={<LoadingFallback />}><OptionsLabView initialTab="chain" /></Suspense>;
      case 'Options Strategy Lab': return <Suspense fallback={<LoadingFallback />}><OptionsLabView initialTab="strategy" /></Suspense>;
      case 'News':              return <Suspense fallback={<LoadingFallback />}><MarketIntelligenceView initialTab="news" /></Suspense>;
      case 'Sentiment':         return <Suspense fallback={<LoadingFallback />}><MarketIntelligenceView initialTab="sentiment" /></Suspense>;
      case 'Macro Data':        return <Suspense fallback={<LoadingFallback />}><MacroTerminalView initialTab="indicators" /></Suspense>;

      // Main Workspaces
      case 'Live Chart':        return <LiveChartView />;
      case 'Multi-Tile':        return <Suspense fallback={<LoadingFallback />}><MultiTileWorkspace /></Suspense>;
      case 'Chart Grid':        return <Suspense fallback={<LoadingFallback />}><MultiChartGrid /></Suspense>;
      case 'Dashboard':         return <Dashboard />;
      case 'Valuation':         return <Suspense fallback={<LoadingFallback />}><ValuationTerminalView ticker={selectedSymbol} /></Suspense>;
      case 'Sector Rotation':   return <Suspense fallback={<LoadingFallback />}><RRGRotationView /></Suspense>;
      case 'Macro Terminal':    return <Suspense fallback={<LoadingFallback />}><MacroTerminalView /></Suspense>;
      case 'Quant Risk Cockpit': return <Suspense fallback={<LoadingFallback />}><QuantRiskCockpit /></Suspense>;
      case 'Paper Trading':     return <Suspense fallback={<LoadingFallback />}><PaperTradingView /></Suspense>;
      case 'AI Prediction':     return <Suspense fallback={<LoadingFallback />}><AIPredictionView /></Suspense>;
      case 'AI Chat':           return <Suspense fallback={<LoadingFallback />}><AIChatPanel ticker={selectedSymbol} /></Suspense>;
      case 'Monte Carlo':       return <Suspense fallback={<LoadingFallback />}><MonteCarlo ticker={selectedSymbol} /></Suspense>;
      case 'Backtest':          return <Suspense fallback={<LoadingFallback />}><BacktestPanel ticker={selectedSymbol} /></Suspense>;
      case 'Price Alerts':      return <Suspense fallback={<LoadingFallback />}><PriceAlerts /></Suspense>;
      case 'Sentiment TA':      return <Suspense fallback={<LoadingFallback />}><MarketIntelligenceView initialTab="sentiment-ta" /></Suspense>;
      case 'Adv. Screener':     return <Suspense fallback={<LoadingFallback />}><AdvancedScreener /></Suspense>;
      case 'Heatmap':           return <Suspense fallback={<LoadingFallback />}><MarketHeatmap /></Suspense>;
      case 'Supply Chain':      return <Suspense fallback={<LoadingFallback />}><SupplyChainPanel /></Suspense>;
      case 'Fundamentals':
      case 'Earnings':          return <Suspense fallback={<LoadingFallback />}><FundamentalsPanel ticker={selectedSymbol} /></Suspense>;
      case 'Broker Settings':   return <Suspense fallback={<LoadingFallback />}><BrokerSettingsView initialTab="broker" /></Suspense>;
      case 'AI Providers':      return <Suspense fallback={<LoadingFallback />}><BrokerSettingsView initialTab="ai" /></Suspense>;
      default:                  return <LiveChartView />;
    }
  };


  return (
    <div className="app-shell" data-theme={theme}>
      <div className="scanline-overlay" />
      <Toaster position="top-right" toastOptions={{ style: { background: '#0F172A', color: '#F0F0FF', border: '1px solid rgba(99,102,241,0.3)' } }} />
      <CommandPalette isOpen={showCommandPalette} onClose={() => setShowCommandPalette(false)} />
      <KeymapModal isOpen={showKeymapModal} onClose={() => setShowKeymapModal(false)} />
      
      <ErrorBoundary>
        <ProTopBar 
          onToggleSidebar={() => setSidebarCollapsed(c => !c)}
          onToggleRight={() => setRightPanelOpen(r => !r)}
          onOpenCommandPalette={() => setShowCommandPalette(true)}
        />
      </ErrorBoundary>
      
      {trainingStatus && <TrainingBar trainingStatus={trainingStatus} selectedSymbol={selectedSymbol} />}
      
      <div className="app-body">
        <ErrorBoundary>
          <ProSidebar collapsed={sidebarCollapsed} onToggleCollapse={() => setSidebarCollapsed(c => !c)} />
        </ErrorBoundary>
        <main className="app-main">
          <ErrorBoundary key={activeView}>
            {renderView()}
          </ErrorBoundary>
        </main>
        {rightPanelOpen && (
          <ErrorBoundary>
            <ProRightPanel onClose={() => setRightPanelOpen(false)} />
          </ErrorBoundary>
        )}
      </div>
      
      <BottomStatusBar />
    </div>
  );
}

function TrainingBar({ trainingStatus, selectedSymbol }) {
  return <div style={{ backgroundColor:'rgba(15,23,42,0.95)', padding:'6px 20px', borderBottom:'1px solid rgba(99,102,241,0.25)', display:'flex', alignItems:'center', gap:15 }}>
    <div style={{ fontSize:'0.8rem', color:'#3B82F6', fontWeight:'bold' }}>Training AI Model for {trainingStatus.ticker || selectedSymbol}…</div>
    <div style={{ flex:1, height:4, background:'rgba(255,255,255,0.08)', borderRadius:2, overflow:'hidden' }}>
      <div style={{ width:`${trainingStatus.progress||0}%`, height:'100%', background:'#3B82F6', transition:'width 0.3s' }} />
    </div>
    <div style={{ fontSize:'0.72rem', color:'#9CA3AF', fontFamily:'JetBrains Mono,monospace' }}>{trainingStatus.progress||0}%</div>
  </div>;
}

function BottomStatusBar() {
  const wsConnected = useStore((s) => s.wsConnected);
  const wsLiveData  = useStore((s) => s.wsLiveData);
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  const ist = time.toLocaleString('en-IN', { timeZone:'Asia/Kolkata', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  const dayOfWeek = time.toLocaleDateString('en-IN', { timeZone:'Asia/Kolkata', weekday:'short' });
  const isWeekend = ['Sat','Sun'].includes(dayOfWeek);
  const hour = parseInt(ist.split(':')[0]);
  const min = parseInt(ist.split(':')[1]);
  const isMarketHours = !isWeekend && ((hour===9 && min>=15) || (hour>9 && hour<15) || (hour===15 && min<=30));
  const phase = isWeekend ? 'CLOSED (Weekend)' : isMarketHours ? 'MARKET OPEN' : 'MARKET CLOSED';
  const phaseColor = isMarketHours ? '#10B981' : '#F43F5E';

  const wsLabel = !wsConnected ? 'WS Reconnecting…'
    : wsLiveData ? 'WS Live'
    : 'Delayed (no live feed)';
  const wsColor = !wsConnected ? '#F59E0B'
    : wsLiveData ? '#10B981'
    : '#F59E0B';

  return (
    <div className="pro-status-bar">
      <span><span style={{color:phaseColor,fontWeight:700}}>●</span> {phase}</span>
      <span>NSE IST {ist}</span>
      <span style={{color: wsColor}}>
        ● {wsLabel}
      </span>
    </div>
  );
}
