import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconChevron,
  IconClose,
  IconCrop,
  IconDashboard,
  IconLogout,
  IconMenu,
  IconMoon,
  IconSensor,
  IconSun,
  IconValve,
} from './icons'
import { useClickAway } from './components'
import { useSession, useTheme } from './session'
import ChatBot from './ChatBot'

const NAV = [
  { to: '/', label: 'Dashboard', Icon: IconDashboard, end: true },
  { to: '/sensors', label: 'Sensors', Icon: IconSensor },
  { to: '/crops', label: 'Crops', Icon: IconCrop },
  { to: '/irrigation', label: 'Irrigation', Icon: IconValve },
]

/** Titles live with the routes so the page heading stays a single source of truth. */
function pageHeading(pathname) {
  // Detail pages keep the sentence headline; the ID is long and unbroken, so it goes underneath
  // instead of being set at headline size, where it wrapped mid-word on phones.
  if (pathname.startsWith('/sensors/')) {
    return { title: 'One sensor, up close.', subtitle: decodeURIComponent(pathname.split('/')[2]) }
  }
  if (pathname.startsWith('/crops/')) {
    return { title: 'One field, up close.', subtitle: decodeURIComponent(pathname.split('/')[2]) }
  }
  switch (pathname) {
    // List pages get the reference's headline treatment: a short sentence, full stop included.
    case '/sensors':
      return { title: 'Sensors across the farm.', subtitle: 'Registered IoT devices, their health and their last reading.' }
    case '/crops':
      return { title: 'Crop health by field.', subtitle: 'Each field scored against its own optimal range.' }
    case '/irrigation':
      return { title: 'Irrigation schedules and valves.', subtitle: 'Set when zones water, or open and close a valve by hand.' }
    default:
      return { title: 'Your farm at a glance.', subtitle: 'Soil moisture, field health, sensors, alerts and irrigation in one view.' }
  }
}

function initialsOf(session) {
  return (session.displayName || session.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/** The API sends roles as constants ("ADMIN"); people read them in sentence case. */
function roleLabel(role) {
  return role ? role.charAt(0) + role.slice(1).toLowerCase() : ''
}

export default function Layout() {
  const { session, signOut } = useSession()
  const [theme, toggleTheme] = useTheme()
  const { title, subtitle } = pageHeading(useLocation().pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = initialsOf(session)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="topbar">
        <Link to="/" className="brand">
          AgriTech
        </Link>

        <nav className="nav-links" aria-label="Primary">
          {NAV.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>

          <AccountMenu session={session} signOut={signOut} initials={initials} />

          <button
            type="button"
            className="btn btn-quiet btn-icon hamburger"
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <NavDrawer session={session} signOut={signOut} initials={initials} onNavigate={closeMenu} />
      ) : null}

      <main className="content" id="main-content" tabIndex={-1}>
        <div className="page-head">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <Outlet />
      </main>

      <ChatBot />
    </div>
  )
}

/** Identity and sign-out, collapsed into the bar so the nav stays a single line. */
function AccountMenu({ session, signOut, initials }) {
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const ref = useClickAway(open, close)

  return (
    <div className="account-menu" ref={ref}>
      <button
        type="button"
        className="account-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="account-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="account-name">{session.displayName || session.email}</span>
        <IconChevron className={`account-caret${open ? ' open' : ''}`} />
      </button>

      {open ? (
        <div id="account-panel" className="account-dropdown">
          <div className="account-dropdown-head">
            <div className="user-name">{session.displayName || session.email}</div>
            <div className="user-role">{roleLabel(session.role)}</div>
          </div>
          <button type="button" className="nav-item" onClick={signOut}>
            <IconLogout />
            <span>Sign out</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * In-flow rather than an overlay: it pushes the page down instead of covering it, so it needs no
 * scrim, no scroll lock and no focus trap, and tab order stays in document order. It is a
 * disclosure region, not a dialog, so it deliberately carries no role="dialog"/aria-modal.
 */
function NavDrawer({ session, signOut, initials, onNavigate }) {
  const ref = useClickAway(true, onNavigate)

  return (
    <nav id="nav-drawer" className="nav-drawer" aria-label="Menu" ref={ref}>
      {NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="user-text">
            <span className="user-name">{session.displayName || session.email}</span>
            <span className="user-role">{roleLabel(session.role)}</span>
          </span>
        </div>
        <button
          type="button"
          className="nav-item"
          onClick={() => {
            onNavigate()
            signOut()
          }}
        >
          <IconLogout />
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  )
}
