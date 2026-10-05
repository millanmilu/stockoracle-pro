export default function PanelTabs({
  TABS,
  activeTab,
  setActiveTab,
}) {
  return (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          padding: '6px 2px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isSel = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  whiteSpace: 'nowrap',
                  border: isSel ? '1px solid #818CF8' : '1px solid rgba(255,255,255,0.08)',
                  background: isSel
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.35), rgba(139,92,246,0.25))'
                    : 'rgba(15,23,42,0.65)',
                  color: isSel ? '#FFFFFF' : '#94A3B8',
                  fontWeight: isSel ? 800 : 500,
                  fontSize: '0.74rem',
                  cursor: 'pointer',
                  boxShadow: isSel ? '0 2px 12px rgba(99,102,241,0.30)' : 'none',
                  transition: 'all 0.15s ease-in-out'
                }}
              >
                <Icon size={14} color={isSel ? '#818CF8' : '#64748B'} style={{ flexShrink: 0 }} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: '0.60rem',
                    background: isSel ? 'rgba(99,102,241,0.45)' : 'rgba(255,255,255,0.06)',
                    color: isSel ? '#E0E7FF' : '#64748B',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontWeight: 800,
                    flexShrink: 0
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
  );
}
