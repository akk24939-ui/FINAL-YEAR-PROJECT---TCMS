import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/globals.css'

// ── Query client ────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
})

// ── Apply saved theme immediately ───────────────────────────────────────────
try {
  const raw = localStorage.getItem('tasmac-theme')
  const theme = raw ? JSON.parse(raw)?.state?.theme : 'dark'
  if (theme === 'dark') document.documentElement.classList.add('dark')
} catch { /* ignore parse errors */ }

// ── Error Boundary — shows actual error instead of blank page ───────────────
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{
          minHeight: '100vh', background: '#0D1F1A', color: '#F0FDF4',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 32, fontFamily: 'monospace'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ color: '#F97316', marginBottom: 8 }}>Application Error</h1>
          <p style={{ color: '#9CA3AF', marginBottom: 24 }}>
            The app crashed. Check details below and report to the developer.
          </p>
          <div style={{
            background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)',
            borderRadius: 8, padding: 16, maxWidth: 800, width: '100%',
            whiteSpace: 'pre-wrap', fontSize: 13, color: '#FCA5A5'
          }}>
            <strong>{err.name}: {err.message}</strong>
            {'\n\n'}
            {err.stack}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24, padding: '10px 24px', background: '#1A3C34',
              border: '1px solid #22C55E', borderRadius: 8, color: '#22C55E',
              cursor: 'pointer', fontSize: 14
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Mount ───────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
