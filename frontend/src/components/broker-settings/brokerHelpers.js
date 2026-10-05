import toast from 'react-hot-toast';

/* Helper to sanitize payload and omit unedited masked values (Bug #2) */
  export const buildCleanPayload = (configs, dirtyFields, brokerId) => {
    const raw = configs[brokerId] || {};
    const dirty = dirtyFields[brokerId] || {};
    const clean = {};
    Object.entries(raw).forEach(([k, v]) => {
      if (v != null) {
        const strVal = String(v).trim();
        // If it was edited OR is not a masked placeholder
        if (dirty[k] || (!strVal.startsWith('••') && !strVal.includes('••••'))) {
          clean[k] = strVal;
        }
      }
    });
    return clean;
  };

  /* BUG #6 (HIGH): Input validation for all brokers */
  export const validateBrokerInputs = (bId, credsObj) => {
    if (bId === 'angel_one') {
      if (!credsObj.api_key || !credsObj.client_id || !credsObj.password || !credsObj.totp_secret) {
        toast.error('Please fill in all 4 Angel One fields.');
        return false;
      }
    } else if (bId === 'zerodha') {
      if (!credsObj.api_key || !credsObj.api_secret) {
        toast.error('Please fill in Zerodha API Key and Secret.');
        return false;
      }
    } else if (bId === 'upstox') {
      if (!credsObj.api_key || !credsObj.api_secret) {
        toast.error('Please fill in Upstox Client ID and API Secret.');
        return false;
      }
    } else if (bId === 'fyers') {
      if (!credsObj.app_id || !credsObj.secret_key) {
        toast.error('Please fill in Fyers App ID and Secret Key.');
        return false;
      }
    }
    return true;
  };

  // BUG #12 (LOW): Safe remaining minutes formatter
  export const formatRemaining = (mins) => {
    if (mins == null) return null;
    if (mins <= 0) return 'Expiring / Refreshing now';
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hrs > 0) return `${hrs}h ${rem}m remaining`;
    return `${rem}m remaining`;
  };

  export const readApiResponse = async (response, fallbackMessage) => {
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok) throw error;
      data = {};
    }
    if (!response.ok) {
      throw new Error(data?.detail || data?.message || `${fallbackMessage} (HTTP ${response.status})`);
    }
    return data;
  };
