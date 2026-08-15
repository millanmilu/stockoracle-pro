/**
 * Centralized axios instance for StockOracle Pro.
 * Injects X-API-Key header (if VITE_API_KEY is set) and standardizes
 * the base URL and timeout across all requests.
 */
import axios from 'axios';

export const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    // If hosted on AWS Amplify (cross-origin), point to backend domain
    if (window.location.hostname.includes('amplifyapp.com')) {
      return 'https://stockoracle.duckdns.org';
    }
    // For direct EC2, localhost (via Vite proxy), or custom domain, use same-origin relative URLs
    return '';
  }
  return 'http://localhost:8000';
};

const API_BASE = getApiBase();
const API_KEY  = import.meta.env.VITE_API_KEY  || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
  },
});

export default api;
