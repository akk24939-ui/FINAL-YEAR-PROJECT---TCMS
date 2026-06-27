import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ConsumerDashboard from './pages/consumer/ConsumerDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'
import './styles/globals.css'

// Protected Route component
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// Placeholder dashboards for roles not yet built
const PlaceholderDashboard: React.FC<{ role: string }> = ({ role }) => {
  const { user } = useAuthStore()
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1F1A' }}>
      <div className="text-center p-12 rounded-2xl border border-amber-400/20" style={{ background: 'rgba(26,60,52,0.4)' }}>
        <p className="text-4xl mb-4">🎉</p>
        <h1 className="text-2xl font-bold text-white mb-2">Welcome, {user?.full_name}!</h1>
        <p className="text-amber-400 mb-1">{role} Dashboard</p>
        <p className="text-gray-400 text-sm">Role: {user?.role}</p>
        <p className="text-gray-500 text-xs mt-4">Smart TASMAC — नुकर्वोர் கட்டுப்பாட்டு அமைப்பு</p>
      </div>
    </div>
  )
}

const App: React.FC = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Consumer routes */}
      <Route path="/consumer/*" element={
        <ProtectedRoute allowedRoles={['CONSUMER']}>
          <ConsumerDashboard />
        </ProtectedRoute>
      } />

      {/* Operator routes */}
      <Route path="/operator/*" element={
        <ProtectedRoute allowedRoles={['OPERATOR']}>
          <PlaceholderDashboard role="Shop Operator" />
        </ProtectedRoute>
      } />

      {/* Admin routes */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['ADMIN']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      {/* Doctor routes */}
      <Route path="/doctor/*" element={
        <ProtectedRoute allowedRoles={['DOCTOR']}>
          <PlaceholderDashboard role="Doctor" />
        </ProtectedRoute>
      } />

      {/* Caretaker routes */}
      <Route path="/caretaker/*" element={
        <ProtectedRoute allowedRoles={['CARETAKER']}>
          <PlaceholderDashboard role="Caretaker" />
        </ProtectedRoute>
      } />

      {/* 404 fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
