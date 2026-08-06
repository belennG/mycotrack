import { Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import Dashboard from './pages/Dashboard'
import Trackings from './pages/Trackings'
import BatchForm from './pages/BatchForm'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/batches/new" element={<BatchForm />} />
        <Route path="/batches/:id/edit" element={<BatchForm />} />
        <Route path="/batches/:batchId/trackings" element={<Trackings />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
