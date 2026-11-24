"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const ReducedMotionContext = createContext<boolean>(false);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const isReduced =
        mq.matches || document.documentElement.dataset.reducedMotion === "true";
      setReduced(isReduced);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <ReducedMotionContext.Provider value={reduced}>
      {children}
    </ReducedMotionContext.Provider>
  );
}

export function useReducedMotionPreference(): boolean {
  return useContext(ReducedMotionContext);
}
