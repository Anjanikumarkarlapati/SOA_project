"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { ActivePropertyProvider } from "@/components/providers/ActivePropertyProvider";
import { AgriTechLogo } from "@/components/brand/AgriTechLogo";
import { FieldShaderBackdrop } from "@/components/ui/FieldShaderBackdrop";
import {
  LayoutDashboard,
  MapPin,
  CloudSun,
  Activity,
  Sprout,
  Droplets,
  User,
  Menu,
  X,
  RefreshCw,
  CheckCircle2,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { LanguageSelectorPill } from "@/components/LanguageSelectorPill";
import { LanguageSelectorModal } from "@/components/LanguageSelectorModal";
import { useFarmStore } from "@/lib/property-store";
import { isOfflineToken } from "@/lib/auth";

const PRIMARY_NAV = [
  { href: "/dashboard",       enLabel: "Field Hub",           key: "nav.fieldHub",        icon: LayoutDashboard },
  { href: "/properties",      enLabel: "My Farms",            key: "nav.myFarms",         icon: MapPin },
  { href: "/sensors",         enLabel: "Sensors & Soil",      key: "nav.sensors",         icon: Activity },
  { href: "/climate",         enLabel: "Climate & Advisory",  key: "nav.climate",         icon: CloudSun },
  { href: "/recommendations", enLabel: "Crop Planner",        key: "nav.recommendations", icon: Sprout },
  { href: "/irrigation",      enLabel: "Irrigation & Valves", key: "nav.irrigation",      icon: Droplets },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);

  const properties = useFarmStore((s) => s.properties);
  const syncOutbox = useFarmStore((s) => s.syncOutbox);
  const syncPropertiesFromBackend = useFarmStore((s) => s.syncPropertiesFromBackend);

  useEffect(() => {
    if (!user?.token || isOfflineToken(user.token)) return;
    void syncPropertiesFromBackend(user.token).catch(() => {
      /* offline or unavailable gateway falls back cleanly to persisted properties */
    });
  }, [user?.token, syncPropertiesFromBackend]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const isOffline = !user?.token || isOfflineToken(user.token);
  const queuedCount = syncOutbox.length;

  return (
    <ActivePropertyProvider>
      <div
        className="min-h-screen flex overflow-x-clip bg-[var(--bg-base)] text-[var(--text-primary)]"
      >
        {/* Mobile overlay */}
        {open && (
          <div
            className="fixed inset-0 z-20 bg-black/45 backdrop-blur-[1px] lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 flex flex-col border-r shrink-0 transition-transform duration-200 [transition-timing-function:var(--ease-drawer)]",
            "lg:relative lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
        >
          {/* Brand header */}
          <div
            className="flex items-center justify-between gap-2 px-5 py-4 border-b"
            style={{ borderColor: "var(--border-default)" }}
          >
            <Link href="/dashboard" onClick={() => setOpen(false)}>
              <AgriTechLogo size="sm" subtitle="" />
            </Link>
            <div className="ml-auto lg:hidden">
              <IconButton
                label="Close menu"
                variant="ghost"
                size="md"
                onClick={() => setOpen(false)}
                icon={<X className="w-5 h-5" />}
                className="min-w-[44px] min-h-[44px]"
              />
            </div>
          </div>

          {/* Chronological 6-step Farmer & Organizer Workflow Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label="Main navigation">
            {PRIMARY_NAV.map(({ href, enLabel, key, icon: Icon }) => {
              const active =
                pathname === href ||
                (href !== "/dashboard" && pathname.startsWith(href));
              const localized = t(key, enLabel);
              const accessibleName =
                language === "en" || localized === enLabel ? enLabel : `${enLabel} (${localized})`;

              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={accessibleName}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium transition-[background-color,color,transform] duration-150 [transition-timing-function:var(--ease-out)]",
                    active
                      ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
                      : "hover:bg-[var(--accent-wash)]"
                  )}
                  style={
                    active
                      ? { background: "var(--accent)", color: "var(--on-accent)" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{localized}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer: Settings & Profile */}
          <div className="px-3 py-4 border-t space-y-1.5" style={{ borderColor: "var(--border-default)" }}>
            {(() => {
              const profileEn = "Settings & Profile";
              const profileLoc = t("nav.profile", profileEn);
              const profileActive = pathname.startsWith("/profile");
              const profileAria =
                language === "en" || profileLoc === profileEn
                  ? profileEn
                  : `${profileEn} (${profileLoc})`;
              return (
                <Link
                  href="/profile"
                  aria-label={profileAria}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-medium transition-[background-color,color] duration-150",
                    !profileActive && "hover:bg-[var(--accent-wash)]"
                  )}
                  style={
                    profileActive
                      ? { background: "var(--accent)", color: "var(--on-accent)" }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="truncate">{profileLoc}</span>
                </Link>
              );
            })()}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="relative flex-1 flex flex-col min-w-0">
          <FieldShaderBackdrop
            className="absolute inset-x-0 top-14 h-56 [mask-image:linear-gradient(to_bottom,black_20%,transparent_100%)]"
            intensity="subtle"
          />
          {/* Global Context Top Bar */}
          <header
            className="relative z-20 flex items-center justify-between gap-2 px-4 sm:px-6 py-3 border-b flex-wrap"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="lg:hidden">
                <IconButton
                  label="Open menu"
                  variant="secondary"
                  size="md"
                  onClick={() => setOpen(true)}
                  icon={<Menu className="w-5 h-5" />}
                  className="min-w-[44px] min-h-[44px]"
                />
              </div>

              <Link
                href="/properties"
                className="text-xs font-medium min-h-[38px] px-3 py-1.5 rounded-full border inline-flex items-center gap-1.5 transition-colors hover:bg-[var(--accent-wash)]"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                <span>
                  {properties.length > 0
                    ? `Farms (${properties.length})`
                    : "Farm Portfolio"}
                </span>
              </Link>
            </div>

            {/* Right Context Controls: Sync Status Badge + Astryx Theme Toggle + Language Pill */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1 rounded-full text-[11px] font-medium border"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                  color: queuedCount > 0 ? "var(--status-warning)" : "var(--status-good)",
                }}
                title="FieldShield Sync Outbox Status"
              >
                {queuedCount > 0 ? (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    <span>
                      {isOffline ? "Offline Ledger" : "Outbox"} • {queuedCount} Queued
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{isOffline ? "Field Ledger Ready" : "Online • Synced"}</span>
                  </>
                )}
              </Link>

              <IconButton
                data-testid="app-theme-toggle"
                onClick={toggleTheme}
                label={
                  theme === "dark" ? "Switch to Daylight mode" : "Switch to Night Field mode"
                }
                tooltip={theme === "dark" ? "Daylight mode" : "Night Field mode"}
                variant="secondary"
                size="sm"
                icon={
                  theme === "dark" ? (
                    <Sun className="h-4 w-4 text-[var(--accent-brass)]" aria-hidden="true" />
                  ) : (
                    <Moon className="h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                  )
                }
                className="min-h-[38px] min-w-[38px] rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)]"
              />

              <LanguageSelectorPill onOpenModal={() => setLangModalOpen(true)} />
            </div>
          </header>

          {/* Page Content */}
          <main className="relative z-10 flex-1 overflow-y-auto overflow-x-clip min-w-0 surface-enter">{children}</main>
        </div>

        {/* Regional Language & Typography Modal */}
        <LanguageSelectorModal
          isOpen={langModalOpen}
          onClose={() => setLangModalOpen(false)}
        />
      </div>
    </ActivePropertyProvider>
  );
}
