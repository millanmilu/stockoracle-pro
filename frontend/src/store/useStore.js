import { create } from 'zustand';

const useStore = create((set) => ({
  selectedSymbol: 'RELIANCE',
  predictionData: null,
  trainingStatus: null,
  theme: 'dark',
  activeView: 'Dashboard', // Dashboard, AI Prediction, News, Patterns, Levels, Volatility, Monte Carlo, Backtest
  
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setPredictionData: (data) => set({ predictionData: data }),
  setTrainingStatus: (status) => set({ trainingStatus: status }),
  setTheme: (theme) => set({ theme }),
  setActiveView: (view) => set({ activeView: view })
}));

export default useStore;
