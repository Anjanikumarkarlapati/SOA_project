import { useCallback, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  IconAssistant,
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
import { useI18n } from './i18n/react'
import LanguageSwitcher from './i18n/LanguageSwitcher'

const NAV = [
  { to: '/', label: 'nav.dashboard', Icon: IconDashboard, end: true },
  { to: '/sensors', label: 'nav.sensors', Icon: IconSensor },
  { to: '/crops', label: 'nav.crops', Icon: IconCrop },
  { to: '/irrigation', label: 'nav.irrigation', Icon: IconValve },
  { to: '/assistant', label: 'nav.assistant', Icon: IconAssistant },
]

/** The offline demo has no backend, so only the browser-side assistant is reachable. */
const DEMO_NAV = NAV.filter((item) => item.to === '/assistant')

/** Titles live with the routes so the page heading stays a single source of truth. */
function pageHeading(pathname) {
  // Detail pages keep the sentence headline; the ID is long and unbroken, so it goes underneath
  // instead of being set at headline size, where it wrapped mid-word on phones.
  if (pathname.startsWith('/sensors/')) {
    return { title: 'head.sensor', subtitle: decodeURIComponent(pathname.split('/')[2]), raw: true }
  }
  if (pathname.startsWith('/crops/')) {
    return { title: 'head.crop', subtitle: decodeURIComponent(pathname.split('/')[2]), raw: true }
  }
  switch (pathname) {
    // List pages get the reference's headline treatment: a short sentence, full stop included.
    case '/sensors':
      return { title: 'head.sensors', subtitle: 'head.sensorsSub' }
    case '/crops':
      return { title: 'head.crops', subtitle: 'head.cropsSub' }
    case '/assistant':
      return { title: 'head.assistant', subtitle: 'head.assistantSub' }
    case '/irrigation':
      return { title: 'head.irrigation', subtitle: 'head.irrigationSub' }
    default:
      return { title: 'head.dashboard', subtitle: 'head.dashboardSub' }
  }
}

function initialsOf(session) {
  return (session.displayName || session.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/** The API sends roles as constants ("ADMIN"); people read them as a translated word. */
function roleLabel(role, t) {
  return role ? t(`role.${role}`) : ''
}

export default function Layout() {
  const { session, isDemo, signOut } = useSession()
  const nav = isDemo ? DEMO_NAV : NAV
  const [theme, toggleTheme] = useTheme()
  const { t } = useI18n()
  const { title, subtitle, raw } = pageHeading(useLocation().pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = initialsOf(session)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t('shell.skip')}
      </a>

      <header className="topbar">
        <Link to="/" className="brand">
          {t('app.brand')}
        </Link>

        <nav className="nav-links" aria-label={t('nav.primary')}>
          {nav.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              {t(label)}
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <LanguageSwitcher />

          <button
            type="button"
            className="btn btn-quiet btn-icon"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? t('shell.dark') : t('shell.light')}
          >
            {theme === 'light' ? <IconMoon /> : <IconSun />}
          </button>

          <AccountMenu session={session} signOut={signOut} initials={initials} />

          <button
            type="button"
            className="btn btn-quiet btn-icon hamburger"
            aria-expanded={menuOpen}
            aria-controls="nav-drawer"
            aria-label={menuOpen ? t('shell.closeMenu') : t('shell.openMenu')}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </header>

      {menuOpen ? (
        <NavDrawer nav={nav} session={session} signOut={signOut} initials={initials} onNavigate={closeMenu} />
      ) : null}

      <main className="content" id="main-content" tabIndex={-1}>
        <div className="page-head">
          <h1 className="page-title">{t(title)}</h1>
          <p className="page-subtitle">{raw ? subtitle : t(subtitle)}</p>
        </div>
        <Outlet />
      </main>

      <ChatBot />
    </div>
  )
}

/** Identity and sign-out, collapsed into the bar so the nav stays a single line. */
function AccountMenu({ session, signOut, initials }) {
  const { t } = useI18n()
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
            <div className="user-role">{roleLabel(session.role, t)}</div>
          </div>
          <button type="button" className="nav-item" onClick={signOut}>
            <IconLogout />
            <span>{t('shell.signOut')}</span>
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
function NavDrawer({ nav, session, signOut, initials, onNavigate }) {
  const { t } = useI18n()
  const ref = useClickAway(true, onNavigate)

  return (
    <nav id="nav-drawer" className="nav-drawer" aria-label={t('nav.menu')} ref={ref}>
      {nav.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Icon />
          <span>{t(label)}</span>
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="user-text">
            <span className="user-name">{session.displayName || session.email}</span>
            <span className="user-role">{roleLabel(session.role, t)}</span>
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
          <span>{t('shell.signOut')}</span>
        </button>
      </div>
    </nav>
  )
}
