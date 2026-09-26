import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './Layout'
import { Loading } from './components'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sensors from './pages/Sensors'
import Irrigation from './pages/Irrigation'
import { useSession } from './session'
import { loadProfile } from './farm/engine'

// The charting library is most of the bundle and only three screens need it, so those screens
// load on demand and the sign-in and dashboard paths stay light.
const SensorDetail = lazy(() => import('./pages/SensorDetail'))
const Crops = lazy(() => import('./pages/Crops'))
const CropDetail = lazy(() => import('./pages/CropDetail'))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Assistant = lazy(() => import('./pages/Assistant'))

export default function App() {
  const { session, isDemo } = useSession()
  const { pathname } = useLocation()

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // A farmer with no farm set up yet goes through onboarding first: crop, location, field,
  // sensors. The offline demo has no backend, so it lives on the assistant screen only.
  const needsSetup = session.role === 'FARMER' && !loadProfile(session.email)
  if (needsSetup && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />
  if (isDemo && !needsSetup && !['/assistant', '/onboarding'].includes(pathname)) {
    return <Navigate to="/assistant" replace />
  }

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={
          <Suspense fallback={<Loading variant="detail" />}>
            <Onboarding />
          </Suspense>
        }
      />
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/sensors" element={<Sensors />} />
        <Route
          path="/sensors/:deviceId"
          element={
            <Suspense fallback={<Loading variant="detail" />}>
              <SensorDetail />
            </Suspense>
          }
        />
        <Route
          path="/crops"
          element={
            <Suspense fallback={<Loading variant="cards" rows={4} />}>
              <Crops />
            </Suspense>
          }
        />
        <Route
          path="/crops/:cropId"
          element={
            <Suspense fallback={<Loading variant="detail" />}>
              <CropDetail />
            </Suspense>
          }
        />
        <Route path="/irrigation" element={<Irrigation />} />
        <Route
          path="/assistant"
          element={
            <Suspense fallback={<Loading variant="detail" />}>
              <Assistant />
            </Suspense>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
