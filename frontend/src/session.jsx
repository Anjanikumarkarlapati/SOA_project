import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSession, loadSession, saveSession } from './api'
import {
  authRedirectError,
  hasAuthRedirectResult,
  onSupabaseSignIn,
  startGoogleSignIn,
  supabaseEnabled,
  supabaseSignOut,
} from './supabase'

const SessionContext = createContext(null)

/** How long to sit on the "signing you in" screen before handing control back to the user. */
const GOOGLE_EXCHANGE_TIMEOUT_MS = 15000

export function SessionProvider({ children }) {
  const [session, setSession] = useState(() => loadSession())

  // A Google return is still "signing in" even though there is no app session yet. Without this
  // the sign-in form flashes up underneath the exchange, which reads as a failed login.
  const [googlePending, setGooglePending] = useState(
    () => supabaseEnabled && hasAuthRedirectResult() && !authRedirectError(),
  )
  const [googleError, setGoogleError] = useState(() => (supabaseEnabled ? authRedirectError() : null))

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

  /**
   * Trades the Supabase token for our app JWT on the return leg of the redirect.
   *
   * This lives in the provider, not in the sign-in form: the return can land on any route, and
   * the form only mounts on the sign-in tab, so a user who left from the create-account panel
   * had nothing listening when the token arrived.
   */
  useEffect(() => {
    if (!supabaseEnabled) return undefined
    if (!hasAuthRedirectResult() && !loadSession()) return undefined

    // If the token never arrives - Supabase unreachable, a provider that redirected back with
    // nothing usable - the pending screen must still end. Otherwise the app hangs on a spinner
    // with no way back to the password form.
    const timeout = setTimeout(() => {
      setGooglePending((pending) => {
        if (pending) setGoogleError('Google sign-in timed out. Try again, or sign in with your email.')
        return false
      })
    }, GOOGLE_EXCHANGE_TIMEOUT_MS)

    const unsubscribe = onSupabaseSignIn(async (accessToken) => {
      setGooglePending(true)
      try {
        const result = await api.google(accessToken)
        saveSession(result)
        setSession(result)
        setGoogleError(null)
      } catch (error) {
        setGoogleError(error.message || 'Google sign-in failed')
        // Drop the Supabase session too: leaving it behind makes the next attempt look like a
        // no-op, because the restored session fires no fresh SIGNED_IN event.
        await supabaseSignOut()
      } finally {
        clearTimeout(timeout)
        setGooglePending(false)
      }
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  const signOut = useCallback(async () => {
    if (session?.token) {
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
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      googlePending,
      googleError,
      clearGoogleError: () => setGoogleError(null),
    }),
    [session, signIn, signUp, signInWithGoogle, signOut, googlePending, googleError],
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
