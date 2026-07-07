import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { ThemeProvider } from './context/ThemeContext'
import ConsumerLayout from './components/consumer/ConsumerLayout'

// ── Lazy-loaded pages ───────────────────────────────────────────────────────
const LandingPage            = lazy(() => import('./pages/LandingPage'))
const LoginPage              = lazy(() => import('./pages/LoginPage'))
const RegisterPage           = lazy(() => import('./pages/consumer/register/RegisterPage'))

// Consumer inner pages (all rendered inside ConsumerLayout)
const ConsumerDashboard      = lazy(() => import('./pages/consumer/ConsumerDashboard'))
const ProfilePage            = lazy(() => import('./pages/consumer/profile/ProfilePage'))
const LimitsPage             = lazy(() => import('./pages/consumer/limits/LimitsPage'))
const TeetotalerPage         = lazy(() => import('./pages/consumer/teetotaler/TeetotalerPage'))
const PurchaseHistoryPage    = lazy(() => import('./pages/consumer/purchases/PurchaseHistoryPage'))
const QrPage                 = lazy(() => import('./pages/consumer/qr/QrPage'))
const PdfDownloadPage        = lazy(() => import('./pages/consumer/pdf/PdfDownloadPage'))

// New pages to be built in later steps (stub imports — files created in Step 5+)
const RestrictionsPage       = lazy(() => import('./pages/consumer/restrictions/RestrictionsPage'))
const NotificationsPage      = lazy(() => import('./pages/consumer/notifications/NotificationsPage'))
const ReportPage             = lazy(() => import('./pages/consumer/report/ReportPage'))

// ── Protected Route ─────────────────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ children, role }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role && user?.role !== role) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Loading spinner ─────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading…</p>
    </div>
  </div>
)

// ── App ─────────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <ThemeProvider>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Consumer module — all wrapped in ConsumerLayout */}
        <Route
          path="/consumer"
          element={
            <ProtectedRoute role="CONSUMER">
              <ConsumerLayout />
            </ProtectedRoute>
          }
        >
          {/* index == /consumer */}
          <Route index element={<ConsumerDashboard />} />
          <Route path="profile"       element={<ProfilePage />} />
          <Route path="limits"        element={<LimitsPage />} />
          <Route path="teetotaler"    element={<TeetotalerPage />} />
          <Route path="purchases"     element={<PurchaseHistoryPage />} />
          <Route path="restrictions"  element={<RestrictionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="qr"            element={<QrPage />} />
          <Route path="pdf"           element={<PdfDownloadPage />} />
          <Route path="report"        element={<ReportPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </ThemeProvider>
)

export default App
