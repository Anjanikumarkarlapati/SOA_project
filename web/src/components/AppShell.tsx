'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { Moon, Plant, SignOut, Sun } from '@phosphor-icons/react'
import { IconButton } from '@/components/IconButton'
import { SpotlightNavbar, type NavItem } from '@/components/ui/spotlight-navbar'
import { GooeySearch } from '@/components/ui/gooey-search'
import { useSession, useTheme } from '@/lib/session'
import { loadProfile } from '@/lib/farm/engine'

const NAV: NavItem[] = [
  { label: 'Dashboard', href: '/' },
  { label: 'Sensors', href: '/sensors' },
  { label: 'Crops', href: '/crops' },
  { label: 'Irrigation', href: '/irrigation' },
  { label: 'Farm Assistant', href: '/assistant' },
]

/** The offline demo has no backend, so only the browser-side assistant is reachable. */
const DEMO_NAV: NavItem[] = [{ label: 'Farm Assistant', href: '/assistant' }]

/**
 * Everything a signed-in user sees sits inside this shell: brand, spotlight navigation,
 * search, and the theme toggle.
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { session, ready, isDemo, signOut } = useSession()
  const [theme, toggleTheme] = useTheme()
  const nav = isDemo ? DEMO_NAV : NAV

  // Route guard. Waits for `ready` so a hard refresh does not bounce a signed-in user to
  // the login screen before localStorage has been read.
  useEffect(() => {
    if (ready && !session) router.replace('/login')
  }, [ready, session, router])

  // A farmer who has not set up a farm yet goes through onboarding first: crop, location,
  // field, sensors. The demo account lives only on the assistant screen.
  useEffect(() => {
    if (!ready || !session) return
    if (session.role === 'FARMER' && !loadProfile(session.email)) router.replace('/onboarding')
    else if (isDemo && !pathname.startsWith('/assistant')) router.replace('/assistant')
  }, [ready, session, isDemo, pathname, router])

  // Deepest match wins, so /sensors/SENSOR-001 still highlights Sensors.
  const activeIndex = useMemo(() => {
    let best = 0
    nav.forEach((item, i) => {
      if (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)) best = i
    })
    return best
  }, [pathname, nav])

  // What the search box can take you to. Pages first, then the crop fields by name.
  const searchTargets = useMemo(
    () => [
      'Dashboard',
      'Sensors',
      'Crops',
      'Irrigation schedules',
      'Manual valve control',
      'Farm Assistant',
      'North Field',
      'River Paddock',
      'South Terrace',
      'West Block',
    ],
    [],
  )

  const goToResult = (item: string) => {
    const routes: Record<string, string> = {
      Dashboard: '/',
      Sensors: '/sensors',
      Crops: '/crops',
      'Irrigation schedules': '/irrigation',
      'Manual valve control': '/irrigation',
      'Farm Assistant': '/assistant',
      'North Field': '/crops/CROP-FIELD-01',
      'River Paddock': '/crops/CROP-FIELD-02',
      'South Terrace': '/crops/CROP-FIELD-03',
      'West Block': '/crops/CROP-FIELD-04',
    }
    const target = routes[item]
    if (target) router.push(target)
  }

  if (!ready || !session) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">
        Loading workspace...
      </div>
    )
  }

  const initials = (session.displayName || session.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="relative min-h-dvh">
      {/* Atmosphere behind the glass, fixed so it never scrolls away. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -left-52 -top-64 h-[640px] w-[640px] rounded-full bg-brand/15 blur-[110px]" />
        <div className="absolute -bottom-64 -right-44 h-[560px] w-[560px] rounded-full bg-brand/10 blur-[110px]" />
      </div>

      <header className="glass sticky top-0 z-20 border-x-0 border-t-0">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="flex flex-none items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="grid size-8 place-items-center rounded-md bg-brand text-white">
              <Plant size={18} />
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-semibold tracking-tight">AgriTech</span>
              <span className="block text-[11px] text-muted-foreground">Sensing Solutions</span>
            </span>
          </button>

          {/* Spotlight navigation - the highlight tracks the active route. */}
          <nav className="hidden h-full min-w-0 flex-1 justify-center md:flex" aria-label="Primary">
            <SpotlightNavbar
              className="h-full items-center pt-0"
              items={nav}
              defaultActiveIndex={activeIndex}
              onItemClick={(item) => router.push(item.href)}
            />
          </nav>

          <div className="ml-auto flex flex-none items-center gap-2">
            <GooeySearch
              items={searchTargets}
              onSelect={goToResult}
              buttonLabel="Search"
              placeholder="Find a page or field..."
              maxResults={5}
              debounceMs={200}
            />

            <IconButton
              label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </IconButton>

            <span
              className="grid size-8 place-items-center rounded-full bg-brand-wash text-[12px] font-semibold text-brand"
              title={`${session.displayName} (${session.role})`}
            >
              {initials}
            </span>

            <IconButton label="Sign out" onClick={signOut}>
              <SignOut size={20} />
            </IconButton>
          </div>
        </div>

        {/* Under md the spotlight bar moves to its own row so it never squeezes the header. */}
        <nav className="flex h-12 justify-center border-t border-border md:hidden" aria-label="Primary">
          <SpotlightNavbar
            className="h-full items-center pt-0"
            items={nav}
            defaultActiveIndex={activeIndex}
            onItemClick={(item) => router.push(item.href)}
          />
        </nav>
      </header>

      <main id="main" className="relative z-10 mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  )
}
