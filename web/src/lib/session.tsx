'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { api, clearSession, loadSession, saveSession, type Session } from './api'
import { demoSession, isDemoSession } from './farm/demo'
import { clearProfile } from './farm/engine'

interface SessionValue {
  session: Session | null
  token: string | undefined
  isAdmin: boolean
  /** Offline India demo: no backend, only the farm onboarding and assistant. */
  isDemo: boolean
  /** False until the client has read localStorage, so guards do not redirect during hydration. */
  ready: boolean
  signIn: (email: string, password: string) => Promise<Session>
  signUp: (body: unknown) => Promise<Session>
  signInDemo: () => Session
  signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  // localStorage is client-only; reading it during render would desync hydration, so the
  // session is restored in an effect and `ready` gates anything that depends on it.
  useEffect(() => {
    setSession(loadSession())
    setReady(true)
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  /** Registration returns the same token shape as login, so a new account signs straight in. */
  const signUp = useCallback(async (body: unknown) => {
    const result = await api.register(body)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  /** Every demo start is a brand-new farmer, so the onboarding wizard always runs. */
  const signInDemo = useCallback(() => {
    const result = demoSession()
    clearProfile(result.email)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  const signOut = useCallback(async () => {
    if (session?.token && !isDemoSession(session)) {
      // Best effort - the local session goes either way.
      await api.logout(session.token).catch(() => {})
    }
    clearSession()
    setSession(null)
  }, [session])

  const value = useMemo<SessionValue>(
    () => ({
      session,
      token: session?.token,
      // Role comes from the JWT the server issued, never from a client-side choice.
      isAdmin: session?.role === 'ADMIN',
      isDemo: isDemoSession(session),
      ready,
      signIn,
      signUp,
      signInDemo,
      signOut,
    }),
    [session, ready, signIn, signUp, signInDemo, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}

/** Fetch-on-mount with polling, shared by every screen. */
export function usePolling<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  intervalMs = 15000,
): { data: T | null; error: Error | null; loading: boolean } {
  const [state, setState] = useState<{ data: T | null; error: Error | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const data = await loader()
        if (!cancelled) setState({ data, error: null, loading: false })
      } catch (error) {
        if (!cancelled) setState((prev) => ({ ...prev, error: error as Error, loading: false }))
      }
    }

    run()
    if (!intervalMs) {
      return () => {
        cancelled = true
      }
    }

    const timer = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

const THEME_KEY = 'agritech.theme'

export function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState('light')

  // The inline script in the document head has already applied the class; mirror it into
  // state so the toggle starts from the right value instead of fighting it.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light'
      document.documentElement.classList.toggle('dark', next === 'dark')
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        // Private browsing: the theme just will not persist.
      }
      return next
    })
  }, [])

  return [theme, toggle]
}

/**
 * The stylesheet collapses CSS transitions under prefers-reduced-motion, but the chart library
 * animates in JavaScript, so it needs to be told separately.
 */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
