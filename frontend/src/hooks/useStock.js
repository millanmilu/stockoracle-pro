import axios from 'axios'
import { useState, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || window.location.origin
const api = axios.create({ baseURL: API, timeout: 30000 })

export function useStock() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const fetchInfo = useCallback(async (ticker) => {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get(`/api/stock/${ticker}/info`)
      return data
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to fetch stock info')
      return null
    } finally { setLoading(false) }
  }, [])

  const fetchHistory = useCallback(async (ticker, timeframe = '3M') => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/history`, { params: { timeframe } })
      return data
    } catch (e) { return null }
  }, [])

  const fetchPredict = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/predict`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchMonteCarlo = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/montecarlo`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchAnomalies = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/anomalies`)
      return data
    } catch (e) { return [] }
  }, [])

  const fetchScreener = useCallback(async () => {
    try {
      const { data } = await api.get('/api/screener')
      return data
    } catch (e) { return [] }
  }, [])

  const startTraining = useCallback(async (ticker) => {
    try {
      const { data } = await api.post(`/api/train/${ticker}`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchTrainingStatus = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/train/${ticker}/status`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchBacktest = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/backtest`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchPatterns = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/patterns`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchLevels = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/levels`)
      return data
    } catch (e) { return null }
  }, [])

  const fetchVolatility = useCallback(async (ticker) => {
    try {
      const { data } = await api.get(`/api/stock/${ticker}/volatility`)
      return data
    } catch (e) { return null }
  }, [])

  const searchStock = useCallback(async (query) => {
    try {
      const { data } = await api.get(`/api/stock/search/${query.toUpperCase()}`)
      return data
    } catch (e) { return { found: false, ticker: query.toUpperCase(), name: query.toUpperCase() } }
  }, [])

  return {
    loading, error,
    fetchInfo, fetchHistory, fetchPredict, fetchMonteCarlo, fetchAnomalies,
    fetchScreener, fetchBacktest, fetchPatterns, fetchLevels, fetchVolatility,
    searchStock, startTraining, fetchTrainingStatus
  }
}
