import React from 'react';
import useStore from '../store/useStore';
import { 
  LayoutDashboard, 
  BrainCircuit, 
  Newspaper, 
  TrendingUp, 
  BarChart3, 
  Activity, 
  Dices, 
  History,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard },
  { name: 'AI Prediction', icon: BrainCircuit },
  { name: 'News', icon: Newspaper },
  { name: 'Patterns', icon: TrendingUp },
  { name: 'Levels', icon: BarChart3 },
  { name: 'Volatility', icon: Activity },
  { name: 'Monte Carlo', icon: Dices },
  { name: 'Backtest', icon: History }
];

export default function Sidebar() {
  const { activeView, setActiveView, selectedSymbol, setTrainingStatus } = useStore();

  const handleRetrain = async () => {
    try {
      const { data } = await axios.post(`${import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org'}/api/stock/${selectedSymbol}/train`);
      toast.success(`Training started for ${selectedSymbol}`);
      
      // Start polling
      const interval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org'}/api/task/${data.task_id}/status`);
          setTrainingStatus(statusRes.data);
          
          if (statusRes.data.status === 'completed') {
            clearInterval(interval);
            toast.success(`Training Complete! MAPE: ${(statusRes.data.mape * 100).toFixed(2)}%`);
            setTrainingStatus(null); // Clear progress bar
          } else if (statusRes.data.status === 'failed') {
            clearInterval(interval);
            toast.error('Training failed!');
            setTrainingStatus(null);
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 2000);
      
    } catch (err) {
      toast.error('Failed to start training');
    }
  };

  return (
    <div style={{ width: '220px', height: '100vh', backgroundColor: '#1a1a1a', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '20px', fontSize: '1.2rem', fontWeight: 'bold', color: '#0ea5e9' }}>
        StockOracle Pro
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px', padding: '10px' }}>
        {NAV_ITEMS.map(item => (
          <div 
            key={item.name}
            onClick={() => setActiveView(item.name)}
            style={{
              padding: '10px 15px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: activeView === item.name ? '#fff' : '#888',
              backgroundColor: activeView === item.name ? '#333' : 'transparent',
              transition: 'all 0.2s'
            }}
          >
            <item.icon size={20} />
            <span>{item.name}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '20px', borderTop: '1px solid #333' }}>
        <button 
          onClick={handleRetrain}
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#0ea5e9',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <RefreshCw size={18} />
          Retrain AI
        </button>
      </div>
    </div>
  );
}
