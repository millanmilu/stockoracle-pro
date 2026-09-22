import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

// Prevent benign browser ResizeObserver loop and chart disposal race notifications from crashing React Error Boundaries
const isDisposedError = (msg) =>
  typeof msg === 'string' &&
  (msg.includes('ResizeObserver') ||
    msg.toLowerCase().includes('object is disposed') ||
    msg.toLowerCase().includes('chart is disposed'));

window.addEventListener('error', (e) => {
  if (isDisposedError(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const reasonMsg = e.reason?.message || String(e.reason || '');
  if (isDisposedError(reasonMsg)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
