import React, { useEffect, useState } from 'react';
import api from '../../utils/api';

export function useFundamentalsData(ticker) {
  const [dcfGrowthRate, setDcfGrowthRate] = useState(12.0); // %
  const [dcfWacc, setDcfWacc] = useState(11.5); // %
  const [dcfTerminalGrowth, setDcfTerminalGrowth] = useState(4.5); // %

  const [data, setData] = useState(null);
  const [deepData, setDeepData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Request-id guard: quick ticker switches must not let a stale response
  // overwrite the current ticker's state.
  const fetchSeqRef = React.useRef(0);

  const fetchData = async () => {
    const seq = ++fetchSeqRef.current;
    const alive = () => fetchSeqRef.current === seq;
    setLoading(true);
    setError(null);
    try {
      const [res1, res2] = await Promise.allSettled([
        api.get(`/api/stock/${ticker}/fundamentals`),
        api.get(`/api/stock/${ticker}/financials`)
      ]);
      if (!alive()) return;

      if (res1.status === 'fulfilled' && res1.value?.data) {
        setData(res1.value.data);
      }
      if (res2.status === 'fulfilled' && res2.value?.data) {
        setDeepData(res2.value.data);
        const histDcf = res2.value.data?.dcf_valuation;
        if (histDcf?.assumed_growth_rate_pct != null) {
          setDcfGrowthRate(histDcf.assumed_growth_rate_pct);
        }
        if (histDcf?.discount_rate_wacc_pct != null) {
          setDcfWacc(histDcf.discount_rate_wacc_pct);
        }
        if (histDcf?.terminal_growth_rate_pct != null) {
          setDcfTerminalGrowth(histDcf.terminal_growth_rate_pct);
        }
      }

      if (res1.status === 'rejected' && res2.status === 'rejected') {
        setError('Fundamental research data temporarily unavailable.');
      }
    } catch {
      if (!alive()) return;
      setError('Fundamental research data temporarily unavailable.');
    } finally {
      if (alive()) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [ticker]);

  return {
    dcfGrowthRate, setDcfGrowthRate,
    dcfWacc, setDcfWacc,
    dcfTerminalGrowth, setDcfTerminalGrowth,
    data, deepData, loading, error, fetchData,
  };
}
