"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { ActivePropertyProvider } from "@/components/providers/ActivePropertyProvider";
import { AgriTechLogo } from "@/components/brand/AgriTechLogo";
import { CropDoctorModal } from "@/components/ai/CropDoctorModal";
import { VoiceCompanionDrawer } from "@/components/ai/VoiceCompanionDrawer";
import { OnlineStatusBanner } from "@/components/pwa/OnlineStatusBanner";
import { PWAInstallButton } from "@/components/pwa/PWAInstallButton";
import { Button } from "@/components/ui/Button";
import { FieldShaderBackdrop } from "@/components/ui/FieldShaderBackdrop";
import { toast } from "@/components/ui/Toaster";
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
  LogOut,
  LogIn,
  FolderOpen,
  FileJson,
  FileSpreadsheet,
  Plus,
  Search,
  Store,
  Newspaper,
  Landmark,
  Camera,
  Mic,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { LanguageSelectorPill } from "@/components/LanguageSelectorPill";
import { LanguageSelectorModal } from "@/components/LanguageSelectorModal";
import { getActiveProperty, useFarmStore } from "@/lib/property-store";
import { isOfflineToken } from "@/lib/auth";
import {
  buildFarmReportPayload,
  buildFieldDataCsv,
  triggerTextDownload,
} from "@/lib/export-files";

const PRIMARY_NAV = [
  { href: "/dashboard",       enLabel: "Field Hub",           key: "nav.fieldHub",        icon: LayoutDashboard },
  { href: "/properties",      enLabel: "My Farms",            key: "nav.myFarms",         icon: MapPin },
  { href: "/sensors",         enLabel: "Sensors & Soil",      key: "nav.sensorsSoil",     icon: Activity },
  { href: "/climate",         enLabel: "Climate & Advisory",  key: "nav.climateAdvisory", icon: CloudSun },
  { href: "/recommendations", enLabel: "Crop Planner",        key: "nav.recommendations", icon: Sprout },
  { href: "/irrigation",      enLabel: "Irrigation & Valves", key: "nav.irrigation",      icon: Droplets },
  { href: "/mandi",           enLabel: "Mandi & MSP",         key: "nav.mandi",           icon: Store },
  { href: "/updates",         enLabel: "State Updates",       key: "nav.updates",         icon: Newspaper },
  { href: "/schemes",         enLabel: "Govt Schemes",        key: "nav.schemes",         icon: Landmark },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [langModalOpen, setLangModalOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [farmMenuOpen, setFarmMenuOpen] = useState(false);
  const [cropDoctorOpen, setCropDoctorOpen] = useState(false);
  const [voiceDrawerOpen, setVoiceDrawerOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const setActiveProperty = useFarmStore((s) => s.setActiveProperty);
  const sensorsByFarm = useFarmStore((s) => s.sensorsByFarm);
  const schedulesByFarm = useFarmStore((s) => s.schedulesByFarm);
  const valvesByFarm = useFarmStore((s) => s.valvesByFarm);
  const syncOutbox = useFarmStore((s) => s.syncOutbox);
  const syncPropertiesFromBackend = useFarmStore((s) => s.syncPropertiesFromBackend);

  const activeFarm = getActiveProperty({ properties, activePropertyId });

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push("/login");
  };

  const handleExportJson = () => {
    const snapshot = buildFarmReportPayload({
      activeFarm,
      properties,
      sensorsByFarm,
      schedulesByFarm,
      valvesByFarm,
    });
    triggerTextDownload(
      "agritech-farm-report.json",
      JSON.stringify(snapshot, null, 2),
      "application/json"
    );
    toast("Downloaded agritech-farm-report.json", "success");
  };

  const handleExportCsv = () => {
    const snapshot = buildFarmReportPayload({
      activeFarm,
      properties,
      sensorsByFarm,
      schedulesByFarm,
      valvesByFarm,
    });
    triggerTextDownload(
      "agritech-field-data.csv",
      buildFieldDataCsv(snapshot),
      "text/csv;charset=utf-8"
    );
    toast("Downloaded agritech-field-data.csv", "success");
  };

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

  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteQuery("");
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setFarmMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    const onOpenCropDoctor = () => {
      setActionSheetOpen(false);
      setVoiceDrawerOpen(false);
      setCropDoctorOpen(true);
    };
    const onOpenVoiceCompanion = () => {
      setActionSheetOpen(false);
      setCropDoctorOpen(false);
      setVoiceDrawerOpen(true);
    };
    window.addEventListener("agritech:open-crop-doctor", onOpenCropDoctor);
    window.addEventListener("agritech:open-voice-companion", onOpenVoiceCompanion);
    return () => {
      window.removeEventListener("agritech:open-crop-doctor", onOpenCropDoctor);
      window.removeEventListener("agritech:open-voice-companion", onOpenVoiceCompanion);
    };
  }, []);

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
            "fixed inset-y-0 left-0 z-40 w-64 flex flex-col border-r shrink-0 transition-transform duration-200 [transition-timing-function:var(--ease-drawer)]",
            "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
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

          {/* AI Field Tools */}
          <div
            className="px-3 py-2 border-t space-y-1.5"
            style={{ borderColor: "var(--border-default)" }}
          >
            <Button
              label={t("doctor.title", "Crop Photo Doctor")}
              variant="secondary"
              size="sm"
              fullWidth
              data-testid="sidebar-crop-doctor-button"
              icon={<Camera className="w-4 h-4" aria-hidden="true" />}
              onClick={() => {
                setOpen(false);
                setCropDoctorOpen(true);
              }}
            />
            <Button
              label={t("voice.title", "Kisan Voice Companion")}
              variant="outline"
              size="sm"
              fullWidth
              data-testid="sidebar-voice-companion-button"
              icon={<Mic className="w-4 h-4" aria-hidden="true" />}
              onClick={() => {
                setOpen(false);
                setVoiceDrawerOpen(true);
              }}
            />
          </div>

          {/* Footer: Account, Settings & Direct Log out */}
          <div className="px-3 py-3 border-t space-y-2" style={{ borderColor: "var(--border-default)" }}>
            {user && (
              <div
                className="px-3 py-2 rounded-xl border text-xs"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                }}
              >
                <p className="font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {user.name || "Operator"}
                </p>
                <p className="font-mono text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                  Role: {user.role}
                </p>
              </div>
            )}

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

            {isAuthenticated ? (
              <Button
                label="Log out"
                variant="outline"
                size="sm"
                fullWidth
                data-testid="sidebar-logout-button"
                icon={<LogOut className="w-4 h-4" aria-hidden="true" />}
                onClick={handleLogout}
              />
            ) : (
              <Button
                href="/login"
                label="Log in"
                variant="primary"
                size="sm"
                fullWidth
                data-testid="sidebar-login-button"
                icon={<LogIn className="w-4 h-4" aria-hidden="true" />}
              />
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="relative flex-1 flex flex-col min-w-0">
          <FieldShaderBackdrop
            className="absolute inset-x-0 top-14 h-56 [mask-image:linear-gradient(to_bottom,black_20%,transparent_100%)]"
            intensity="subtle"
          />
          {/* Sticky Global Context Top Bar: Files, Actions & Auth always near screen */}
          <header
            data-testid="app-sticky-header"
            className="sticky top-0 z-30 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-6 py-1.5 sm:py-2.5 border-b sm:flex-wrap backdrop-blur-md no-print"
            style={{
              background: "color-mix(in srgb, var(--bg-surface) 92%, transparent)",
              borderColor: "var(--border-default)",
            }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <div className="lg:hidden">
                <IconButton
                  label="Open menu"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(true)}
                  icon={<Menu className="w-5 h-5" />}
                  className="min-w-[38px] min-h-[38px]"
                />
              </div>

              <Link
                href="/properties"
                className="hidden sm:inline-flex text-xs font-medium min-h-[38px] px-3 py-1.5 rounded-full border items-center gap-1.5 transition-colors hover:bg-[var(--accent-wash)]"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
                <span className="truncate">
                  {properties.length > 0
                    ? `Farms (${properties.length})`
                    : "Farms"}
                </span>
              </Link>

              {properties.length > 0 && (
                <div className="relative hidden sm:block" data-testid="farm-switcher-menu">
                  <Button
                    label="Switch Farm"
                    variant="secondary"
                    size="sm"
                    icon={<Sprout className="w-3.5 h-3.5" aria-hidden="true" />}
                    aria-expanded={farmMenuOpen}
                    aria-haspopup="menu"
                    onClick={() => setFarmMenuOpen((v) => !v)}
                  />
                  {farmMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setFarmMenuOpen(false)}
                      />
                      <div
                        role="menu"
                        aria-label="Switch Farm"
                        className="absolute left-0 mt-2 w-60 rounded-2xl border p-1.5 z-40 shadow-lg space-y-1"
                        style={{
                          background: "var(--bg-surface)",
                          borderColor: "var(--border-default)",
                        }}
                      >
                        <div
                          className="px-2.5 py-1 type-eyebrow"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          Switch Farm
                        </div>
                        {properties.map((farm) => {
                          const isCurrent = farm.id === activeFarm?.id;
                          return (
                            <button
                              key={farm.id}
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setActiveProperty(farm.id);
                                setFarmMenuOpen(false);
                                toast(`Switched to ${farm.name}`, "success");
                              }}
                              className={cn(
                                "w-full min-h-[40px] px-2.5 py-1.5 rounded-xl text-left text-xs flex items-center justify-between gap-2 transition-colors hover:bg-[var(--accent-wash)]",
                                isCurrent && "bg-[var(--accent-wash)] font-semibold"
                              )}
                              style={{ color: "var(--text-primary)" }}
                            >
                              <span className="truncate">{farm.name}</span>
                              <span
                                className="font-mono text-[11px] shrink-0"
                                style={{ color: "var(--text-secondary)" }}
                              >
                                {isCurrent ? "Current" : `${farm.areaHa.toFixed(1)} ha`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="hidden sm:inline-flex">
                <Button
                  href="/properties/new"
                  label="Add Farm"
                  variant="secondary"
                  size="sm"
                  icon={<Plus className="w-3.5 h-3.5" aria-hidden="true" />}
                />
              </div>

              <div data-testid="files-actions-menu">
                <DropdownMenu
                  button={{
                    label: "Files",
                    variant: "secondary",
                    size: "sm",
                    icon: <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />,
                  }}
                  presentation="adaptive"
                  placement="below"
                  alignment="start"
                  menuWidth={260}
                  items={[
                    {
                      type: "section",
                      title: "Download Farm Files",
                      items: [
                        {
                          id: "export-json",
                          label: "Export Farm Report (.json)",
                          description: "Selected farm, sensors & schedules",
                          icon: <FileJson className="w-4 h-4" />,
                          onClick: handleExportJson,
                        },
                        {
                          id: "export-csv",
                          label: "Export Field Data (.csv)",
                          description: "Spreadsheet of plots & valves",
                          icon: <FileSpreadsheet className="w-4 h-4" />,
                          onClick: handleExportCsv,
                        },
                      ],
                    },
                    { type: "divider" },
                    {
                      type: "section",
                      title: "Shortcuts",
                      items: [
                        {
                          id: "new-farm",
                          label: "Register New Farm",
                          href: "/properties/new",
                          icon: <Plus className="w-4 h-4" />,
                        },
                        {
                          id: "profile-prefs",
                          label: "Profile & Preferences",
                          href: "/profile",
                          icon: <User className="w-4 h-4" />,
                        },
                      ],
                    },
                  ]}
                />
              </div>
            </div>

            {/* Right Context Controls: Sync Status + PWA + Theme + Language + Always-Visible Auth */}
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 sm:flex-wrap">
              <Link
                href="/profile"
                className="hidden md:inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1 rounded-full text-[11px] font-medium border"
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

              <div className="hidden sm:inline-flex empty:hidden">
                <PWAInstallButton />
              </div>

              <Button
                label="Jump"
                variant="ghost"
                size="sm"
                data-testid="quick-jump-button"
                tooltip="Quick Jump (Ctrl+K)"
                icon={<Search className="w-3.5 h-3.5" aria-hidden="true" />}
                onClick={() => {
                  setPaletteQuery("");
                  setPaletteOpen(true);
                }}
                className="hidden md:inline-flex"
              />

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
                className="min-h-[36px] min-w-[36px] sm:min-h-[38px] sm:min-w-[38px] rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)]"
              />

              <LanguageSelectorPill
                onOpenModal={() => setLangModalOpen(true)}
                className="px-2.5 sm:px-3.5"
              />

              <div className="hidden sm:inline-flex">
                {isAuthenticated ? (
                  <Button
                    label="Log out"
                    variant="outline"
                    size="sm"
                    data-testid="topbar-logout-button"
                    icon={<LogOut className="w-3.5 h-3.5" aria-hidden="true" />}
                    onClick={handleLogout}
                  />
                ) : (
                  <Button
                    href="/login"
                    label="Log in"
                    variant="primary"
                    size="sm"
                    data-testid="topbar-login-button"
                    icon={<LogIn className="w-3.5 h-3.5" aria-hidden="true" />}
                  />
                )}
              </div>

              <div className="sm:hidden">
                {isAuthenticated ? (
                  <IconButton
                    data-testid="mobile-logout-button"
                    label="Log out"
                    tooltip="Log out"
                    variant="secondary"
                    size="sm"
                    onClick={handleLogout}
                    icon={<LogOut className="w-4 h-4 text-[var(--status-critical)]" aria-hidden="true" />}
                    className="min-h-[36px] min-w-[36px] rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)]"
                  />
                ) : (
                  <Link
                    href="/login"
                    data-testid="mobile-login-button"
                    aria-label="Log in"
                    className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--accent)] text-[var(--on-accent)]"
                  >
                    <LogIn className="w-4 h-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="relative flex-1 overflow-y-auto overflow-x-clip min-w-0 pb-20 lg:pb-0 surface-enter">
            <div className="px-3 sm:px-6 pt-3 empty:hidden no-print">
              <OnlineStatusBanner />
            </div>
            {children}
          </main>

          {/* Mobile 5-Tab Thumb Bar */}
          <nav
            aria-label="Mobile navigation"
            data-testid="mobile-thumb-bar"
            className="lg:hidden sticky bottom-0 z-30 grid grid-cols-5 gap-0.5 border-t px-1.5 py-1 backdrop-blur-md no-print"
            style={{
              background: "color-mix(in srgb, var(--bg-surface) 95%, transparent)",
              borderColor: "var(--border-default)",
            }}
          >
            <Link
              href="/dashboard"
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] rounded-xl text-[11px] font-medium px-1 transition-colors",
                pathname === "/dashboard"
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <LayoutDashboard className="w-4 h-4 mb-0.5 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{t("nav.today", "Today")}</span>
            </Link>
            <Link
              href="/mandi"
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] rounded-xl text-[11px] font-medium px-1 transition-colors",
                pathname.startsWith("/mandi")
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Store className="w-4 h-4 mb-0.5 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{t("nav.mandiShort", "Mandi")}</span>
            </Link>
            <Link
              href="/updates"
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] rounded-xl text-[11px] font-medium px-1 transition-colors",
                pathname.startsWith("/updates")
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Newspaper className="w-4 h-4 mb-0.5 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{t("nav.updatesShort", "Updates")}</span>
            </Link>
            <Link
              href="/schemes"
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] rounded-xl text-[11px] font-medium px-1 transition-colors",
                pathname.startsWith("/schemes")
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              )}
            >
              <Landmark className="w-4 h-4 mb-0.5 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{t("nav.schemesShort", "Schemes")}</span>
            </Link>
            <button
              type="button"
              data-testid="mobile-camera-voice-tab"
              onClick={() => setActionSheetOpen(true)}
              className={cn(
                "flex flex-col items-center justify-center min-h-[44px] rounded-xl text-[11px] font-medium px-1 transition-colors",
                cropDoctorOpen || voiceDrawerOpen || actionSheetOpen
                  ? "bg-[var(--accent-wash)] text-[var(--accent)]"
                  : "text-[var(--text-primary)]"
              )}
            >
              <Camera className="w-4 h-4 mb-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
              <span className="truncate max-w-full">{t("nav.cameraVoice", "Scan/Voice")}</span>
            </button>
          </nav>
        </div>

        {/* Regional Language & Typography Modal */}
        <LanguageSelectorModal
          isOpen={langModalOpen}
          onClose={() => setLangModalOpen(false)}
        />

        {/* Global Quick-Jump & Command Dialog (Ctrl+K) */}
        {paletteOpen && (
          <Dialog
            isOpen={paletteOpen}
            onOpenChange={setPaletteOpen}
            width={480}
            purpose="info"
          >
            <DialogHeader
              title="Quick Jump"
              subtitle="Search pages, switch farms, export files, or sign out (Ctrl+K)"
              onOpenChange={setPaletteOpen}
            />
          <div className="space-y-3 pt-2">
            <div className="relative">
              <Search
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                aria-hidden="true"
              />
              <input
                type="search"
                data-autofocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Type a page, farm name, or action…"
                aria-label="Search pages, farms, and actions"
                className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm rounded-xl border outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                  color: "var(--text-primary)",
                }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1">
              {(() => {
                const q = paletteQuery.trim().toLowerCase();
                const entries: Array<{
                  id: string;
                  label: string;
                  hint: string;
                  run: () => void;
                }> = [
                  ...PRIMARY_NAV.map((nav) => ({
                    id: `nav-${nav.href}`,
                    label: t(nav.key, nav.enLabel),
                    hint: "Page",
                    run: () => {
                      setPaletteOpen(false);
                      router.push(nav.href);
                    },
                  })),
                  {
                    id: "nav-new-farm",
                    label: "Register a Farm",
                    hint: "Wizard",
                    run: () => {
                      setPaletteOpen(false);
                      router.push("/properties/new");
                    },
                  },
                  {
                    id: "nav-profile",
                    label: "Profile & Preferences",
                    hint: "Page",
                    run: () => {
                      setPaletteOpen(false);
                      router.push("/profile");
                    },
                  },
                  {
                    id: "act-crop-doctor",
                    label: t("doctor.title", "Crop Photo Doctor"),
                    hint: "AI Scan",
                    run: () => {
                      setPaletteOpen(false);
                      setCropDoctorOpen(true);
                    },
                  },
                  {
                    id: "act-voice-companion",
                    label: t("voice.title", "Kisan Voice Companion"),
                    hint: "Voice",
                    run: () => {
                      setPaletteOpen(false);
                      setVoiceDrawerOpen(true);
                    },
                  },
                  ...properties.map((farm) => ({
                    id: `farm-${farm.id}`,
                    label: `Switch farm: ${farm.name}`,
                    hint: `${farm.areaHa.toFixed(1)} ha`,
                    run: () => {
                      setActiveProperty(farm.id);
                      toast(`Switched to ${farm.name}`, "success");
                      setPaletteOpen(false);
                    },
                  })),
                  {
                    id: "act-export-json",
                    label: "Export Farm Report (.json)",
                    hint: "File",
                    run: () => {
                      handleExportJson();
                      setPaletteOpen(false);
                    },
                  },
                  {
                    id: "act-export-csv",
                    label: "Export Field Data (.csv)",
                    hint: "File",
                    run: () => {
                      handleExportCsv();
                      setPaletteOpen(false);
                    },
                  },
                  {
                    id: "act-theme",
                    label:
                      theme === "dark"
                        ? "Switch to Daylight mode"
                        : "Switch to Night Field mode",
                    hint: "Theme",
                    run: () => {
                      toggleTheme();
                      setPaletteOpen(false);
                    },
                  },
                  ...(isAuthenticated
                    ? [
                        {
                          id: "act-logout",
                          label: "Log out",
                          hint: "Session",
                          run: () => {
                            setPaletteOpen(false);
                            handleLogout();
                          },
                        },
                      ]
                    : []),
                ];

                const filtered = q
                  ? entries.filter(
                      (item) =>
                        item.label.toLowerCase().includes(q) ||
                        item.hint.toLowerCase().includes(q)
                    )
                  : entries;

                if (filtered.length === 0) {
                  return (
                    <p
                      className="text-xs py-6 text-center"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      No matching pages, farms, or actions.
                    </p>
                  );
                }

                return filtered.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.run}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-left text-sm flex items-center justify-between gap-2 transition-colors hover:bg-[var(--accent-wash)]"
                    style={{ color: "var(--text-primary)" }}
                  >
                    <span className="truncate font-medium">{item.label}</span>
                    <span
                      className="text-[11px] font-mono shrink-0 px-2 py-0.5 rounded-full border"
                      style={{
                        background: "var(--bg-raised)",
                        borderColor: "var(--border-default)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {item.hint}
                    </span>
                  </button>
                ));
              })()}
            </div>
          </div>
          </Dialog>
        )}

        {/* Mobile Camera & Voice Action Chooser */}
        <BottomSheet
          isOpen={actionSheetOpen}
          onOpenChange={setActionSheetOpen}
          label={t("nav.cameraVoice", "Crop Doctor & Voice Companion")}
        >
          <div className="space-y-3 pb-2">
            <Button
              label={t("doctor.title", "Crop Photo Doctor")}
              variant="primary"
              size="lg"
              fullWidth
              icon={<Camera className="w-5 h-5" aria-hidden="true" />}
              onClick={() => {
                setActionSheetOpen(false);
                setCropDoctorOpen(true);
              }}
            />
            <Button
              label={t("voice.title", "Kisan Voice Companion")}
              variant="secondary"
              size="lg"
              fullWidth
              icon={<Mic className="w-5 h-5" aria-hidden="true" />}
              onClick={() => {
                setActionSheetOpen(false);
                setVoiceDrawerOpen(true);
              }}
            />
          </div>
        </BottomSheet>

        {/* Global Crop Photo Doctor & Voice Companion Modals */}
        <CropDoctorModal
          open={cropDoctorOpen}
          onClose={() => setCropDoctorOpen(false)}
          defaultCropName={activeFarm?.selectedCropId}
          propertyId={activeFarm?.id}
        />
        <VoiceCompanionDrawer
          open={voiceDrawerOpen}
          onClose={() => setVoiceDrawerOpen(false)}
          onOpenCropDoctor={() => {
            setVoiceDrawerOpen(false);
            setCropDoctorOpen(true);
          }}
        />
      </div>
    </ActivePropertyProvider>
  );
}
