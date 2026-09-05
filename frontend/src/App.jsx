import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './Layout'
import { Loading } from './components'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sensors from './pages/Sensors'
import Irrigation from './pages/Irrigation'
import { useSession } from './session'

// The charting library is most of the bundle and only three screens need it, so those screens
// load on demand and the sign-in and dashboard paths stay light.
const SensorDetail = lazy(() => import('./pages/SensorDetail'))
const Crops = lazy(() => import('./pages/Crops'))
const CropDetail = lazy(() => import('./pages/CropDetail'))

export default function App() {
  const { session } = useSession()

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
