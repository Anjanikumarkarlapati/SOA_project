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
 * Delivers the Supabase access token once the implicit-flow redirect has been consumed. After
 * Google bounces back, the token sits in the URL hash and supabase-js processes it on a later
 * tick, so a one-shot getSession() on mount can run before the session exists and miss it. This
 * checks the restored session now AND listens for the SIGNED_IN event, so the token is handed to
 * the callback exactly once whenever it lands. Returns an unsubscribe function.
 */
export function onSupabaseSignIn(onToken) {
  if (!supabaseEnabled) return () => {}
  let active = true
  let subscription

  getClient().then((supabase) => {
    if (!supabase || !active) return
    // Session may already be restored by the time the client finishes loading.
    supabase.auth.getSession().then(({ data }) => {
      if (active && data.session?.access_token) onToken(data.session.access_token)
    })
    // Or it arrives a tick later when the hash is processed.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && event === 'SIGNED_IN' && session?.access_token) onToken(session.access_token)
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
