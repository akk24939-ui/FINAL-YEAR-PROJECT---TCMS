import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAdminAuthStore } from './store/adminAuthStore'
import { useOperatorAuthStore } from './store/operatorAuthStore'
import { ThemeProvider } from './context/ThemeContext'
import ConsumerLayout from './components/consumer/ConsumerLayout'
import AdminLayout from './components/admin/AdminLayout'
import ShopLayout from './components/operator/ShopLayout'

// ── Lazy-loaded pages — Consumer ─────────────────────────────────────────────
const LandingPage            = lazy(() => import('./pages/LandingPage'))
const LoginPage              = lazy(() => import('./pages/LoginPage'))
const RegisterPage           = lazy(() => import('./pages/consumer/register/RegisterPage'))

const ConsumerDashboard      = lazy(() => import('./pages/consumer/ConsumerDashboard'))
const ProfilePage            = lazy(() => import('./pages/consumer/profile/ProfilePage'))
const LimitsPage             = lazy(() => import('./pages/consumer/limits/LimitsPage'))
const TeetotalerPage         = lazy(() => import('./pages/consumer/teetotaler/TeetotalerPage'))
const PurchaseHistoryPage    = lazy(() => import('./pages/consumer/purchases/PurchaseHistoryPage'))
const QrPage                 = lazy(() => import('./pages/consumer/qr/QrPage'))
const PdfDownloadPage        = lazy(() => import('./pages/consumer/pdf/PdfDownloadPage'))
const RestrictionsPage       = lazy(() => import('./pages/consumer/restrictions/RestrictionsPage'))
const NotificationsPage      = lazy(() => import('./pages/consumer/notifications/NotificationsPage'))
const ReportPage             = lazy(() => import('./pages/consumer/report/ReportPage'))

// ── Lazy-loaded pages — Admin ─────────────────────────────────────────────────
const AdminLoginPage         = lazy(() => import('./pages/admin/AdminLoginPage'))

// ── Lazy-loaded pages — Operator ──────────────────────────────────────────────
const ShopLoginPage          = lazy(() => import('./pages/operator/ShopLoginPage'))
const ShopDashboard          = lazy(() => import('./pages/operator/ShopDashboard'))
const ScanAndSellPage        = lazy(() => import('./pages/operator/ScanAndSellPage'))
const ShopHistoryPage        = lazy(() => import('./pages/operator/ShopHistoryPage'))
const OverviewPage           = lazy(() => import('./pages/admin/OverviewPage'))
const ShopsPage              = lazy(() => import('./pages/admin/ShopsPage'))
const DoctorsPage            = lazy(() => import('./pages/admin/DoctorsPage'))
const ConsumersPage          = lazy(() => import('./pages/admin/ConsumersPage'))
const GlobalLimitsPage       = lazy(() => import('./pages/admin/GlobalLimitsPage'))
const AuditLogPage           = lazy(() => import('./pages/admin/AuditLogPage'))
const ReportsPage            = lazy(() => import('./pages/admin/ReportsPage'))

// ── Protected Route — Consumer ───────────────────────────────────────────────
const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: string }> = ({ children, role }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (role && user?.role !== role) return <Navigate to="/login" replace />
  return <>{children}</>
}

// ── Protected Route — Admin ───────────────────────────────────────────────────
const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAdminAuthStore()
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return <>{children}</>
}

// ── Protected Route — Operator ────────────────────────────────────────────────
const OperatorProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useOperatorAuthStore()
  if (!isAuthenticated) return <Navigate to="/shop/login" replace />
  return <>{children}</>
}

// ── Loading spinner ───────────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Loading…</p>
    </div>
  </div>
)

// ── App ───────────────────────────────────────────────────────────────────────
const App: React.FC = () => (
  <ThemeProvider>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public routes ─────────────────────────────────────────────── */}
        <Route path="/"         element={<LandingPage />} />
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* ── Admin portal login (public) ───────────────────────────────── */}
        <Route path="/admin/login" element={<AdminLoginPage />} />

        {/* ── Shop operator login (public) ─────────────────────────────── */}
        <Route path="/shop/login" element={<ShopLoginPage />} />

        {/* ── Admin portal (protected, role=ADMIN) ─────────────────────── */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index          element={<OverviewPage />} />
          <Route path="shops"   element={<ShopsPage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="consumers" element={<ConsumersPage />} />
          <Route path="limits"  element={<GlobalLimitsPage />} />
          <Route path="audit"   element={<AuditLogPage />} />
          <Route path="reports" element={<ReportsPage />} />
        </Route>

        {/* ── Shop Operator portal (protected) ───────────────────────── */}
        <Route
          path="/shop"
          element={
            <OperatorProtectedRoute>
              <ShopLayout />
            </OperatorProtectedRoute>
          }
        >
          <Route index             element={<ShopDashboard />} />
          <Route path="scan"       element={<ScanAndSellPage />} />
          <Route path="history"    element={<ShopHistoryPage />} />
        </Route>

        {/* ── Consumer module ───────────────────────────────────────────── */}
        <Route
          path="/consumer"
          element={
            <ProtectedRoute role="CONSUMER">
              <ConsumerLayout />
            </ProtectedRoute>
          }
        >
          <Route index               element={<ConsumerDashboard />} />
          <Route path="profile"      element={<ProfilePage />} />
          <Route path="limits"       element={<LimitsPage />} />
          <Route path="teetotaler"   element={<TeetotalerPage />} />
          <Route path="purchases"    element={<PurchaseHistoryPage />} />
          <Route path="restrictions" element={<RestrictionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="qr"           element={<QrPage />} />
          <Route path="pdf"          element={<PdfDownloadPage />} />
          <Route path="report"       element={<ReportPage />} />
        </Route>

        {/* ── Catch-all ─────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </ThemeProvider>
)

export default App
