"use client";

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";
import { useFarmStore } from "@/lib/property-store";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode, origin?: { x: number; y: number }) => void;
  toggleTheme: (event?: unknown) => void;
}

const STORAGE_KEY = "agritech-theme";

function applyThemeToDocument(next: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.dataset.theme = next;
}

function setRadialOrigin(origin?: { x: number; y: number }) {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const x = origin?.x ?? Math.round(window.innerWidth * 0.85);
  const y = origin?.y ?? 32;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  );
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--theme-x", `${x}px`);
  rootStyle.setProperty("--theme-y", `${y}px`);
  rootStyle.setProperty("--theme-r", `${Math.ceil(radius)}px`);
}

function extractClickOrigin(event?: unknown): { x: number; y: number } | undefined {
  if (!event || typeof event !== "object") return undefined;
  const e = event as { clientX?: number; clientY?: number; currentTarget?: HTMLElement | null };
  if (typeof e.clientX === "number" && typeof e.clientY === "number" && (e.clientX > 0 || e.clientY > 0)) {
    return { x: e.clientX, y: e.clientY };
  }
  if (e.currentTarget && typeof e.currentTarget.getBoundingClientRect === "function") {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  return undefined;
}

const defaultContext: ThemeContextValue = {
  theme: "light",
  setTheme: (next: ThemeMode) => applyThemeToDocument(next),
  toggleTheme: () => {
    if (typeof document === "undefined") return;
    const isDark = document.documentElement.classList.contains("dark");
    applyThemeToDocument(isDark ? "light" : "dark");
  },
};

const ThemeContext = createContext<ThemeContextValue>(defaultContext);

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener("agritech-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("agritech-theme-change", callback);
  };
}

function getStoredThemeSnapshot(): ThemeMode | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "dark" || v === "light" ? v : null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const storeTheme = useFarmStore((s) => s.preferences?.theme);
  const setPreferences = useFarmStore((s) => s.setPreferences);
  const stored = useSyncExternalStore(subscribeTheme, getStoredThemeSnapshot, () => null);
  const theme: ThemeMode = stored ?? (storeTheme === "dark" ? "dark" : "light");

  useEffect(() => {
    applyThemeToDocument(theme);
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemeMode, origin?: { x: number; y: number }) => {
      const commit = () => {
        applyThemeToDocument(next);
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, next);
          window.dispatchEvent(new Event("agritech-theme-change"));
        }
        if (setPreferences) {
          setPreferences({ theme: next });
        }
      };

      if (typeof document === "undefined" || typeof window === "undefined") {
        commit();
        return;
      }

      const reducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const docWithVT = document as Document & {
        startViewTransition?: (cb: () => void) => { finished: Promise<void> };
      };

      if (!reducedMotion && typeof docWithVT.startViewTransition === "function") {
        setRadialOrigin(origin);
        try {
          docWithVT.startViewTransition(() => {
            commit();
          });
          return;
        } catch {
          // Fallback to direct transition if View Transition is unavailable
        }
      }

      commit();
    },
    [setPreferences]
  );

  const toggleTheme = useCallback(
    (event?: unknown) => {
      setTheme(theme === "dark" ? "light" : "dark", extractClickOrigin(event));
    },
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
