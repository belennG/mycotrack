import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAppAuth } from '../auth/AppAuthContext'
import { FullPageSpinner } from '../components/FullPageSpinner'

/**
 * `/demo`: a link that opens straight into the demo, with no login screen to choose from.
 * It is the address to put on a résumé or in a message.
 */
export default function StartDemo() {
  const { status, mode, startDemo } = useAppAuth()
  const started = useRef(false)

  useEffect(() => {
    // `startDemo` is a new function on every render, so guard instead of depending on it.
    if (!started.current) {
      started.current = true
      startDemo()
    }
  }, [startDemo])

  if (status === 'authenticated' && mode === 'demo') {
    return <Navigate to="/dashboard" replace />
  }

  return <FullPageSpinner label="Opening the demo…" />
}
