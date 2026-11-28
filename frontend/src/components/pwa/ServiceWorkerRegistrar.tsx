"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const isSecureOrLocal =
      window.isSecureContext ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!isSecureOrLocal) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker registration is progressive enhancement; ignore restricted WebViews.
    });
  }, []);

  return null;
}
