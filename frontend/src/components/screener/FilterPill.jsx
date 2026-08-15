import React from 'react';

/**
 * Reusable Filter Pill Button Component
 * @param {{ active: boolean, children: React.ReactNode, onClick: () => void }} props
 */
export default function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      className={`screener-pill ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
