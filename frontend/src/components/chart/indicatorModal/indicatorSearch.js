import { INDICATOR_SEARCH_ALIASES } from '../indicatorDefinitions';

// ── Fuzzy search ─────────────────────────────────────────────────────────────
// Scores a single query token against one haystack string. Exact substring
// hits outrank prefix hits outrank ordered-subsequence (typo-tolerant) hits.
function tokenFieldScore(token, field) {
  if (!token || !field) return 0;
  const t = token.toLowerCase();
  const f = field.toLowerCase();
  if (!t || !f) return 0;
  if (f === t) return 120;
  const words = f.split(/[\s\-_/()%,+]+/).filter(Boolean);
  if (words.includes(t)) return 100;
  if (f.startsWith(t)) return 80;
  if (words.some((w) => w.startsWith(t))) return 70;
  if (f.includes(t)) return 50;
  // Ordered subsequence (fuzzy): characters appear in order, not necessarily
  // adjacent. Consecutive runs score higher; long gaps are penalized.
  let ti = 0;
  let score = 0;
  let run = 0;
  for (let fi = 0; fi < f.length && ti < t.length; fi++) {
    if (f[fi] === t[ti]) {
      ti++;
      run++;
      score += 4 + Math.min(run, 6);
    } else {
      run = 0;
      score -= 0.4;
    }
  }
  if (ti < t.length) return 0;
  return Math.max(4, score);
}

function searchFields(indicator) {
  const aliases = INDICATOR_SEARCH_ALIASES[indicator.id] || [];
  return [
    indicator.name,
    indicator.shortName,
    indicator.id.replace(/_/g, ' '),
    indicator.id,
    indicator.description,
    indicator.badge,
    indicator.category,
    ...(indicator.keywords || []),
    ...aliases,
  ]
    .filter(Boolean)
    .map(String);
}

function scoreIndicator(token, indicator) {
  const fields = searchFields(indicator);
  let best = 0;
  for (const field of fields) {
    const s = tokenFieldScore(token, field);
    if (s > best) best = s;
    if (best >= 120) break;
  }
  // Name matches outweigh description matches: weight the name fields up.
  const nameBest = Math.max(
    tokenFieldScore(token, indicator.name || ''),
    tokenFieldScore(token, indicator.shortName || ''),
    tokenFieldScore(token, (indicator.id || '').replace(/_/g, ' ')),
  );
  return best + nameBest * 0.5;
}

export { scoreIndicator };
