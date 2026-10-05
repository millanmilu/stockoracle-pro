import { useCallback, useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

// Modal state + async handlers: backtest, save/delete screen, alerts.
export function useScreenerModals({ queryMode, formulaQuery, activeFormula, universe, sortColumn, sortDirection, columnGroup, setSavedScreens }) {
  // Modals
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [screenName, setScreenName] = useState('');
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestResults, setBacktestResults] = useState(null);
  const [holdingDays, setHoldingDays] = useState(20);
  const [sttRate, setSttRate] = useState(0.001);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertDraft, setAlertDraft] = useState({ ticker: '', type: 'rsi_below', value: '30' });

  // ── Backtest (exact screen conditions, never modified silently) ──
  const handleRunBacktest = async () => {
    setShowBacktestModal(true);
    setBacktestLoading(true);
    const activeQuery = queryMode === 'formula' ? formulaQuery : activeFormula;
    try {
      const { data } = await api.post('/api/screener/backtest', { formula_query: activeQuery, holding_period_days: holdingDays, stt_rate: sttRate });
      setBacktestResults(data);
      toast.success('Historical screen backtest completed!');
    } catch (err) {
      toast.error('Screen backtest failed.');
    } finally {
      setBacktestLoading(false);
    }
  };

  // ── Save screen (filters + columns + sorting + universe) ──
  const handleSaveScreen = async () => {
    if (!screenName.trim()) { toast.error('Please enter a screen name.'); return; }
    try {
      const activeQuery = queryMode === 'formula' ? formulaQuery : activeFormula;
      // The backend already persists universe/sort_by/sort_dir and returns them
      // from GET /screener/screens. Previously they were smuggled into the
      // display name and never read back, so reopening a screen silently lost
      // its universe and ranking. "ALL NSE" is stored verbatim; the backend
      // resolves it to no scope (whole tracked table).
      await api.post('/api/screener/screens', {
        name: screenName.trim(),
        description: `Columns: ${columnGroup}`,
        formula_query: activeQuery,
        universe,
        sort_by: sortColumn,
        sort_dir: sortDirection === 'asc' ? 'ASC' : 'DESC',
        is_public: true,
      });
      toast.success('Screen saved successfully!');
      setShowSaveModal(false);
      setScreenName('');
      const res = await api.get('/api/screener/screens');
      setSavedScreens(res.data.saved_screens || []);
    } catch (err) {
      toast.error('Failed to save screen.');
    }
  };

  // Saved screens can be removed again (DELETE /screener/screens/{id} existed
  // but nothing in the UI ever called it).
  const handleDeleteScreen = async (screenId, name) => {
    try {
      await api.delete(`/api/screener/screens/${screenId}`);
      setSavedScreens((prev) => prev.filter((s) => s.id !== screenId));
      toast.success(`Deleted screen: ${name}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete screen.');
    }
  };

  // ── Alert from screener (real smart-alerts API) ──
  const handleCreateAlert = async () => {
    const { ticker, type, value } = alertDraft;
    if (!ticker.trim()) { toast.error('Enter a ticker for the alert.'); return; }
    const num = Number(value);
    if (!isFinite(num)) { toast.error('Enter a numeric threshold.'); return; }
    try {
      const param = type.startsWith('rsi') ? { threshold: num } : type.startsWith('volume') ? { ratio: num } : { threshold: num };
      await api.post('/api/smart-alerts', { ticker: ticker.toUpperCase().trim(), alert_type: type, param_value: param });
      toast.success(`Alert created: ${ticker.toUpperCase()} ${type} ${num}`);
      setShowAlertModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create alert');
    }
  };

  // Prefill the alert modal from a table row (submission still uses the real API)
  const handleAlertFor = useCallback((stock) => {
    const px = Math.round(Number(stock.close_price) || 0);
    setAlertDraft({ ticker: stock.ticker || '', type: 'price_above', value: px ? String(px) : '' });
    setShowAlertModal(true);
  }, []);

  return {
    showSaveModal, setShowSaveModal, screenName, setScreenName,
    showBacktestModal, setShowBacktestModal, backtestLoading, backtestResults, holdingDays, setHoldingDays, sttRate, setSttRate,
    showAlertModal, setShowAlertModal, alertDraft, setAlertDraft,
    handleRunBacktest, handleSaveScreen, handleDeleteScreen, handleCreateAlert, handleAlertFor,
  };
}
