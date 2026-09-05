import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, clearSession, loadSession, saveSession } from './api'

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

  const signOut = useCallback(async () => {
    if (session?.token) {
      // Best effort - the local session goes either way.
      await api.logout(session.token).catch(() => {})
    }
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
      signOut,
    }),
    [session, signIn, signUp, signOut],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('useSession must be used inside SessionProvider')
  return context
}

/** Fetch-on-mount with polling, shared by every screen. */
export function usePolling(loader, deps, intervalMs = 15000) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const data = await loader()
        if (!cancelled) setState({ data, error: null, loading: false })
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
  }, deps)

  return state
}

const THEME_KEY = 'agritech.theme'

export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light')

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))]
}
