"use client";

import React, { createContext, useContext, useEffect, useCallback, useSyncExternalStore } from "react";
import { useFarmStore } from "@/lib/property-store";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = "agritech-theme";

function applyThemeToDocument(next: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", next === "dark");
  root.dataset.theme = next;
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
    (next: ThemeMode) => {
      applyThemeToDocument(next);
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, next);
        window.dispatchEvent(new Event("agritech-theme-change"));
      }
      if (setPreferences) {
        setPreferences({ theme: next });
      }
    },
    [setPreferences]
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
