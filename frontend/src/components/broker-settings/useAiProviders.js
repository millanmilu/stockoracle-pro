import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { API_BASE, AI_PROVIDERS_META } from './brokerConstants';
import { readApiResponse } from './brokerHelpers';

export default function useAiProviders() {
  // ── Multi-AI Providers State ──
  const [selectedAiProvider, setSelectedAiProvider] = useState('gemini');
  const [aiData, setAiData] = useState({ active_provider: 'gemini', providers: [] });
  const [aiKeysInput, setAiKeysInput] = useState({});
  const [aiSelectedModels, setAiSelectedModels] = useState({});
  const [aiTesting, setAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);
  const [aiSaving, setAiSaving] = useState(false);
  const [aiRefreshing, setAiRefreshing] = useState(false);

  /* Fetch AI Providers info */
  const fetchAiProviders = useCallback(async (showToast = false) => {
    setAiRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers`);
      const data = await readApiResponse(res, 'Could not load AI provider settings.');
      setAiData(data);
      if (data.providers) {
        const modMap = {};
        data.providers.forEach(p => {
          modMap[p.id] = p.selected_model || p.default_model;
        });
        setAiSelectedModels(prev => ({ ...modMap, ...prev }));
      }
    } catch (error) {
      if (showToast) toast.error(error.message || 'Could not load AI provider settings.');
      else console.error('AI providers fetch failed:', error);
    } finally {
      setAiRefreshing(false);
    }
  }, []);

  /* ── AI Provider Actions ── */

  /* Auto-detect provider when user pastes an API key into AI tab */
  const handleAiKeyChange = (val) => {
    setAiKeysInput(prev => ({ ...prev, [selectedAiProvider]: val }));
    const trimmed = val.trim();
    for (const p of AI_PROVIDERS_META) {
      if (p.regex.test(trimmed)) {
        if (selectedAiProvider !== p.id) {
          setSelectedAiProvider(p.id);
          setAiSelectedModels(m => ({ ...m, [p.id]: p.defaultModel }));
          setAiKeysInput(prev => ({ ...prev, [p.id]: trimmed }));
          toast.success(`Auto-detected ${p.name} API Key!`, { icon: p.logo });
        }
        break;
      }
    }
  };

  const handleTestAi = async () => {
    const rawKey = (aiKeysInput[selectedAiProvider] || '').trim();
    setAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAiProvider,
          api_key: rawKey,
          model: aiSelectedModels[selectedAiProvider],
        }),
      });
      const data = await readApiResponse(res, 'AI provider connection test failed.');
      setAiTestResult(data);
      if (data.success) {
        toast.success(data.message || 'Connected successfully!');
      } else {
        toast.error(data.message || 'Connection failed.');
      }
      fetchAiProviders();
    } catch (error) {
      const result = { success: false, message: error.message || 'Network error testing AI provider.' };
      setAiTestResult(result);
      toast.error(result.message);
    } finally {
      setAiTesting(false);
    }
  };

  const handleSaveAi = async (activateNow = false) => {
    const rawKey = (aiKeysInput[selectedAiProvider] || '').trim();
    setAiSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedAiProvider,
          api_key: rawKey,
          model: aiSelectedModels[selectedAiProvider],
          is_active: activateNow,
        }),
      });
      const data = await readApiResponse(res, 'Could not save AI provider settings.');
      if (data.success) {
        toast.success(data.message);
        setAiKeysInput(prev => ({ ...prev, [selectedAiProvider]: '' }));
        fetchAiProviders();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message || 'Failed to save AI configuration.');
    } finally {
      setAiSaving(false);
    }
  };

  const handleActivateAi = async (pId) => {
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pId }),
      });
      const data = await readApiResponse(res, 'Could not activate AI provider.');
      if (data.success) {
        toast.success(data.message);
        fetchAiProviders();
      } else {
        toast.error(data.message || 'Could not activate AI provider.');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to activate AI provider.');
    }
  };

  const handleDeleteAi = async (pId) => {
    if (!window.confirm(`Delete encrypted credentials for ${pId.toUpperCase()}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/ai/providers/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: pId }),
      });
      const data = await readApiResponse(res, 'Could not delete AI provider credentials.');
      if (data.success) {
        toast.success(data.message);
        setAiKeysInput(prev => ({ ...prev, [pId]: '' }));
        fetchAiProviders();
      } else {
        toast.error(data.message || 'Could not delete AI provider credentials.');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to delete credentials.');
    }
  };

  return {
    selectedAiProvider,
    setSelectedAiProvider,
    aiData,
    aiKeysInput,
    aiSelectedModels,
    setAiSelectedModels,
    aiTesting,
    aiTestResult,
    aiSaving,
    aiRefreshing,
    fetchAiProviders,
    handleAiKeyChange,
    handleTestAi,
    handleSaveAi,
    handleActivateAi,
    handleDeleteAi,
  };
}
