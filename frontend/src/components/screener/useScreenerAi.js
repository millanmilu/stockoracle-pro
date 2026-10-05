import { useState } from 'react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

// AI natural query with preview/edit (state + translate/apply handlers).
export function useScreenerAi({ setFormulaQuery, setQueryMode, setActivePresetId, runScreen }) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // {formula_query, explanation, filters_preview, unavailable_notes, valid}

  // ── AI natural query with preview/edit ──
  const handleAiTranslate = async (applyImmediately = false) => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const { data } = await api.post('/api/screener/ai-parse', { prompt: aiPrompt });
      if (data.formula_query) {
        setAiPreview(data);
        if (applyImmediately || !data.filters_preview?.length) {
          setFormulaQuery(data.formula_query);
          setQueryMode('formula');
          setActivePresetId(null);
          runScreen(data.formula_query);
        }
        if ((data.unavailable_notes || []).length) {
          toast.error(data.unavailable_notes[0]);
        } else {
          toast.success(`AI Screen: ${data.formula_query}`);
        }
      } else {
        toast.error(data.parse_error || 'Could not generate formula.');
        setAiPreview(data);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'AI query error');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiPreview = () => {
    if (!aiPreview?.formula_query) return;
    setFormulaQuery(aiPreview.formula_query);
    setQueryMode('formula');
    setActivePresetId(null);
    runScreen(aiPreview.formula_query);
    setAiPreview(null);
  };

  return { aiPrompt, setAiPrompt, aiLoading, aiPreview, setAiPreview, handleAiTranslate, applyAiPreview };
}
