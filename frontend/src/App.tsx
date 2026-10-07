import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import { AuthGuard } from './auth/AuthGuard'
import Callback from './pages/Callback'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Trackings from './pages/Trackings'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      {/* Public routes — must stay outside the guard */}
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />

      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/batches/:id/trackings" element={<Trackings />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
