// Supabase project settings -> API. Set these in frontend/.env as:
//   VITE_SUPABASE_URL=https://<project>.supabase.co
//   VITE_SUPABASE_ANON_KEY=<anon public key>
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// False when unconfigured - the UI hides the Google button rather than crashing.
export const supabaseEnabled = Boolean(url && anonKey)

// The client library is loaded on first use instead of at startup: it was most of the main
// bundle, and most sessions never press the Google button.
let client
function getClient() {
  if (!supabaseEnabled) return Promise.resolve(null)
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(url, anonKey))
  return client
}

/**
 * Kicks off Google OAuth through Supabase. This redirects the browser to Google and back to the
 * app; on return, App reads the restored session and posts its access token to /api/auth/google.
 */
export async function startGoogleSignIn() {
  const supabase = await getClient()
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  })
  if (error) throw error
}

/** The Supabase access token for the current session, or null if not signed in with Supabase. */
export async function currentSupabaseToken() {
  const supabase = await getClient()
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * True when the current URL carries an OAuth implicit-flow result - either the token Google
 * bounced back, or an error because the user cancelled or the provider refused.
 */
export function hasAuthRedirectResult() {
  const hash = window.location.hash || ''
  const query = window.location.search || ''
  return (
    hash.includes('access_token=') ||
    hash.includes('error=') ||
    query.includes('error=') ||
    query.includes('code=')
  )
}

/** The OAuth error in the URL, if the provider sent one back instead of a token. */
export function authRedirectError() {
  const params = new URLSearchParams((window.location.hash || '').replace(/^#/, ''))
  const search = new URLSearchParams(window.location.search || '')
  const code = params.get('error') || search.get('error')
  if (!code) return null
  const description = params.get('error_description') || search.get('error_description')
  if (code === 'access_denied') return 'Google sign-in was cancelled.'
  return description ? description.replace(/\+/g, ' ') : 'Google sign-in failed.'
}

/**
 * Consumes an OAuth redirect result before the app renders.
 *
 * Supabase delivers the implicit-flow token in the URL hash, and supabase-js only reads it when
 * the client is constructed. This client is loaded lazily, so on the return leg the router used
 * to rewrite the URL to /login - dropping the hash - several ticks before supabase-js existed to
 * look at it, and the sign-in silently died there. Awaiting this before the first render means
 * the token is already stored in the Supabase session by the time any route is decided.
 *
 * Resolves (rather than rejects) on failure: a broken Supabase must still let the app boot and
 * show its password form.
 */
export async function consumeAuthRedirect() {
  if (!supabaseEnabled || !hasAuthRedirectResult()) return
  try {
    const supabase = await getClient()
    await supabase?.auth.getSession()
  } catch {
    // Ignored: handled as "no session" downstream, where it can be shown to the user.
  }
}

/**
 * Delivers the Supabase access token once the redirect has been consumed. It can already be in
 * the restored session, or arrive a tick later on the SIGNED_IN event, so this covers both and
 * calls back at most once per token. Returns an unsubscribe function.
 */
export function onSupabaseSignIn(onToken) {
  if (!supabaseEnabled) return () => {}
  let active = true
  let delivered = false
  let subscription

  const deliver = (token) => {
    if (!active || delivered || !token) return
    delivered = true
    onToken(token)
  }

  getClient().then((supabase) => {
    if (!supabase || !active) return
    // consumeAuthRedirect() has normally stored the session already.
    supabase.auth.getSession().then(({ data }) => deliver(data.session?.access_token))
    // Or it lands a tick later, when the client finishes processing the URL.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') deliver(session?.access_token)
    })
    subscription = data?.subscription
  })

  return () => {
    active = false
    subscription?.unsubscribe?.()
  }
}

/** Clears the Supabase session (our app JWT is separate and cleared on our own logout). */
export async function supabaseSignOut() {
  const supabase = await getClient()
  if (supabase) await supabase.auth.signOut().catch(() => {})
}
