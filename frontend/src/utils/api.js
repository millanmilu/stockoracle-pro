/**
 * Centralized axios instance for StockOracle Pro.
 * Injects X-API-Key header (if VITE_API_KEY is set) and standardizes
 * the base URL and timeout across all requests.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org';
const API_KEY  = import.meta.env.VITE_API_KEY  || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  },
});

export default api;
