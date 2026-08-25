import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an unhandled error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '280px',
          padding: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderRadius: '12px',
          border: '1px solid rgba(239, 83, 80, 0.3)',
          textAlign: 'center',
          color: '#F8FAFC',
          margin: '16px'
        }}>
          <AlertTriangle size={36} color="#EF5350" style={{ marginBottom: 12 }} />
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', fontWeight: 800 }}>Component Render Error</h3>
          <p style={{ margin: '0 0 16px 0', color: '#94A3B8', fontSize: '0.85rem', maxWidth: '420px' }}>
            A temporary display error occurred. Your trading data and active positions are safe.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              background: '#3B82F6',
              border: 'none',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} />
            <span>Reload View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
