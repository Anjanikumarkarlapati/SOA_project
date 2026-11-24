// lib/auth.ts — Zustand auth store with localStorage JWT persistence
"use client";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";

export interface AuthUser {
  token: string;
  refreshToken?: string;
  email: string;
  role: string;
  farmId: string;
  name?: string;
  expiresAt: number; // unix ms
}

interface AuthState {
  user: AuthUser | null;
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;
  setUser: (u: AuthUser) => void;
  clearUser: () => void;
  isAuthenticated: () => boolean;
}

const safeStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (typeof window === "undefined") return null;
      const storage = window.localStorage;
      if (!storage) return null;
      const raw = storage.getItem(name);
      if (!raw) return null;
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage?.setItem(name, value);
    } catch {
      // ignore unavailable or restricted storage
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage?.removeItem(name);
    } catch {
      // ignore unavailable or restricted storage
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setUser: (u) => set({ user: u }),
      clearUser: () => set({ user: null }),
      isAuthenticated: () => {
        const u = get().user;
        return Boolean(
          u &&
            typeof u.token === "string" &&
            u.token.length > 0 &&
            typeof u.expiresAt === "number" &&
            Date.now() < u.expiresAt
        );
      },
    }),
    {
      name: "agritech-auth",
      storage: createJSONStorage(() => safeStateStorage),
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: (preState) => (state) => {
        (state ?? preState)?.setHasHydrated(true);
      },
    }
  )
);

export function buildUser(resp: {
  token: string; refreshToken?: string; email: string;
  role: string; farmId: string; expiresIn: number; name?: string; displayName?: string;
}): AuthUser {
  return {
    token: resp.token,
    refreshToken: resp.refreshToken,
    email: resp.email,
    role: resp.role,
    farmId: resp.farmId,
    name: resp.name ?? resp.displayName,
    expiresAt: Date.now() + resp.expiresIn * 1000,
  };
}

export function isOfflineToken(token?: string | null): boolean {
  return Boolean(token && token.startsWith("offline-"));
}

export function createOfflineUser(
  input: { email?: string; name?: string; role?: string; farmId?: string } = {}
): AuthUser {
  return {
    token: `offline-field-${Date.now()}`,
    email: input.email?.trim() || "farmer@fieldshield.local",
    name: input.name?.trim() || "Field Operator",
    role: input.role ?? "FARMER",
    farmId: input.farmId ?? "offline-farm-1",
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
}
