export const fmt = {
  // INR price formatter — Indian market uses ₹
  price: (v) => v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  inr:   (v) => v == null ? '—' : `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  pct:   (v) => v == null ? '—' : `${v >= 0 ? '+' : ''}${Number(v).toFixed(2)}%`,
  big:   (v) => {
    if (v == null) return '—'
    if (v >= 1e12) return `₹${(v / 1e12).toFixed(2)}T`
    if (v >= 1e9)  return `₹${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6)  return `₹${(v / 1e6).toFixed(2)}M`
    return `₹${Number(v).toLocaleString('en-IN')}`
  },
  vol:   (v) => {
    if (v == null) return '—'
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
    if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(2)}K`
    return String(v)
  },
  date:  (d) => d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
  num:   (v, dec = 2) => v == null ? '—' : Number(v).toFixed(dec),
}

export const signalColor = (s) => {
  switch (s) {
    case 'strong-buy':  return '#10B981'
    case 'buy':         return '#34D399'
    case 'hold':        return '#F59E0B'
    case 'sell':        return '#FB7185'
    case 'strong-sell': return '#F43F5E'
    default:            return '#9CA3AF'
  }
}

export const signalLabel = (s) => {
  if (!s) return 'N/A'
  return s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
}

