import React from 'react';

/**
 * Sortable Table Column Header Component
 * @param {{ field: string, label: string, sortBy: string, sortDir: 'asc'|'desc', onClick: (field: string) => void }} props
 */
export default function SortHeader({ field, label, sortBy, sortDir, onClick }) {
  const active = sortBy === field;
  return (
    <th
      onClick={() => onClick(field)}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        color: active ? '#818CF8' : '#6B7280',
        transition: 'color 0.2s',
      }}
    >
      {label}
      <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>
        {active ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ' ↕'}
      </span>
    </th>
  );
}
