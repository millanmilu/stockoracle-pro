import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("⚠️ React Error Boundary caught an exception:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', background: '#111827', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.3)', color: '#fff', margin: '20px' }}>
          <h3 style={{ color: '#ef4444', margin: '0 0 10px 0', fontSize: '1.1rem' }}>⚠️ View Temporarily Unavailable</h3>
          <p style={{ color: '#aaa', fontSize: '0.85rem', marginBottom: '16px' }}>
            {this.state.error?.message || "An unexpected error occurred while rendering this component."}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ padding: '8px 16px', background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
          >
            Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
