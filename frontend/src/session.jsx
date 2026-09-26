import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSession, loadSession, saveSession } from './api'
import { startGoogleSignIn, supabaseSignOut } from './supabase'
import { demoSession, isDemoSession } from './farm/demo'
import { clearProfile } from './farm/engine'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => loadSession())

  const signIn = useCallback(async (email, password) => {
    const result = await api.login(email, password)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  /** Registration returns the same token shape as login, so a new account signs straight in. */
  const signUp = useCallback(async (body) => {
    const result = await api.register(body)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  /** Starts the Google OAuth redirect via Supabase; the app JWT is minted on return. */
  const signInWithGoogle = useCallback(async () => {
    await startGoogleSignIn()
  }, [])

  /** After the Supabase redirect, trade its access token for our own app JWT. */
  const exchangeSupabaseToken = useCallback(async (accessToken) => {
    const result = await api.google(accessToken)
    saveSession(result)
    setSession(result)
    return result
  }, [])

  /** Offline India demo: every start is a brand-new farmer, so onboarding always runs. */
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
    await supabaseSignOut()
    clearSession()
    setSession(null)
  }, [session])

  const value = useMemo(
    () => ({
      session,
      token: session?.token,
      // Role comes from the JWT the server issued, never from a client-side choice (doc 4.1).
      isAdmin: session?.role === 'ADMIN',
      isDemo: isDemoSession(session),
      signIn,
      signInDemo,
      signUp,
      signInWithGoogle,
      exchangeSupabaseToken,
      signOut,
    }),
    [session, signIn, signInDemo, signUp, signInWithGoogle, exchangeSupabaseToken, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}

/**
 * Fetch-on-mount with polling, shared by every screen.
 *
 * `updatedAt` and `refresh` exist because this is an operations console: a stale reading looks
 * exactly like a fresh one, so screens need to be able to say when they last heard from the farm
 * and let the operator ask again without reloading the page.
 */
export function usePolling(loader, deps, intervalMs = 15000) {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
    updatedAt: null,
  })
  const [reloadKey, setReloadKey] = useState(0)

  const refresh = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const data = await loader()
        if (!cancelled) setState({ data, error: null, loading: false, updatedAt: Date.now() })
      } catch (error) {
        if (!cancelled) setState((prev) => ({ ...prev, error, loading: false }))
      }
    }

    run()
    if (!intervalMs) return () => { cancelled = true }

    const timer = setInterval(run, intervalMs)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey])

  return { ...state, refresh }
}

const THEME_KEY = 'agritech.theme'

/**
 * The pre-paint script in index.html has already resolved and applied the theme, so this reads
 * back what it decided rather than guessing again. Falling back to the system preference means a
 * tablet left in night mode opens dark instead of flashing a white screen at someone in a field
 * at 5am.
 */
export function useTheme() {
  const [theme, setTheme] = useState(
    () =>
      document.documentElement.dataset.theme ||
      localStorage.getItem(THEME_KEY) ||
      (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  )

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0f110c' : '#ffffff')
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}
