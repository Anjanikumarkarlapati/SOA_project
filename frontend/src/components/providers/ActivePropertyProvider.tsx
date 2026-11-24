"use client";

import React, { createContext, useContext } from "react";
import { useFarmStore, type FarmProperty } from "@/lib/property-store";

export interface ActivePropertyContextValue {
  properties: FarmProperty[];
  activeProperty: FarmProperty | null;
  activePropertyId: string | null;
  setActivePropertyId: (id: string) => void;
}

const ActivePropertyContext = createContext<ActivePropertyContextValue | null>(null);

export function ActivePropertyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const setActiveProperty = useFarmStore((s) => s.setActiveProperty);

  const activeProperty =
    properties.find((p) => p.id === activePropertyId) ?? properties[0] ?? null;

  return (
    <ActivePropertyContext.Provider
      value={{
        properties,
        activeProperty,
        activePropertyId: activeProperty?.id ?? null,
        setActivePropertyId: setActiveProperty,
      }}
    >
      {children}
    </ActivePropertyContext.Provider>
  );
}

export function useActiveProperty(): ActivePropertyContextValue {
  const ctx = useContext(ActivePropertyContext);
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const setActiveProperty = useFarmStore((s) => s.setActiveProperty);

  if (ctx) return ctx;
  const activeProperty =
    properties.find((p) => p.id === activePropertyId) ?? properties[0] ?? null;
  return {
    properties,
    activeProperty,
    activePropertyId: activeProperty?.id ?? null,
    setActivePropertyId: setActiveProperty,
  };
}
