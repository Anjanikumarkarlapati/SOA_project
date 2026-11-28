"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Sun, Moon, ShieldCheck, Activity, Sprout } from "lucide-react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { MEDIA_MANIFEST, type MediaId } from "@/lib/media-manifest";
import { AgriTechLogo } from "@/components/brand/AgriTechLogo";
import { LiquidMetalLogo } from "@/components/brand/LiquidMetalLogo";
import { AuthSlabFrame, BezelCard } from "@/components/ui/BezelCard";
import { FieldShaderBackdrop } from "@/components/ui/FieldShaderBackdrop";
import { useTheme } from "@/components/providers/ThemeProvider";

export interface AuthSplitShellProps {
  mediaId: MediaId;
  editorialBadge: string;
  editorialTitle: string;
  editorialCopy: string;
  children: React.ReactNode;
}

export function AuthSplitShell({
  mediaId,
  editorialBadge,
  editorialTitle,
  editorialCopy,
  children,
}: AuthSplitShellProps) {
  const media = MEDIA_MANIFEST[mediaId];
  const { theme, toggleTheme } = useTheme();

  return (
    <div
      data-testid="auth-split-shell"
      className="relative min-h-screen overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between px-5 py-6 sm:px-8 lg:px-10"
    >
      <FieldShaderBackdrop
        className="absolute inset-x-0 top-0 h-[420px] [mask-image:linear-gradient(to_bottom,black_25%,transparent_100%)]"
        intensity="ambient"
      />
      {/* Clean Editorial Top Bar */}
      <header className="relative z-10 mx-auto flex w-full max-w-[1200px] items-center justify-between border-b border-[var(--border-default)] pb-4">
        <Link
          href="/"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]"
        >
          <AgriTechLogo size="md" subtitle="" />
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-1.5 font-mono text-[11px] text-[var(--text-secondary)]">
            <span
              className="h-2 w-2 rounded-full bg-[var(--status-good)]"
              aria-hidden="true"
            />
            CLOUD SYNC · OFFLINE FIELD READY
          </span>

          <IconButton
            onClick={toggleTheme}
            label={
              theme === "dark" ? "Switch to Daylight mode" : "Switch to Night Field mode"
            }
            variant="secondary"
            size="md"
            icon={
              theme === "dark" ? (
                <Sun className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
              )
            }
            className="min-h-[44px] min-w-[44px] rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]"
          />
        </div>
      </header>

      {/* 12-Column Split-Screen Core */}
      <div className="relative z-10 mx-auto my-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-10 py-10 lg:grid-cols-12 lg:gap-14 surface-enter">
        {/* Left 6 Columns: Editorial Field Showcase */}
        <aside
          aria-label="AgriTech field telemetry preview"
          className="order-2 lg:order-1 lg:col-span-6 flex flex-col gap-6"
        >
          <div className="flex items-center gap-4">
            <LiquidMetalLogo size={64} className="shrink-0" />
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] bg-[var(--accent-wash)] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-primary)]">
                <Sprout className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
                {editorialBadge}
              </span>
              <h2 className="mt-2 font-serif-display text-2xl sm:text-3xl leading-tight text-[var(--text-primary)]">
                {editorialTitle}
              </h2>
            </div>
          </div>

          <AuthSlabFrame className="mx-2 sm:mx-0">
            <div className="photo-frame relative aspect-[16/10] w-full overflow-hidden rounded-[24px] border border-[var(--border-default)]">
              <Image
                src={media.src}
                alt={media.alt}
                fill
                sizes="(min-width: 1024px) 540px, 100vw"
                className="object-cover photo-duotone"
                priority
              />
              {/* Crisp Dark Glass Caption Strip */}
              <div className="absolute inset-x-3 bottom-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/20 bg-black/72 px-3.5 py-2 text-xs text-white backdrop-blur-md">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#DFECC6]">
                  {media.creditNote}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-white/80">
                  20.2961° N · 85.8245° E
                </span>
              </div>
            </div>
          </AuthSlabFrame>

          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            {editorialCopy}
          </p>

          {/* Clean Telemetry Strip */}
          <div className="grid grid-cols-3 gap-3">
            <BezelCard innerClassName="p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                <Activity className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
                Root Moisture
              </div>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-primary)]">
                34.8%
              </p>
            </BezelCard>
            <BezelCard innerClassName="p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                <Sprout className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
                Canopy VPD
              </div>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-primary)]">
                1.12 kPa
              </p>
            </BezelCard>
            <BezelCard innerClassName="p-3.5">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
                <ShieldCheck className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
                FieldShield
              </div>
              <p className="mt-1 font-mono text-lg font-medium tabular-nums text-[var(--text-primary)]">
                11 Scripts
              </p>
            </BezelCard>
          </div>
        </aside>

        {/* Right 6 Columns: Primary Auth Card (<main> holds the single page <h1>) */}
        <main className="order-1 lg:order-2 lg:col-span-6">
          <BezelCard
            elevated
            className="mx-auto w-full max-w-md"
            innerClassName="p-6 sm:p-8"
          >
            {children}
          </BezelCard>
        </main>
      </div>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-2 border-t border-[var(--border-default)] pt-4 font-mono text-[11px] text-[var(--text-secondary)]">
        <span>AGRITECH FIELD HUB · FOR FARMERS &amp; FIELD ORGANIZERS</span>
        <span>WCAG 2.2 AA · LOCAL-FIRST TELEMETRY</span>
      </footer>
    </div>
  );
}
