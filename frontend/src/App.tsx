import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// ── Lazy-loaded pages ───────────────────────────────────────────────────────
const LandingPage         = lazy(() => import('./pages/LandingPage'))
const LoginPage           = lazy(() => import('./pages/LoginPage'))
const ConsumerDashboard   = lazy(() => import('./pages/consumer/ConsumerDashboard'))
const RegisterPage        = lazy(() => import('./pages/consumer/register/RegisterPage'))
const ProfilePage         = lazy(() => import('./pages/consumer/profile/ProfilePage'))
const LimitsPage          = lazy(() => import('./pages/consumer/limits/LimitsPage'))
const TeetotalerPage      = lazy(() => import('./pages/consumer/teetotaler/TeetotalerPage'))
const PurchaseHistoryPage = lazy(() => import('./pages/consumer/purchases/PurchaseHistoryPage'))
const QrPage              = lazy(() => import('./pages/consumer/qr/QrPage'))
const PdfDownloadPage     = lazy(() => import('./pages/consumer/pdf/PdfDownloadPage'))

// ── Protected Route ─────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ children, role }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role && user?.role !== role) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Loading spinner ─────────────────────────────────────────────────────────
const PageLoader = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D1F1A' }}>
    <div style={{ width: 40, height: 40, border: '4px solid #22C55E', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

// ── App — no BrowserRouter here, main.tsx provides it ──────────────────────
const App: React.FC = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      {/* Public */}
      <Route path="/"         element={<LandingPage />} />
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Consumer Module */}
      <Route path="/consumer"           element={<ProtectedRoute role="CONSUMER"><ConsumerDashboard /></ProtectedRoute>} />
      <Route path="/consumer/profile"   element={<ProtectedRoute role="CONSUMER"><ProfilePage /></ProtectedRoute>} />
      <Route path="/consumer/limits"    element={<ProtectedRoute role="CONSUMER"><LimitsPage /></ProtectedRoute>} />
      <Route path="/consumer/teetotaler" element={<ProtectedRoute role="CONSUMER"><TeetotalerPage /></ProtectedRoute>} />
      <Route path="/consumer/purchases" element={<ProtectedRoute role="CONSUMER"><PurchaseHistoryPage /></ProtectedRoute>} />
      <Route path="/consumer/qr"        element={<ProtectedRoute role="CONSUMER"><QrPage /></ProtectedRoute>} />
      <Route path="/consumer/pdf"       element={<ProtectedRoute role="CONSUMER"><PdfDownloadPage /></ProtectedRoute>} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
)

export default App
