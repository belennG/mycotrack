import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Trackings from './pages/Trackings'
import TrackingForm from './pages/TrackingForm'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trackings" element={<Trackings />} />
        <Route path="/trackings/new" element={<TrackingForm />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
