"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Check,
  CloudSun,
  Droplets,
  Menu,
  Moon,
  Sprout,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { Banner } from "@astryxdesign/core/Banner";
import { IconButton } from "@astryxdesign/core/IconButton";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import { MEDIA_MANIFEST } from "@/lib/media-manifest";
import { AgriTechLogo } from "@/components/brand/AgriTechLogo";
import { LiquidMetalLogo } from "@/components/brand/LiquidMetalLogo";
import { BrowserShowcaseFrame } from "@/components/landing/BrowserShowcaseFrame";
import { LandingScrollStory } from "@/components/landing/LandingScrollStory";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { Button } from "@/components/ui/Button";

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: "Root-Zone Soil Precision",
    copy: "Continuous dielectric moisture and soil temperature monitoring across 15, 30, and 60 cm depths before crops wilt.",
  },
  {
    icon: Droplets,
    title: "FAO-56 Irrigation Savings",
    copy: "Rain-hold safety locks and crop-stage water budgets deliver the exact litres required without over-watering.",
  },
  {
    icon: Sprout,
    title: "Crop Planner & Spray Safety",
    copy: "Score Kharif, Rabi, and Zaid crop choices by local heat, humidity, soil pH, and calm foliar spraying windows.",
  },
  {
    icon: CloudSun,
    title: "11 Indic Locales & Offline",
    copy: "FieldShield offline queuing and native Indic script briefings keep farm organizers and crews synced without signal.",
  },
];

const OPERATIONS_STEPS = [
  {
    num: "01",
    copy: "Sign in in seconds with Google or email and manage multiple family or cooperative farm plots from one hub.",
  },
  {
    num: "02",
    copy: "Pair root-zone soil probes or rely on live 14-day local weather forecasts whenever field hardware is offline.",
  },
  {
    num: "03",
    copy: "Compare seasonal crop recommendations, foliar spraying windows, and pest watchlists for every block.",
  },
  {
    num: "04",
    copy: "Automate drip irrigation schedules and share daily WhatsApp/SMS shift instructions in 11 Indian languages.",
  },
];

const COMPARISON_COLUMNS = [
  {
    name: "AgriTech",
    highlighted: true,
    items: [
      { ok: true, label: "One-tap Google Sign-In & Farm Sync" },
      { ok: true, label: "Multi-plot cooperative & farmer hub" },
      { ok: true, label: "Automated Soil -> Climate -> Drip loop" },
      { ok: true, label: "15 / 30 / 60 cm root-zone telemetry" },
      { ok: true, label: "11 Indic script field briefings" },
      { ok: true, label: "Offline FieldShield sync outbox" },
    ],
  },
  {
    name: "Fixed Valve Timers",
    highlighted: false,
    items: [
      { ok: false, label: "No rain-hold or moisture cutoff" },
      { ok: false, label: "No multi-farm organizer overview" },
      { ok: true, label: "Fixed timer irrigation cycles" },
      { ok: false, label: "No Kharif/Rabi crop evaluation" },
      { ok: false, label: "English-only device controls" },
      { ok: false, label: "No local crew shift logs" },
    ],
  },
  {
    name: "Manual Scouting",
    highlighted: false,
    items: [
      { ok: false, label: "Scattered paper notes per plot" },
      { ok: false, label: "Disconnected field spreadsheets" },
      { ok: false, label: "Delayed visual stress detection" },
      { ok: false, label: "No automated drip actuation" },
      { ok: true, label: "Verbal field handoffs only" },
      { ok: false, label: "Zero moisture & weather history" },
    ],
  },
];

const STACK_MARKS = [
  "Google Sign-In",
  "Soil Probes",
  "ECMWF Weather",
  "Crop Planner",
  "Drip Control",
  "11 Languages",
];

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated, googleError, clearGoogleError } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const heroMedia = MEDIA_MANIFEST["hero-field"];
  const aerialMedia = MEDIA_MANIFEST["aerial-farm"];
  const soilMedia = MEDIA_MANIFEST["soil-sensing"];
  const canopyMedia = MEDIA_MANIFEST["crop-canopy"];

  const primaryHref = isHydrated && isAuthenticated ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Clean Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-[var(--border-default)]/80 bg-[var(--bg-base)]/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="shrink-0">
            <AgriTechLogo size="md" subtitle="" />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-8 text-[14px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]"
          >
            <a href="#how-to" className="hover:text-[var(--accent)] transition-colors">
              Workflow
            </a>
            <a href="#benefits" className="hover:text-[var(--accent)] transition-colors">
              Benefits
            </a>
            <a href="#architecture" className="hover:text-[var(--accent)] transition-colors">
              Operations
            </a>
            <a href="#specifications" className="hover:text-[var(--accent)] transition-colors">
              Compare
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
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

            <div className="hidden sm:block">
              <Button
                label={isHydrated && isAuthenticated ? "Open Field Hub" : "Launch Hub"}
                variant="primary"
                size="md"
                onClick={() => router.push(primaryHref)}
                endContent={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </div>

            <div className="md:hidden">
              <IconButton
                onClick={() => setMobileMenuOpen((v) => !v)}
                label={mobileMenuOpen ? "Close menu" : "Open menu"}
                variant="secondary"
                size="md"
                icon={mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                className="min-h-[44px] min-w-[44px] rounded-full border border-[var(--border-default)] bg-[var(--bg-surface)]"
              />
            </div>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm font-semibold">
              <a href="#how-to" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Workflow
              </a>
              <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Benefits
              </a>
              <a href="#architecture" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Operations
              </a>
              <a href="#specifications" onClick={() => setMobileMenuOpen(false)} className="py-1.5">
                Compare
              </a>
              <Button
                href={primaryHref}
                label={isHydrated && isAuthenticated ? "Open Field Hub" : "Launch Hub"}
                variant="primary"
                fullWidth
                onClick={() => setMobileMenuOpen(false)}
                endContent={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
        {/* Hero Section */}
        <section className="pt-12 sm:pt-16 pb-10 text-center">
          <h1 className="mx-auto max-w-4xl font-serif-display text-5xl sm:text-7xl lg:text-[92px] leading-[0.98] tracking-[-0.035em] text-[var(--text-primary)]">
            Sense everything.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm sm:text-base text-[var(--text-secondary)]">
            Daily soil moisture, 14-day rainfall outlook, crop advisory, and smart valve scheduling built for farmers and field organizers.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {(!isHydrated || !isAuthenticated) && (
              <GoogleSignInButton redirectPath="/" preferred />
            )}
            <Button
              href={primaryHref}
              label={
                isHydrated && isAuthenticated ? "Enter Field Hub" : "Sign in to Field Hub"
              }
              variant="primary"
              size="lg"
              endContent={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            />
            <Button
              href="/signup"
              label="Enroll Farm Parcel"
              variant="secondary"
              size="lg"
            />
          </div>

          {googleError && (
            <div className="mx-auto mt-4 max-w-md text-left">
              <Banner
                status="error"
                role="alert"
                title={googleError}
                isDismissable
                onDismiss={clearGoogleError}
              />
            </div>
          )}

          <div className="mt-8 sm:mt-10">
            <BrowserShowcaseFrame url="agritech.field/hub/odisha-basin-01">
              <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full overflow-hidden">
                <Image
                  src={heroMedia.src}
                  alt={heroMedia.alt}
                  fill
                  sizes="(min-width: 1024px) 920px, 95vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/38 via-black/10 to-black/50" />

                {/* Clean Floating HUD Readout */}
                <div className="absolute inset-x-4 top-4 sm:inset-x-6 sm:top-6 flex items-start justify-between gap-4 text-left text-white">
                  <div className="flex items-center gap-3">
                    <LiquidMetalLogo size={44} className="shrink-0" />
                    <div>
                      <div className="flex items-baseline gap-2.5">
                        <span className="font-serif-display text-3xl sm:text-5xl leading-none">
                          78%
                        </span>
                        <span className="text-xs sm:text-sm font-medium text-white/90">
                          Root-Zone Moisture Optimal
                        </span>
                      </div>
                      <p className="mt-1 hidden sm:block font-mono text-[11px] text-white/80">
                        Soil Probes &rarr; Weather Forecast &rarr; Scheduled Morning Drip
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/35 px-3 py-1.5 font-mono text-[11px] text-white backdrop-blur-md">
                    <Droplets className="h-3.5 w-3.5 text-[#DFECC6]" aria-hidden="true" />
                    <span>All Regions (4 Zones)</span>
                  </div>
                </div>
              </div>
            </BrowserShowcaseFrame>
          </div>
        </section>

        {/* Field Stack Strip */}
        <section
          aria-label="Field operations capabilities"
          className="border-b border-[var(--border-default)] py-10"
        >
          <p className="font-sans text-xs text-[var(--text-secondary)]">Built for daily farm operations:</p>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {STACK_MARKS.map((name) => (
              <div
                key={name}
                className="flex items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)]/60 px-4 py-3 font-mono text-xs font-medium tracking-tight text-[var(--text-secondary)]"
              >
                {name}
              </div>
            ))}
          </div>
        </section>

        {/* Chronological Step 1 on Page: Map Your Harvest 3-Step Workflow */}
        <LandingScrollStory />

        {/* Benefits Section */}
        <section id="benefits" className="border-t border-[var(--border-default)] py-16 sm:py-24">
          <div className="max-w-2xl">
            <p className="font-mono text-xs text-[var(--text-secondary)]">Benefits</p>
            <h2 className="mt-4 font-serif-display text-4xl sm:text-5xl lg:text-[56px] leading-[1.05] text-[var(--text-primary)]">
              We&apos;ve cracked the soil.
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
              AgriTech delivers real-time soil telemetry, seasonal crop planning, and automated drip irrigation designed for working farms.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="border-t border-[var(--border-default)] pt-6"
              >
                <Icon className="h-5 w-5 text-[var(--text-primary)]" aria-hidden="true" />
                <h3 className="mt-4 font-serif-display text-xl text-[var(--text-primary)]">
                  {title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-secondary)]">
                  {copy}
                </p>
              </div>
            ))}
          </div>

          <div className="photo-frame relative mt-14 aspect-[16/9] w-full">
            <Image
              src={aerialMedia.src}
              alt={aerialMedia.alt}
              fill
              sizes="(min-width: 1200px) 1200px, 100vw"
              className="object-cover photo-duotone"
            />
          </div>
        </section>

        {/* See the Big Picture Split Section */}
        <section
          id="architecture"
          className="grid grid-cols-1 items-center gap-12 border-t border-[var(--border-default)] py-16 sm:py-24 lg:grid-cols-12"
        >
          <div className="lg:col-span-6">
            <h2 className="font-serif-display text-4xl sm:text-5xl leading-[1.06] text-[var(--text-primary)]">
              See the Big Picture
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">
              AgriTech turns daily sensor readings and weather shifts into clear field instructions every operator can follow.
            </p>

            <div className="mt-8 divide-y divide-[var(--border-default)] border-y border-[var(--border-default)]">
              {OPERATIONS_STEPS.map((item) => (
                <div key={item.num} className="flex items-start gap-5 py-4">
                  <span className="font-mono text-xs font-medium text-[var(--text-secondary)] pt-0.5 tabular-nums">
                    {item.num}
                  </span>
                  <p className="text-sm leading-relaxed text-[var(--text-primary)]">
                    {item.copy}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Button
                href="/login"
                label="Discover More"
                variant="secondary"
                endContent={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-[28px] bg-[var(--bg-bezel)] p-3 sm:p-4 border border-[var(--border-default)]">
              <div className="photo-frame relative aspect-[4/4] sm:aspect-[5/4] w-full rounded-[22px]">
                <Image
                  src={soilMedia.src}
                  alt={soilMedia.alt}
                  fill
                  sizes="(min-width: 1024px) 560px, 100vw"
                  className="object-cover photo-duotone"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Specifications Comparison Matrix */}
        <section
          id="specifications"
          className="border-t border-[var(--border-default)] py-16 sm:py-24"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs text-[var(--text-secondary)]">Comparison</p>
            <h2 className="mt-3 font-serif-display text-4xl sm:text-5xl text-[var(--text-primary)]">
              Why Choose AgriTech?
            </h2>
            <p className="mt-4 text-sm sm:text-base text-[var(--text-secondary)]">
              Built for cooperative organizers, progressive farmers, and reliable offline field execution.
            </p>
            <div className="mt-6 flex justify-center">
              <Button
                href="/dashboard"
                label="Explore Live Workspace"
                variant="secondary"
                endContent={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
              />
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {COMPARISON_COLUMNS.map((col) => (
              <div
                key={col.name}
                className={
                  col.highlighted
                    ? "rounded-[24px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-[0_12px_32px_-20px_rgba(72,92,17,0.18)]"
                    : "rounded-[24px] border border-[var(--border-default)] bg-[var(--bg-raised)]/40 p-6"
                }
              >
                <h3 className="pb-4 text-center font-sans text-lg font-semibold text-[var(--text-primary)] border-b border-[var(--border-default)]">
                  {col.name}
                </h3>
                <ul className="divide-y divide-[var(--border-default)]">
                  {col.items.map((item) => (
                    <li
                      key={item.label}
                      className="flex items-center gap-3 py-3.5 text-xs sm:text-[13px] text-[var(--text-primary)]"
                    >
                      {item.ok ? (
                        <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                      ) : (
                        <X className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
                      )}
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Editorial Testimonial Quote Split */}
        <section className="grid grid-cols-1 items-center gap-12 border-t border-[var(--border-default)] py-16 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="photo-frame relative aspect-[4/3] sm:aspect-square w-full">
              <Image
                src={canopyMedia.src}
                alt={canopyMedia.alt}
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover photo-duotone"
              />
            </div>
          </div>

          <div className="lg:col-span-6">
            <blockquote className="font-serif-display text-2xl sm:text-4xl leading-[1.22] text-[var(--text-primary)]">
              &ldquo;Moving to AgriTech transformed how our agronomists manage regional acreage. Root-zone visualizations are effortless to read, and automated valve triggers protect every Kharif and Rabi cycle.&rdquo;
            </blockquote>
            <div className="mt-8">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Ananya Deshmukh
              </p>
              <p className="font-mono text-xs text-[var(--text-secondary)]">
                Lead Agronomist, Coastal Delta Cooperative
              </p>
            </div>
          </div>
        </section>

        {/* Connect With Us CTA */}
        <section className="border-t border-[var(--border-default)] py-20 text-center">
          <h2 className="font-serif-display text-4xl sm:text-5xl text-[var(--text-primary)]">
            Connect with us
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm sm:text-base text-[var(--text-secondary)]">
            Open your Field Hub with Google or email to organize parcels, track soil moisture, and schedule irrigation across every block.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {(!isHydrated || !isAuthenticated) && (
              <GoogleSignInButton
                redirectPath="/"
                preferred
                testId="google-signin-button-cta"
              />
            )}
            <Button
              href={primaryHref}
              label={isHydrated && isAuthenticated ? "Open Field Hub" : "Launch Field Hub"}
              variant="primary"
              size="lg"
              endContent={<ArrowUpRight className="h-4 w-4" aria-hidden="true" />}
            />
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-[var(--border-default)] bg-[var(--bg-base)]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-5 py-10 sm:px-8">
          <div className="flex flex-wrap items-center gap-6 text-xs font-semibold text-[var(--text-primary)]">
            <a href="#how-to" className="hover:text-[var(--accent)]">
              Workflow
            </a>
            <a href="#benefits" className="hover:text-[var(--accent)]">
              Benefits
            </a>
            <a href="#specifications" className="hover:text-[var(--accent)]">
              Compare
            </a>
            <Link href="/login" className="hover:text-[var(--accent)]">
              Sign in
            </Link>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-4">
              <AgriTechLogo size="sm" subtitle="" />
              <span>&copy; AgriTech Sensing Solutions · 2026</span>
            </div>
            <span className="font-mono text-[11px]">
              All Rights Reserved · Zero-Human Botanical Imagery
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
