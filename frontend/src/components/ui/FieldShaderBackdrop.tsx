"use client";

import React, { useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/providers/ThemeProvider";
import { cn } from "@/lib/utils";

const ShaderGradientCanvas = dynamic(
  () => import("shadergradient").then((mod) => mod.ShaderGradientCanvas),
  { ssr: false }
);

const ShaderGradient = dynamic(
  () => import("shadergradient").then((mod) => mod.ShaderGradient),
  { ssr: false }
);

export interface FieldShaderBackdropProps {
  className?: string;
  /** Surface subtlety preset */
  intensity?: "subtle" | "ambient";
  /** Optional shader geometry variant */
  type?: "waterPlane" | "plane" | "sphere";
}

function canUseWebGL(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
        canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true })
    );
  } catch {
    return false;
  }
}

const subscribeNoop = () => () => {};

function subscribeReducedMotion(callback: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener?.("change", callback);
  return () => mq.removeEventListener?.("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function FieldShaderBackdrop({
  className,
  intensity = "subtle",
  type = "waterPlane",
}: FieldShaderBackdropProps) {
  const { theme } = useTheme();
  const webglReady = useSyncExternalStore(subscribeNoop, canUseWebGL, () => false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  const isDark = theme === "dark";
  const palette = isDark
    ? { c1: "#3E520E", c2: "#161E0F", c3: "#89A548" }
    : { c1: "#DFECC6", c2: "#8E9C78", c3: "#F4F7EE" };

  return (
    <div
      aria-hidden="true"
      data-testid="field-shader-backdrop"
      className={cn(
        "pointer-events-none overflow-hidden select-none transition-opacity duration-500 [transition-timing-function:var(--ease-out)]",
        intensity === "ambient"
          ? "opacity-40 dark:opacity-50"
          : "opacity-28 dark:opacity-38",
        className
      )}
    >
      {/* Silky OKLCH fallback wash visible immediately before WebGL initializes */}
      <div className="bg-oklch-wash absolute inset-0" />

      {webglReady && (
        <ShaderGradientCanvas
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
          pixelDensity={1}
          fov={42}
        >
          <ShaderGradient
            control="props"
            type={type}
            animate={reducedMotion ? "off" : "on"}
            uSpeed={0.18}
            uStrength={2.2}
            uDensity={1.15}
            uFrequency={4.2}
            uAmplitude={1.4}
            color1={palette.c1}
            color2={palette.c2}
            color3={palette.c3}
            brightness={isDark ? 0.95 : 1.15}
            grain="on"
            lightType="3d"
            cAzimuthAngle={180}
            cPolarAngle={85}
            cDistance={3.2}
            cameraZoom={1}
          />
        </ShaderGradientCanvas>
      )}
    </div>
  );
}
