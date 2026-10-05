const shell = {
  width: 'min(1040px, calc(100vw - 24px))',
  height: 'min(86vh, 800px)',
  maxHeight: '86vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: '#0E1322',
  border: '1px solid rgba(148, 163, 184, 0.2)',
  borderRadius: 8,
  boxShadow: '0 24px 48px rgba(0, 0, 0, 0.78)',
  fontFamily: 'JetBrains Mono, monospace',
};

const iconButton = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: 'transparent',
  color: '#64748B',
  cursor: 'pointer',
};

const FAVORITES_KEY = 'stockoracle_favorite_indicators';
const RECENT_KEY = 'stockoracle_recent_indicators';
const MAX_RECENT = 8;

// Two-column card grid for the browse catalog on wide layouts; collapses to
// a single column automatically when the pane gets narrow.
const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 8,
  alignItems: 'start',
};

export { shell, iconButton, FAVORITES_KEY, RECENT_KEY, MAX_RECENT, cardGrid };
