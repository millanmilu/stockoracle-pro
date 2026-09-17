import React from 'react';
import { Sun, Moon } from 'lucide-react';
import useStore from '../store/useStore';

/**
 * Explicit Light / Dark segmented toggle.
 * Persisted via zustand (`stockoracle-store`), applied to <html data-theme>.
 */
export default function ThemeToggle({ compact = false }) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const isLight = theme === 'light';

  if (compact) {
    return (
      <button
        onClick={() => setTheme(isLight ? 'dark' : 'light')}
        title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 8,
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 6,
        }}
      >
        {isLight ? <Moon size={15} /> : <Sun size={15} />}
      </button>
    );
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      <button
        className={`theme-toggle-btn ${isLight ? 'active' : ''}`}
        onClick={() => setTheme('light')}
        title="Light mode"
        aria-pressed={isLight}
      >
        <Sun size={13} /> Light
      </button>
      <button
        className={`theme-toggle-btn ${!isLight ? 'active' : ''}`}
        onClick={() => setTheme('dark')}
        title="Dark mode"
        aria-pressed={!isLight}
      >
        <Moon size={13} /> Dark
      </button>
    </div>
  );
}
