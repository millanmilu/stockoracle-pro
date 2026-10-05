import { useState, useCallback } from 'react';
import api from '../../utils/api';

/**
 * usePaperTrading — paper-trading account/positions state + fetcher for the
 * on-chart trade bar & docket. The visibility-guarded polling effect lives in
 * LiveChartView (it intentionally reuses that component's interval setter).
 */
export function usePaperTrading() {
  const [paperPositions, setPaperPositions] = useState([]);
  const [paperAccount, setPaperAccount] = useState(null);

  const fetchPaperData = useCallback(async () => {
    try {
      const [posRes, accRes] = await Promise.all([
        api.get('/api/paper/positions').catch(() => ({ data: [] })),
        api.get('/api/paper/account').catch(() => ({ data: null })),
      ]);
      setPaperPositions(Array.isArray(posRes.data) ? posRes.data : []);
      if (accRes.data) setPaperAccount(accRes.data);
    } catch {
      // ignore
    }
  }, []);

  return { paperPositions, paperAccount, fetchPaperData };
}
