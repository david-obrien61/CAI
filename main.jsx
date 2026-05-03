import React from 'react'
import ReactDOM from 'react-dom/client'
import CoreApp from './CoreApp.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import DataBridge from './DataBridge.js'

// Catch unhandled JS errors (network failures, async crashes, etc.)
window.addEventListener('error', (e) => {
  DataBridge.logError('UNHANDLED', e.message, e.error?.stack, {
    filename: e.filename, lineno: e.lineno,
  });
});

// Catch unhandled promise rejections (failed fetch, Supabase timeouts, etc.)
window.addEventListener('unhandledrejection', (e) => {
  DataBridge.logError('PROMISE', e.reason?.message || String(e.reason), e.reason?.stack);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <CoreApp />
    </ErrorBoundary>
  </React.StrictMode>,
)
