import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconCrop,
  IconDashboard,
  IconLogout,
  IconMoon,
  IconSensor,
  IconSun,
  IconValve,
} from './icons'
import { useSession, useTheme } from './session'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/sensors', label: 'Sensors', Icon: IconSensor },
  { to: '/crops', label: 'Crops', Icon: IconCrop },
  { to: '/irrigation', label: 'Irrigation', Icon: IconValve },
]

/** Titles live with the routes so the header stays a single source of truth. */
function pageHeading(pathname) {
  if (pathname.startsWith('/sensors/')) {
    return { title: pathname.split('/')[2], subtitle: 'Sensor device detail' }
  }
  if (pathname.startsWith('/crops/')) {
    return { title: pathname.split('/')[2], subtitle: 'Field detail' }
  }
  switch (pathname) {
    case '/sensors':
      return { title: 'Sensor Management', subtitle: 'Registered IoT devices across the farm' }
    case '/crops':
      return { title: 'Crop Monitoring', subtitle: 'Environmental health by field' }
    case '/irrigation':
      return { title: 'Irrigation Control', subtitle: 'Schedules and manual valve override' }
    default:
      return { title: 'Dashboard', subtitle: 'Operational summary' }
  }
}

/**
 * The reference design leads with a floating, centred pill navigation rather than a fixed
 * sidebar. With only four destinations that reads better here too, and it returns the full
 * width to the tables and charts, which are the point of this product.
 */
export default function Layout() {
  const { session, signOut } = useSession()
  const [theme, toggleTheme] = useTheme()
  const { title, subtitle } = pageHeading(useLocation().pathname)

  const initials = (session.displayName || session.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="shell">
      <div className="app-blobs" aria-hidden="true" />

      <header className="topnav">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <IconCrop width={18} height={18} />
          </span>
          <span className="brand-text">
            <span className="brand-name">AgriTech</span>
            <span className="brand-sub">Sensing Solutions</span>
          </span>
        </div>

        <nav className="nav-pill" aria-label="Primary">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topnav-actions">
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>

          <div className="user-chip">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="user-text">
              <span className="user-name">{session.displayName || session.email}</span>
              <span className="user-role">{session.role}</span>
            </span>
          </div>

          <button type="button" className="btn btn-quiet btn-icon" onClick={signOut} aria-label="Sign out">
            <IconLogout />
          </button>
        </div>
      </header>

      <div className="main">
        <div className="page-head">
          <h1 className="page-title display">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
