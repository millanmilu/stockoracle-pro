// Pro Terminal V2 — Formatters
// Local to the experimental module. No external imports.

export function formatPrice(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  return `₹${Number(value).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatChange(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}`;
}

export function formatPercent(value, decimals = 2) {
  if (value == null || isNaN(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${Number(value).toFixed(decimals)}%`;
}

export function formatVolume(value) {
  if (value == null || isNaN(value)) return '—';
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('en-IN');
}

export function formatMarketCap(value) {
  if (value == null || isNaN(value)) return '—';
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)} LCr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)} Cr`;
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatLargeNumber(value) {
  if (value == null || isNaN(value)) return '—';
  if (value >= 10000000) return `${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `${(value / 100000).toFixed(2)} L`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString('en-IN');
}

export function formatTime(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '—';
  }
}

export function formatRelativeTime(date) {
  if (!date) return '—';
  try {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

export function formatDate(date) {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
