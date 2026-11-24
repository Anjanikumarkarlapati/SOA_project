"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { authApi, isBackendUnreachableError } from "@/lib/api";
import {
  buildUser,
  createOfflineUser,
  isOfflineToken,
  useAuthStore,
  type AuthUser,
} from "@/lib/auth";
import {
  onSupabaseSignIn,
  startGoogleSignIn,
  supabaseEnabled,
  supabaseSignOut,
} from "@/lib/supabase";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  supabaseEnabled: boolean;
  googleBusy: boolean;
  googleError: string | null;
  clearGoogleError: () => void;
  setAuth: (user: AuthUser) => void;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,
  supabaseEnabled: false,
  googleBusy: false,
  googleError: null,
  clearGoogleError: () => {},
  setAuth: () => {},
  signInWithGoogle: async () => {},
  logout: () => {},
});

const emptySubscribe = () => () => {};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const storeHydrated = useAuthStore((s) => s._hasHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const clearUser = useAuthStore((s) => s.clearUser);
  const storeAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const isClientMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
  const isHydrated = isClientMounted && storeHydrated;
  const isAuthenticated = isClientMounted && storeAuthenticated;

  useEffect(() => {
    if (!useAuthStore.persist && !useAuthStore.getState()._hasHydrated) {
      useAuthStore.getState().setHasHydrated(true);
    }
    const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
      if (!useAuthStore.getState()._hasHydrated) {
        useAuthStore.getState().setHasHydrated(true);
      }
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Global Supabase Google OAuth return listener: handles redirects landing on /, /login, or /signup
  useEffect(() => {
    if (!supabaseEnabled || isAuthenticated) return;
    let cancelled = false;

    const unsubscribe = onSupabaseSignIn(async (accessToken, profile) => {
      if (cancelled) return;
      setGoogleBusy(true);
      setGoogleError(null);
      try {
        const resp = await authApi.google(accessToken);
        if (cancelled) return;
        setUser(buildUser(resp));

        if (typeof window !== "undefined") {
          const cleanUrl = window.location.pathname + window.location.search;
          window.history.replaceState(null, "", cleanUrl);
          const p = window.location.pathname;
          if (p === "/" || p === "/login" || p === "/signup") {
            (router.push ?? router.replace)?.("/dashboard");
          }
        }
      } catch (err) {
        if (!cancelled) {
          if (isBackendUnreachableError(err) && profile?.email) {
            setUser(
              createOfflineUser({
                email: profile.email,
                name: profile.name,
              })
            );
            if (typeof window !== "undefined") {
              const cleanUrl = window.location.pathname + window.location.search;
              window.history.replaceState(null, "", cleanUrl);
              const p = window.location.pathname;
              if (p === "/" || p === "/login" || p === "/signup") {
                (router.push ?? router.replace)?.("/dashboard");
              }
            }
            return;
          }
          setGoogleError(
            err instanceof Error && err.message
              ? err.message
              : "Google sign-in could not be completed. Please try again or use offline field mode."
          );
        }
      } finally {
        if (!cancelled) setGoogleBusy(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [isAuthenticated, router, setUser]);

  const signInWithGoogle = useCallback(async (redirectPath = "/login") => {
    setGoogleError(null);
    setGoogleBusy(true);
    try {
      await startGoogleSignIn(redirectPath);
    } catch (err) {
      setGoogleError(
        err instanceof Error && err.message
          ? err.message
          : "Unable to start Google sign-in."
      );
      setGoogleBusy(false);
    }
  }, []);

  const logout = useCallback(() => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.token && !isOfflineToken(currentUser.token)) {
      void authApi.logout(currentUser.token, currentUser.refreshToken).catch(() => {});
    }
    void supabaseSignOut();
    clearUser();
  }, [clearUser]);

  const clearGoogleError = useCallback(() => setGoogleError(null), []);
  const resolvedUser = isClientMounted ? user : null;

  return (
    <AuthContext.Provider
      value={{
        user: resolvedUser,
        token: resolvedUser?.token ?? null,
        isAuthenticated,
        isHydrated,
        supabaseEnabled,
        googleBusy,
        googleError,
        clearGoogleError,
        setAuth: setUser,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
