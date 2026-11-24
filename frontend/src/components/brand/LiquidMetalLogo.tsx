"use client";

import React, { useEffect, useRef, useState } from "react";
import { useReducedMotionPreference } from "@/components/providers/MotionProvider";

export interface LiquidMetalLogoProps {
  size?: number;
  className?: string;
}

/**
 * Interactive sage-olive specular geometric botanical crest with
 * IntersectionObserver off-screen pause, prefers-reduced-motion static frame,
 * and crisp SVG fallback for headless / JSDOM environments.
 */
export function LiquidMetalLogo({ size = 84, className = "" }: LiquidMetalLogoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const reducedMotion = useReducedMotionPreference();
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (
      !canvas ||
      !container ||
      typeof window === "undefined" ||
      (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent))
    ) {
      return;
    }

    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      ctx = null;
    }
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    setCanvasReady(true);

    let rafId = 0;
    let isVisible = true;
    let phase = 0.65;

    const drawFrame = (t: number) => {
      if (!ctx) return;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const shimmerX = cx + Math.cos(t) * (size * 0.24);
      const shimmerY = cy + Math.sin(t * 1.2) * (size * 0.22);

      // Outer Area sage-olive metallic bezel
      const badgeGrad = ctx.createRadialGradient(
        shimmerX,
        shimmerY,
        size * 0.04,
        cx,
        cy,
        size * 0.56
      );
      badgeGrad.addColorStop(0, "#DFECC6");
      badgeGrad.addColorStop(0.45, "#8E9C78");
      badgeGrad.addColorStop(0.85, "#485C11");
      badgeGrad.addColorStop(1, "#2A360A");

      ctx.save();
      ctx.beginPath();
      ctx.roundRect(3, 3, size - 6, size - 6, Math.round(size * 0.24));
      ctx.fillStyle = badgeGrad;
      ctx.fill();
      ctx.lineWidth = 1.25;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
      ctx.stroke();

      // Inner deep botanical olive field
      ctx.beginPath();
      ctx.roundRect(7, 7, size - 14, size - 14, Math.round(size * 0.19));
      ctx.fillStyle = "#3E500F";
      ctx.fill();

      // Geometric botanical-horizon emblem scaled to 64x64 coordinate space
      const scale = size / 64;
      ctx.scale(scale, scale);

      // Contour horizon arc
      const arcPath = new Path2D("M17 44.5C24.5 39 39.5 39 47 44.5");
      ctx.lineWidth = 2.8;
      ctx.lineCap = "round";
      ctx.strokeStyle = "#DFECC6";
      ctx.stroke(arcPath);

      // Left leaf
      const leftLeaf = new Path2D("M32 39C23 37 18.5 29.5 21 20C27.5 20.5 32 25.5 32 34.5Z");
      ctx.fillStyle = "rgba(223, 236, 198, 0.88)";
      ctx.fill(leftLeaf);

      // Right ascending canopy leaf with crisp specular sheen
      const leafSheen = ctx.createLinearGradient(
        26 + Math.sin(t) * 6,
        14,
        46 - Math.cos(t) * 6,
        38
      );
      leafSheen.addColorStop(0, "#FFFFFF");
      leafSheen.addColorStop(0.55, "#F5F9EE");
      leafSheen.addColorStop(1, "#DFECC6");

      const rightLeaf = new Path2D("M32 36.5C41.5 34.5 46 25.5 43.5 15C36.5 16 32 22 32 32.5Z");
      ctx.fillStyle = leafSheen;
      ctx.fill(rightLeaf);

      // Apex telemetry precision node
      ctx.beginPath();
      ctx.arc(32, 14.5, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#DFECC6";
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      if (!isVisible) return;
      phase += 0.022;
      drawFrame(phase);
      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    drawFrame(phase);
    if (!reducedMotion) {
      rafId = window.requestAnimationFrame(tick);
    }

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          isVisible = entry.isIntersecting;
          if (isVisible && !reducedMotion) {
            window.cancelAnimationFrame(rafId);
            rafId = window.requestAnimationFrame(tick);
          } else {
            window.cancelAnimationFrame(rafId);
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(container);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [size, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      data-testid="liquid-metal-logo"
    >
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size }}
        className="block rounded-[18px]"
        aria-hidden="true"
      />
      {!canvasReady && (
        <img
          src="/logo-mark.svg"
          alt="AgriTech emblem"
          width={size}
          height={size}
          className="rounded-[18px]"
        />
      )}
    </div>
  );
}
