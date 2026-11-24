// lib/supabase.ts — Lazy Supabase client for Google OAuth PKCE/Implicit sign-in
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const supabaseEnabled = Boolean(supabaseUrl && supabaseAnonKey);

export interface SupabaseGoogleProfile {
  email?: string;
  name?: string;
}

let clientPromise: Promise<SupabaseClient | null> | null = null;

function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!supabaseEnabled || typeof window === "undefined") {
    return Promise.resolve(null);
  }
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(supabaseUrl, supabaseAnonKey)
  );
  return clientPromise;
}

/**
 * Initiates Google OAuth via Supabase. Redirects dynamically back to window.location.origin
 * (so both /, /login, and any host/port work without hardcoded URLs).
 */
export async function startGoogleSignIn(redirectPath = "/login"): Promise<void> {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    throw new Error("Google sign-in via Supabase is not configured");
  }
  const trimmed = redirectPath.trim();
  const safePath =
    trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")
      ? trimmed
      : "/login";
  const redirectTo = `${window.location.origin}${safePath}`;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
  if (error) throw error;
}

/**
 * Listens for a Supabase session restored from URL hash/code after Google OAuth redirect.
 * Checks both existing session and the async SIGNED_IN auth event, firing once per session.
 */
export function onSupabaseSignIn(
  onToken: (accessToken: string, profile?: SupabaseGoogleProfile) => void | Promise<void>
): () => void {
  if (!supabaseEnabled || typeof window === "undefined") {
    return () => {};
  }
  let active = true;
  let delivered = false;
  let unsubscribeFn: (() => void) | undefined;

  const deliverOnce = (
    token?: string,
    user?: { email?: string; user_metadata?: Record<string, unknown> }
  ) => {
    if (!active || delivered || !token) return;
    delivered = true;
    const rawName = user?.user_metadata?.full_name ?? user?.user_metadata?.name;
    const profile: SupabaseGoogleProfile | undefined = user?.email
      ? {
          email: user.email,
          name: typeof rawName === "string" ? rawName : undefined,
        }
      : undefined;
    if (profile) {
      void onToken(token, profile);
    } else {
      void onToken(token);
    }
  };

  void getSupabaseClient().then((supabase) => {
    if (!supabase || !active) return;

    void supabase.auth.getSession().then(({ data }) => {
      deliverOnce(data.session?.access_token, data.session?.user);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        deliverOnce(session?.access_token, session?.user);
      }
    });
    unsubscribeFn = () => data.subscription.unsubscribe();
  });

  return () => {
    active = false;
    unsubscribeFn?.();
  };
}

/** Clears the Supabase client session on logout (separate from AgriTech's session). */
export async function supabaseSignOut(): Promise<void> {
  const supabase = await getSupabaseClient();
  if (supabase) {
    await supabase.auth.signOut().catch(() => {});
  }
}
