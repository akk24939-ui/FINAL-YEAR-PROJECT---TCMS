import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useAdminAuthStore } from './store/adminAuthStore'
import { useOperatorAuthStore } from './store/operatorAuthStore'
import { useDoctorAuthStore } from './store/doctorAuthStore'
import { ThemeProvider } from './context/ThemeContext'
import ConsumerLayout from './components/consumer/ConsumerLayout'
import AdminLayout from './components/admin/AdminLayout'
import ShopLayout from './components/operator/ShopLayout'

// ── Lazy-loaded pages — Consumer ─────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const RegisterPage = lazy(() => import('./pages/consumer/register/RegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/consumer/ForgotPasswordPage'))

const ConsumerDashboard = lazy(() => import('./pages/consumer/ConsumerDashboard'))
const ProfilePage = lazy(() => import('./pages/consumer/profile/ProfilePage'))
const LimitsPage = lazy(() => import('./pages/consumer/limits/LimitsPage'))
const TeetotalerPage = lazy(() => import('./pages/consumer/teetotaler/TeetotalerPage'))
const PurchaseHistoryPage = lazy(() => import('./pages/consumer/purchases/PurchaseHistoryPage'))
const QrPage = lazy(() => import('./pages/consumer/qr/QrPage'))
const PdfDownloadPage = lazy(() => import('./pages/consumer/pdf/PdfDownloadPage'))
const RestrictionsPage = lazy(() => import('./pages/consumer/restrictions/RestrictionsPage'))
const NotificationsPage = lazy(() => import('./pages/consumer/notifications/NotificationsPage'))
const ReportPage = lazy(() => import('./pages/consumer/report/ReportPage'))

// ── Lazy-loaded pages — Auth portals ─────────────────────────────────────────
const AdminLoginPageNew = lazy(() => import('./pages/login/AdminLoginPage'))
const ShopLoginPageNew = lazy(() => import('./pages/login/ShopLoginPage'))
const DoctorLoginPageNew = lazy(() => import('./pages/login/DoctorLoginPage'))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage'))
const PortalLoginPage = lazy(() => import('./pages/PortalLoginPage'))

// ── Lazy-loaded pages — Operator ──────────────────────────────────────────────
const ShopLoginPage = lazy(() => import('./pages/operator/ShopLoginPage'))
const ShopDashboard = lazy(() => import('./pages/operator/ShopDashboard'))
const ScanAndSellPage = lazy(() => import('./pages/operator/ScanAndSellPage'))
const ShopHistoryPage = lazy(() => import('./pages/operator/ShopHistoryPage'))
const ShopChangePasswordPage = lazy(() => import('./pages/operator/ShopChangePasswordPage'))
const OverviewPage = lazy(() => import('./pages/admin/OverviewPage'))
const ShopsPage = lazy(() => import('./pages/admin/ShopsPage'))
const DoctorsPage = lazy(() => import('./pages/admin/DoctorsPage'))
const ConsumersPage = lazy(() => import('./pages/admin/ConsumersPage'))
const GlobalLimitsPage = lazy(() => import('./pages/admin/GlobalLimitsPage'))
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'))
const ReportsPage = lazy(() => import('./pages/admin/ReportsPage'))

// ── Lazy-loaded pages — Doctor ────────────────────────────────────────────────
const DoctorDashboard = lazy(() => import('./pages/doctor/DoctorDashboard'))

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
  if (!isAuthenticated) return <Navigate to="/login/admin" replace />
  return <>{children}</>
}

// ── Protected Route — Operator ────────────────────────────────────────────────
const OperatorProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useOperatorAuthStore()
  if (!isAuthenticated) return <Navigate to="/login/shop" replace />
  return <>{children}</>
}

// ── Protected Route — Doctor ──────────────────────────────────────────────────
const DoctorProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useDoctorAuthStore()
  if (!isAuthenticated) return <Navigate to="/login/doctor" replace />
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
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* ── Separate portal login pages ─────────────────────────────────── */}
        <Route path="/login/admin" element={<AdminLoginPageNew />} />
        <Route path="/login/shop" element={<ShopLoginPageNew />} />
        <Route path="/login/doctor" element={<DoctorLoginPageNew />} />

        {/* ── Forced password change — accessible even without full auth ── */}
        <Route path="/shop/change-password" element={<ShopChangePasswordPage />} />

        {/* ── Unified portal login (kept for /portal/login bookmark compat) ── */}
        <Route path="/portal/login" element={<PortalLoginPage />} />

        {/* ── Legacy redirects → new dedicated pages ───────────────────────── */}
        <Route path="/admin/login" element={<Navigate to="/login/admin" replace />} />
        <Route path="/shop/login" element={<Navigate to="/login/shop" replace />} />

        {/* ── Admin portal (protected, role=ADMIN) ─────────────────────── */}
        <Route
          path="/admin"
          element={
            <AdminProtectedRoute>
              <AdminLayout />
            </AdminProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="shops" element={<ShopsPage />} />
          <Route path="doctors" element={<DoctorsPage />} />
          <Route path="consumers" element={<ConsumersPage />} />
          <Route path="limits" element={<GlobalLimitsPage />} />
          <Route path="audit" element={<AuditLogPage />} />
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
          <Route index element={<ShopDashboard />} />
          <Route path="scan" element={<ScanAndSellPage />} />
          <Route path="history" element={<ShopHistoryPage />} />
        </Route>

        {/* ── Doctor portal (protected, role=DOCTOR) ──────────────────── */}
        <Route
          path="/doctor"
          element={
            <DoctorProtectedRoute>
              <DoctorDashboard />
            </DoctorProtectedRoute>
          }
        />

        {/* ── Consumer module ───────────────────────────────────────────── */}
        <Route
          path="/consumer"
          element={
            <ProtectedRoute role="CONSUMER">
              <ConsumerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ConsumerDashboard />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="limits" element={<LimitsPage />} />
          <Route path="teetotaler" element={<TeetotalerPage />} />
          <Route path="purchases" element={<PurchaseHistoryPage />} />
          <Route path="restrictions" element={<RestrictionsPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="qr" element={<QrPage />} />
          <Route path="pdf" element={<PdfDownloadPage />} />
          <Route path="report" element={<ReportPage />} />
        </Route>

        {/* ── Catch-all ─────────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  </ThemeProvider>
)

export default App
