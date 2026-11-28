# AgriTech Frontend Masterpiece Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Next.js 16 AgriTech frontend into a Tactile Agrarian Atelier platform featuring 3D machined push buttons, Double-Bezel trays, a WebGL liquid-brass Furrow-Leaf logo, 4-tier curated backgrounds and audited farm photography, a best-in-class WCAG 2.2 AA split-screen `/login`, full rewiring of all 7 orphaned components across 8 operational routes, and a pressure-tested workspace frontend craft skill.

**Architecture:** Preserve Next.js `16.4.3` App Router, Tailwind CSS `v4`, Spring Boot API contracts (`frontend/src/lib/api.ts`), Open-Meteo engine (`frontend/src/lib/climate.ts`), and 10-script Indic i18n (`frontend/src/lib/i18n.tsx`) while elevating visuals through unified `:root`/`.dark` CSS custom properties, React 19-compatible `@paper-design/shaders-react` (`LiquidMetal` + `MeshGradient`), `motion/react` (`Silk` + `Spring` under `<MotionConfig reducedMotion="user">`), and `/` landing scroll choreography via `lenis` + `gsap`. Every existing orphaned widget (`FarmAerialSurvey`, `FarmerRecommendationCard`, `FarmMap`, `FarmGoogleMap`, `LanguageSelectorModal`, `LanguageSelectorPill`, `RootZoneSoilCard`) is refactored to semantic theme tokens and wired into its target operational route.

**Tech Stack:** Next.js 16.4.3 · React 19.3.0 · TypeScript 5 · Tailwind CSS v4 · Radix UI · `motion` (v12+) · `@paper-design/shaders-react` · `gsap` 3.13+ · `lenis` · Recharts 3.10 · Leaflet / `@vis.gl/react-google-maps` · Playwright 1.64

**Spec:** [2026-11-23-agritech-frontend-masterpiece-spec.md](file:///c:/Users/anjan/Downloads/SOA-Hackthon/docs/superpowers/specs/2026-11-23-agritech-frontend-masterpiece-spec.md)

## Global Constraints

- Active codebase is strictly `frontend/` (Next.js 16.4.3 + React 19.3.0); do not touch `frontend/frontend/` or modify Spring Boot backend routes/DTOs.
- All colors and font families originate inside `:root` and `.dark` in `frontend/src/app/globals.css`; zero raw hex colors past `:root`, and zero `"var(--token)18"` string concatenation (use `color-mix()`).
- Zero `"GCS Guard"` branding; product name is strictly `AgriTech`.
- Zero `transition: all`, zero `ease-in`, zero animating `width`/`height`/`top`/`left`, zero `scale(0)` entrances; wrap root in `<MotionConfig reducedMotion="user">`.
- Interactive hit targets minimum `44x44px` (`48px` mobile primary actions); visible `2px` `:focus-visible` outline with `2px+` offset; `overflow-x: clip` on `html`/`body`; `min-width: 0` on all grid/flex text & chart children.
- Auth forms must conform to WCAG 2.2 AA SC 3.3.8 (allow paste and password managers via `autocomplete`), tie inline errors with `aria-describedby`, show OWASP-neutral failure copy, and keep email/password/primary CTA visible above mobile keyboards.
- Status indicators always pair color + icon + explicit text word; zero emojis as UI/crop icons; charts sit exclusively on solid `--bg-surface` paper (minimum `12px` labels + accessible data-table toggle).
- Zero unverified external photo URLs; every `<img>` includes explicit dimensions/aspect-ratio, `decoding="async"`, `naturalWidth > 0`, and factual `alt` text.
- Strictly zero humans, people, faces, hands, or silhouettes in any selected, reused, or generated image; match the golden-hour cultivated-landscape, aerial farmland, and macro IoT hardware aesthetic of `hero-field.jpg`, `aerial-farm.jpg`, and `soil-sensing.jpg`; remove `smart-farming.jpg` / `smart-farming.png` and replace `FarmerRecommendationCard.tsx:108`.

## Review Focus

1. **Unlayered CSS Reset Overriding Tailwind v4 Utilities:** Unlayered `* { padding: 0; margin: 0; }` after `@import "tailwindcss";` neutralizes Tailwind spacing classes (`p-*`, `px-*`, `py-*`); pinned to Task 1 Playwright computed-padding test.
2. **WebGL Context Loss or `prefers-reduced-motion: reduce` on `/login` & `/`:** Failing WebGL context or reduced-motion must render a crisp static SVG `/logo-mark.svg` and static radial backdrop with zero runtime crash; pinned to Task 3 Playwright reduced-motion & WebGL-disabled test.
3. **Dark Mode Contrast Bleed Inside Rewired Components:** Legacy `#2A2919`, `#ECEAD0`, `bg-white`, and Recharts hex literals turn invisible or glaring in `.dark`; pinned to Task 7 & Task 9 & Task 11 dark-mode contrast/token assertions.
4. **Offline Spring Boot Gateway (`:8080` Unreachable) on Auth, Dashboard, Sensors & Irrigation:** Network failure must exit loading spinners, show actionable retry alerts, and preserve user-entered form data; pinned to Task 5, Task 7, and Task 10 mocked-offline Playwright tests.
5. **Narrow `320px–390px` Mobile Reflow & Telugu/Hindi (+35% Width) Text Expansion:** Long Indic strings or mobile keyboards must never clip buttons or trigger `scrollWidth > innerWidth`; pinned to Task 5, Task 6, and Task 11 multi-script mobile Playwright tests.

---

## File Structure

### Files to Create
- `frontend/public/images/crop-canopy.webp` — Project-matched golden-hour cultivated wheat canopy & terraced rows asset (`85mm f/2.8`, strictly zero humans, replaces `smart-farming.jpg`).
- `frontend/public/images/irrigation-drip.webp` — Project-matched golden-hour matte-black precision drip-irrigation lines & mineral loam asset (`35mm f/4`, strictly zero humans, used on `/signup` & `/irrigation`).
- `frontend/playwright.config.ts` — Multi-viewport Playwright configuration (`1280x800`, `390x844`, `320x640`).
- `frontend/e2e/helpers/auth-mock.ts` — Deterministic route-mock helpers for offline/online API testing.
- `frontend/src/lib/media-manifest.ts` — Typed asset registry (`MEDIA_MANIFEST`) with dimensions, focal points, provenance, and alt-text keys.
- `frontend/src/components/providers/ThemeProvider.tsx` — Persistent Light/Dark theme context toggling `document.documentElement.classList`.
- `frontend/src/components/providers/MotionProvider.tsx` — Root `<MotionConfig reducedMotion="user">` provider.
- `frontend/src/components/providers/ActivePropertyProvider.tsx` — Active farm coordinates/crop selector synced across Dashboard, Climate, Recommendations, and Sensors.
- `frontend/public/logo-mark.svg` — Transparent-background Furrow-Leaf-Node geometric emblem (`64x64` viewBox, 20% margin).
- `frontend/src/components/brand/AgriTechLogo.tsx` — Crisp vector mark with optional `motion-canvas` path-draw mount animation.
- `frontend/src/components/brand/LiquidMetalLogo.tsx` — Dynamic-imported `@paper-design/shaders-react` `<LiquidMetal>` crest with `IntersectionObserver` pause, reduced-motion guard, and SVG fallback.
- `frontend/src/components/ui/TactileButton.tsx` — Two-layer 3D hardware push button (`primary`, `secondary`, `ghost`, `brass`, `destructive`), Button-in-Button trailing socket, optional magnetic spring, all 6 UX states.
- `frontend/src/components/ui/HoldConfirmButton.tsx` — `clip-path` hold-to-confirm (`1.8s`) destructive button with accessible dialog fallback.
- `frontend/src/components/ui/BezelCard.tsx` — Double-Bezel tray (`outer` + concentric `inner` core) + Offset Slab wrapper (`AuthSlabFrame`).
- `frontend/src/components/ui/SlidingTabs.tsx` — Shared-layout `layoutId` pill tabs (`min-h-[44px]`).
- `frontend/src/components/auth/AuthSplitShell.tsx` — 55/45 split-screen `<main>` + `<aside>` Offset Slab shell with mobile keyboard protection.
- `frontend/src/components/auth/DemoAccountPicker.tsx` — Judge Demo quick-fill pills (`admin@agritech.io` / `farmer@agritech.io`) with `pop-in` feedback.
- `frontend/src/components/landing/BrowserShowcaseFrame.tsx` — `mockup-studio` realistic browser bezel previewing AgriTech operations.
- `frontend/src/components/landing/LandingScrollStory.tsx` — Scoped Lenis + GSAP `ScrollTrigger` / `SplitText` 3-stage showcase (for `/` only).
- `frontend/src/app/properties/page.tsx` — Registered farms inventory route (`3:2` illustrative cover, active farm selector).
- `frontend/src/components/sensors/AddSensorDialog.tsx` — Radix Dialog for `sensorApi.register` (wired to `/sensors`).
- `frontend/src/components/irrigation/CreateScheduleDialog.tsx` — Radix Dialog for irrigation scheduling + `motion-canvas` SVG pipe/valve flow diagram.
- `.agents/skills/agritech-frontend-craft/SKILL.md` — New workspace design-engineering craft skill authored via `/writing-skills` TDD cycle.

### Files to Modify
- `frontend/package.json` — Add `motion`, `gsap`, `lenis`, `@paper-design/shaders-react`.
- `frontend/src/app/globals.css` — Fix `@layer base` reset, add `--bg-bezel` & `--accent-brass` tokens, motion easing tokens, `.bg-archival-grain`, `.bg-topographic-field`, `.bg-oklch-wash`, `overflow-x: clip`.
- `frontend/src/app/layout.tsx` — Mount `ThemeProvider`, `MotionProvider`, `ActivePropertyProvider`.
- `frontend/src/components/ui/Button.tsx` & `frontend/src/components/ui/Form.tsx` — Upgrade to semantic tokens, `44px/48px` targets, `aria-describedby` wiring, and `TactileButton` compatibility.
- `frontend/src/app/page.tsx` — Upgrade from splash redirector to Editorial Landing Showcase (unauthenticated) / quick enter (authenticated).
- `frontend/src/app/login/page.tsx` & `frontend/src/app/signup/page.tsx` — Migrate into `AuthSplitShell` with full WCAG 2.2 AA auth states.
- `frontend/src/components/AppLayout.tsx` — Single accessible mobile drawer, `AgriTechLogo`, `LanguageSelectorPill` + `LanguageSelectorModal`, Theme toggle, Active Farm selector, `layoutId` rail, localized nav.
- `frontend/src/lib/i18n.tsx` — Add navigation, auth, and common UI translation keys across supported scripts.
- `frontend/src/app/dashboard/page.tsx` — Fix `ClimateStats` crash, wire `RootZoneSoilCard` + `FarmAerialSurvey`, Bento layout.
- `frontend/src/app/properties/new/page.tsx` — Rewire `FarmMap` into Step 1, `AnimatePresence` steps, replace raw emoji.
- `frontend/src/app/climate/page.tsx` — Rewire `FarmMap` & `RootZoneSoilCard`, upgrade Recharts to semantic CSS tokens + `>=12px` labels + accessible data-table toggle.
- `frontend/src/app/recommendations/page.tsx` — Add human-free `crop-canopy.webp` strip, rewire `FarmerRecommendationCard`, replace `crop.emoji` with Lucide botanical icons.
- `frontend/src/app/sensors/page.tsx` — Fix `color-mix()` badges, wire `AddSensorDialog` & `HoldConfirmButton`, add `soil-sensing.jpg` hardware placement drawer.
- `frontend/src/app/irrigation/page.tsx` — Add `CreateScheduleDialog`, Demo vs Live notice, `irrigation-drip.webp` strip & SVG valve flow diagram.
- `frontend/src/app/profile/page.tsx` — Add typography specimen access, theme selector, reduced-motion preference, role capabilities matrix.
- `frontend/src/components/RootZoneSoilCard.tsx`, `FarmAerialSurvey.tsx`, `FarmerRecommendationCard.tsx`, `FarmMap.tsx`, `LanguageSelectorPill.tsx`, `LanguageSelectorModal.tsx` — Refactor raw light hex literals to semantic `:root`/`.dark` CSS custom properties, and replace `FarmerRecommendationCard.tsx:108` (`src="/images/smart-farming.jpg"`) with `MEDIA_MANIFEST["crop-canopy"].src`.

### Files to Remove (Unused Duplicate `.png` Assets & Deprecated Human Photo)
- `frontend/public/images/smart-farming.jpg`
- `frontend/public/images/hero-field.png`
- `frontend/public/images/aerial-farm.png`
- `frontend/public/images/smart-farming.png`
- `frontend/public/images/soil-sensing.png`

### Test Suites
- `frontend/e2e/foundation.spec.ts` (Tasks 1–4 verification)
- `frontend/e2e/auth-and-landing.spec.ts` (Task 5 verification)
- `frontend/e2e/workspace-flows.spec.ts` (Tasks 6–10 verification)
- `frontend/e2e/masterpiece.spec.ts` (Task 11 full matrix: 3 viewports × Light/Dark × 3 languages × a11y + LCP + zero console errors)

---

### Task 1: Repair P0 Compile/CSS Bugs, Install Motion/Shader Packages & Enforce Project-Style Zero-Humans Media Manifest

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/app/globals.css:136-140`
- Modify: `frontend/src/app/dashboard/page.tsx:93-102`
- Modify: `frontend/src/components/FarmerRecommendationCard.tsx:108`
- Create: `frontend/src/lib/media-manifest.ts`
- Create: `frontend/public/images/crop-canopy.webp`, `frontend/public/images/irrigation-drip.webp`
- Create: `frontend/playwright.config.ts`
- Remove: `frontend/public/images/smart-farming.jpg`, `frontend/public/images/hero-field.png`, `frontend/public/images/aerial-farm.png`, `frontend/public/images/smart-farming.png`, `frontend/public/images/soil-sensing.png`
- Test: `frontend/e2e/foundation.spec.ts`

**Interfaces:**
- Consumes: `ClimateStats` (`avgTempC`, `avgPrecipMm`, `et0Total`, `todayRainMm`) from `frontend/src/lib/climate.ts`.
- Produces: `MEDIA_MANIFEST: Record<MediaAssetId, MediaAssetSpec>` (`id`, `src`, `width`, `height`, `objectPosition`, `altKey`, `fallbackAlt`, `usage`, `illustrative`, `containsHumans: false`).

- [ ] **Step 1: Write failing Playwright + TypeScript foundation test**

Create `frontend/playwright.config.ts` and `frontend/e2e/foundation.spec.ts` asserting:
1. `dashboard/page.tsx` computes padding `>= 16px` on `.p-6` containers (verifying Tailwind v4 utility layer is not zeroed by unlayered `* { padding: 0; }`).
2. Zero `"GCS Guard"` text anywhere in DOM.
3. Duplicate `.png` files and `smart-farming.jpg` / `smart-farming.png` do NOT exist in `public/images/`, zero references to `smart-farming` remain in `frontend/src/`, and every `MEDIA_MANIFEST` entry has `containsHumans === false` and resolves with `200 OK`.

- [ ] **Step 2: Run tests and typecheck to verify failure**

Run: `npx tsc --noEmit --project frontend/tsconfig.json; npx playwright test e2e/foundation.spec.ts` (from `frontend/`)
Expected: FAIL on `dashboard/page.tsx:94,101` (`Property 'meanTemp' does not exist on type 'ClimateStats'`), computed `.p-6` padding equals `0px`, and `smart-farming.jpg` still exists & is referenced in `FarmerRecommendationCard.tsx:108`.

- [ ] **Step 3: Install approved free OSS packages, fix `ClimateStats` & `@layer base`, generate human-free images, build `media-manifest.ts`, remove `smart-farming.*` & duplicate `.png`s**

1. Install inside `frontend/`: `npm install motion gsap lenis @paper-design/shaders-react` (all MIT/Apache-2.0, React 19 compatible).
2. Wrap reset `* { box-sizing: border-box; margin: 0; padding: 0; }` in `frontend/src/app/globals.css` inside `@layer base { ... }`.
3. Update `frontend/src/app/dashboard/page.tsx:93-102` to read `stats.avgTempC` and `stats.et0Total` (fixing TypeScript error).
4. Generate `frontend/public/images/crop-canopy.webp` (`85mm f/2.8` golden-hour wheat stalks & terraced rows, zero people) and `frontend/public/images/irrigation-drip.webp` (`35mm f/4` golden-hour matte-black drip lines along young crop rows in dark mineral loam, zero people) via `image-generator` using `open-higgsfield-ai` Cinema Studio optics matching `hero-field.jpg` / `aerial-farm.jpg` / `soil-sensing.jpg`. Visually inspect both generated images with `read_file` to verify zero humans before proceeding.
5. Export `MEDIA_MANIFEST` from `frontend/src/lib/media-manifest.ts` referencing strictly human-free assets (`hero-field.jpg`, `aerial-farm.jpg`, `soil-sensing.jpg`, `crop-canopy.webp`, `irrigation-drip.webp`, `/logo-mark.svg`) with `containsHumans: false` on every entry.
6. Update `frontend/src/components/FarmerRecommendationCard.tsx:108` from `src="/images/smart-farming.jpg"` to `src={MEDIA_MANIFEST["crop-canopy"].src}` (`alt={MEDIA_MANIFEST["crop-canopy"].fallbackAlt}`) and delete `frontend/public/images/smart-farming.jpg` plus all 4 `.png` duplicates (`hero-field.png`, `aerial-farm.png`, `smart-farming.png`, `soil-sensing.png`).

- [ ] **Step 4: Run typecheck and foundation test to verify pass**

Run: `npx tsc --noEmit --project frontend/tsconfig.json; npx playwright test e2e/foundation.spec.ts`
Expected: PASS (`0` TS errors, computed `.p-6` padding `24px`, `containsHumans === false`, `0` `smart-farming` matches, manifest checks green).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/app/globals.css frontend/src/app/dashboard/page.tsx frontend/src/components/FarmerRecommendationCard.tsx frontend/src/lib/media-manifest.ts frontend/public/images/crop-canopy.webp frontend/public/images/irrigation-drip.webp frontend/playwright.config.ts frontend/e2e/foundation.spec.ts
git rm frontend/public/images/smart-farming.jpg frontend/public/images/hero-field.png frontend/public/images/aerial-farm.png frontend/public/images/smart-farming.png frontend/public/images/soil-sensing.png
git commit -m "fix(frontend): repair ClimateStats crash, Tailwind v4 reset, and enforce zero-humans media manifest"
```

---

### Task 2: Unified Light/Dark Tokens, ThemeProvider, MotionConfig & Tier-4 Surfaces

**Files:**
- Modify: `frontend/src/app/globals.css`
- Create: `frontend/src/components/providers/ThemeProvider.tsx`
- Create: `frontend/src/components/providers/MotionProvider.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Test: `frontend/e2e/foundation.spec.ts` (append theme + token + reduced-motion tests)

**Interfaces:**
- Consumes: `RootLayout` in `frontend/src/app/layout.tsx`.
- Produces: `ThemeProvider` & `useTheme(): { theme: "light" | "dark"; toggleTheme: () => void; setTheme: (t: "light" | "dark") => void }` (`localStorage` key `"agritech-theme"`), `MotionProvider` wrapping `<MotionConfig reducedMotion="user">`, CSS classes `.bg-archival-grain`, `.bg-topographic-field`, `.bg-oklch-wash`, `.glass-chrome`, and `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--bg-bezel`, `--accent-brass`.

- [ ] **Step 1: Add failing theme & surface CSS tests to `frontend/e2e/foundation.spec.ts`**

Assert `document.documentElement.classList` toggles `"dark"` via `localStorage("agritech-theme")`, `html`/`body` have `overflow-x: clip`, `:root` exposes `--accent-brass` and `--ease-out`, and no CSS rule in `globals.css` uses `transition: all` or `ease-in`.

- [ ] **Step 2: Run foundation test to verify failure**

Run: `npx playwright test e2e/foundation.spec.ts -g "theme tokens"`
Expected: FAIL (`--accent-brass` undefined, `ThemeProvider` missing).

- [ ] **Step 3: Implement tokens, Tier-4 surfaces, `ThemeProvider`, and `MotionProvider`**

1. Add `--bg-bezel`, `--accent-brass`, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`, `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` to `:root` and `.dark` in `frontend/src/app/globals.css`.
2. Add `overflow-x: clip` on `html, body`; enforce `@media (prefers-reduced-motion: reduce)` instant transition fallback; replace `.pill-btn` `transition: all` with `transition: background-color 150ms var(--ease-out), border-color 150ms var(--ease-out), transform 100ms var(--ease-out)`.
3. Implement `.bg-archival-grain` (`pointer-events: none; position: fixed; inset: 0; opacity: 0.022`), `.bg-topographic-field` (inline SVG contour lines), and `.bg-oklch-wash` (`radial-gradient(... in oklch)`).
4. Create `ThemeProvider.tsx` (syncs `.dark` class without hydration mismatch) and `MotionProvider.tsx` (`<MotionConfig reducedMotion="user">`), mounting both in `frontend/src/app/layout.tsx`.

- [ ] **Step 4: Run foundation test to verify pass**

Run: `npx playwright test e2e/foundation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/globals.css frontend/src/components/providers/ThemeProvider.tsx frontend/src/components/providers/MotionProvider.tsx frontend/src/app/layout.tsx frontend/e2e/foundation.spec.ts
git commit -m "feat(frontend): add semantic light/dark tokens, ThemeProvider, MotionConfig, and Tier-4 surfaces"
```

---

### Task 3: Brand Crest SVG, `<AgriTechLogo />` & `<LiquidMetalLogo />`

**Files:**
- Create: `frontend/public/logo-mark.svg`
- Create: `frontend/src/components/brand/AgriTechLogo.tsx`
- Create: `frontend/src/components/brand/LiquidMetalLogo.tsx`
- Test: `frontend/e2e/foundation.spec.ts` (append logo & WebGL fallback tests)

**Interfaces:**
- Produces:
  - `AgriTechLogo({ size?: "sm" | "md" | "lg"; animated?: boolean; showWordmark?: boolean; className?: string })`
  - `LiquidMetalLogo({ size?: number; paused?: boolean; className?: string })`

- [ ] **Step 1: Add failing logo + reduced-motion fallback test**

Assert `/logo-mark.svg` loads (`200 OK`, transparent background), `<LiquidMetalLogo />` renders inside an `80x80` container without throwing WebGL runtime errors, and with `emulateMedia({ reducedMotion: "reduce" })` renders either static fallback `<img>` or `speed=0` static canvas with visible accessible brand label `"AgriTech"`.

- [ ] **Step 2: Run logo test to verify failure**

Run: `npx playwright test e2e/foundation.spec.ts -g "brand logo"`
Expected: FAIL (`Cannot find module '@/components/brand/LiquidMetalLogo'`).

- [ ] **Step 3: Author `logo-mark.svg`, `AgriTechLogo.tsx`, and `LiquidMetalLogo.tsx`**

1. Create `frontend/public/logo-mark.svg` (`viewBox="0 0 64 64"`, pure white silhouette mask with 20% edge margin depicting 3 curved contour furrows feeding an asymmetric leaf + node dot).
2. Create `AgriTechLogo.tsx` rendering the inline geometric SVG paths with CSS `stroke-dashoffset` draw animation (`motion-canvas` pattern, suppressed under `prefers-reduced-motion`) and `Crimson Text` `"AgriTech"` wordmark.
3. Create `LiquidMetalLogo.tsx` (`"use client"`) dynamically importing `LiquidMetal` from `@paper-design/shaders-react` inside an ErrorBoundary, observing viewport visibility via `IntersectionObserver` (`speed={inView && !reducedMotion && !paused ? 0.45 : 0}`), mapping `colorBack` / `colorTint` to active theme, and rendering crisp `/logo-mark.svg` fallback if WebGL fails.

- [ ] **Step 4: Run foundation test to verify pass**

Run: `npx playwright test e2e/foundation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/public/logo-mark.svg frontend/src/components/brand/AgriTechLogo.tsx frontend/src/components/brand/LiquidMetalLogo.tsx frontend/e2e/foundation.spec.ts
git commit -m "feat(brand): add Furrow-Leaf crest SVG, AgriTechLogo, and LiquidMetalLogo shader with fallback"
```

---

### Task 4: 3D Tactile `<TactileButton />`, Double-Bezel `<BezelCard />`, `<SlidingTabs />` & Accessible Forms

**Files:**
- Create: `frontend/src/components/ui/TactileButton.tsx`
- Create: `frontend/src/components/ui/HoldConfirmButton.tsx`
- Create: `frontend/src/components/ui/BezelCard.tsx`
- Create: `frontend/src/components/ui/SlidingTabs.tsx`
- Modify: `frontend/src/components/ui/Button.tsx`
- Modify: `frontend/src/components/ui/Form.tsx`
- Test: `frontend/e2e/foundation.spec.ts`

**Interfaces:**
- Produces:
  - `TactileButton({ variant?: "primary" | "secondary" | "ghost" | "brass" | "destructive"; size?: "sm" | "md" | "lg"; magnetic?: boolean; trailingIcon?: React.ReactNode; loading?: boolean; loadingLabel?: string; success?: boolean; depth?: number; ...ButtonHTMLAttributes })`
  - `HoldConfirmButton({ label: string; holdingLabel?: string; holdMs?: number; onConfirm: () => Promise<void> | void; disabled?: boolean; className?: string })`
  - `BezelCard({ variant?: "card" | "tray" | "kpi"; innerClassName?: string; children: React.ReactNode; className?: string })`
  - `AuthSlabFrame({ children: React.ReactNode; className?: string })`
  - `SlidingTabs<T extends string>({ items: { id: T; label: string; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void; layoutId: string })`
  - Updated `Input` & `Select` in `Form.tsx` accepting `error`, `hint`, `unit`, `id`, automatically wiring `aria-invalid` and `aria-describedby`.

- [ ] **Step 1: Add failing tactile button, Double-Bezel math, and accessible input tests**

Assert `<TactileButton>` height is `>= 44px` (`>= 48px` on `size="lg"`), renders separate ledge + face layers so `:focus-visible` outline stays outside ledge shadow, `<Input error="Invalid">` wires `aria-describedby` pointing to the visible `role="alert"` node, and `<BezelCard>` inner core uses strictly smaller concentric radius than outer shell.

- [ ] **Step 2: Run component test to verify failure**

Run: `npx playwright test e2e/foundation.spec.ts -g "tactile primitives"`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement `TactileButton`, `HoldConfirmButton`, `BezelCard`, `SlidingTabs`, and upgrade `Button.tsx` + `Form.tsx`**

1. Build `TactileButton.tsx` with CSS `color-mix(in oklab, var(--btn-face) 56%, #0d0d08)` ledge, `150ms` desktop hover lift gated by `@media (hover: hover) and (pointer: fine)`, `75ms` active press drop (`scale(0.985)`), `trailingIcon` circular socket translating diagonally on hover, optional `motion/react` spring `magnetic` pointer pull (off under reduced motion), and zero-width-jitter loading label swap via `AnimatePresence`.
2. Build `HoldConfirmButton.tsx` with `clip-path: inset(0 100% 0 0)` fill over `holdMs` (`1800ms`) + instant `200ms` snap-back on pointer cancel/release, plus keyboard `Enter`/`Space` accessible double-confirm prompt so keyboard/screen-reader users are never blocked.
3. Build `BezelCard.tsx` (`rounded-[24px] p-1.5 bg-[var(--bg-bezel)] ring-1 ring-[var(--border-default)]` outer tray + `rounded-[18px] bg-[var(--bg-surface)]` inner core) and `AuthSlabFrame` (`24px` offset `--block` slab behind `24px` frame, `16px` mobile).
4. Build `SlidingTabs.tsx` using `motion.span` `layoutId` pill (`min-h-[44px]`).
5. Refactor `Form.tsx` (`--bg-raised`, `--border-strong`, `min-h-[44px]` desktop / `min-h-[48px]` mobile, `text-base` on mobile inputs to stop iOS zoom, `unit` badge, `aria-describedby` linking hint & error) and map `Button.tsx` cleanly to `TactileButton` so existing imports work seamlessly.

- [ ] **Step 4: Run foundation test to verify pass**

Run: `npx playwright test e2e/foundation.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/ frontend/e2e/foundation.spec.ts
git commit -m "feat(ui): build 3D TactileButton, HoldConfirmButton, Double-Bezel cards, SlidingTabs, and accessible Form"
```

---

### Task 5: Best-in-Class Split-Screen `/login`, `/signup` & Editorial Landing Showcase `/`

**Files:**
- Create: `frontend/src/components/auth/AuthSplitShell.tsx`
- Create: `frontend/src/components/auth/DemoAccountPicker.tsx`
- Create: `frontend/src/components/landing/BrowserShowcaseFrame.tsx`
- Create: `frontend/src/components/landing/LandingScrollStory.tsx`
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/signup/page.tsx`
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/e2e/auth-and-landing.spec.ts`

**Interfaces:**
- Consumes: `AuthSplitShell` consumes `LiquidMetalLogo`, `AgriTechLogo`, `LanguageSelectorPill`, `LanguageSelectorModal`, `ThemeProvider`, `MEDIA_MANIFEST["hero-field"]`, `MEDIA_MANIFEST["irrigation-drip"]`.
- Produces:
  - `AuthSplitShell({ title: string; subtitle: string; mediaId?: "hero-field" | "irrigation-drip"; children: React.ReactNode; showcaseTitle: string; showcaseItems: { icon: React.ReactNode; title: string; desc: string }[] })`
  - `DemoAccountPicker({ onSelect: (creds: { email: string; password: string; role: "ADMIN" | "FARMER" }) => void })`
  - `BrowserShowcaseFrame({ urlLabel: string; children: React.ReactNode })`

- [ ] **Step 1: Write failing `/login`, `/signup`, and `/` Playwright spec**

In `frontend/e2e/auth-and-landing.spec.ts`, test:
1. Unauthenticated `/` renders Editorial Showcase with `<LiquidMetalLogo />`, `hero-field.jpg` (`complete && naturalWidth > 0`), `BrowserShowcaseFrame`, and CTAs to `/login` and `/signup`.
2. `/login` renders `<main>` containing `<h1>` (`Sign in...`) and `<aside>` containing `<h2>` + `hero-field.jpg` (`naturalWidth > 0`; hidden below `960px` so email, password, and primary `Sign in` button stay inside initial `390x844` mobile fold). `/signup` renders human-free `irrigation-drip.webp` (`naturalWidth > 0`) on desktop.
3. Email `onBlur` invalid input attaches visible error via `aria-describedby`; password allows paste; show/hide toggle has `>= 44x44px` box; clicking `"Fill Farmer Demo"` populates `farmer@agritech.io` / `farmer1234` without auto-submitting.
4. Mocked `401` or network-offline error renders OWASP-neutral `role="alert"` recovery banner without wiping email input.

- [ ] **Step 2: Run auth & landing test to verify failure**

Run: `npx playwright test e2e/auth-and-landing.spec.ts`
Expected: FAIL (`<h1>` landmark / `DemoAccountPicker` / `/` landing assertions fail against old skeleton pages).

- [ ] **Step 3: Implement `AuthSplitShell`, `DemoAccountPicker`, `/login`, `/signup`, and `/` Editorial Showcase**

1. Build `AuthSplitShell.tsx` using 55/45 desktop split: left `<main>` (Double-Bezel form container, header with `<AgriTechLogo />`, `<LanguageSelectorPill />` + `<LanguageSelectorModal />`, Theme toggle) and right `<aside>` (`AuthSlabFrame` holding human-free `MEDIA_MANIFEST[mediaId ?? "hero-field"]` with `fetchPriority="high"` + dark-olive scrim `>= 4.5:1` + `<LiquidMetalLogo />` + `<MeshGradient opacity={0.28} />` + `mockup-studio` miniature live telemetry widget labeled `"Illustrative station telemetry"`).
2. Build `DemoAccountPicker.tsx` offering `"Fill Admin Demo"` (`admin@agritech.io` / `admin1234`) and `"Fill Farmer Demo"` (`farmer@agritech.io` / `farmer1234`) with crisp `pop-in` confirmation state.
3. Upgrade `frontend/src/app/login/page.tsx` (`mediaId="hero-field"`) and `frontend/src/app/signup/page.tsx` (`mediaId="irrigation-drip"`) with `onBlur` Zod validation, `CapsLock` `aria-live` detector, `aria-describedby`, `"Forgot password?"` helpful inline popover, and `<TactileButton magnetic trailingIcon />`.
4. Upgrade `frontend/src/app/page.tsx` using `LandingScrollStory.tsx` (dynamically importing `lenis` + `gsap` `ScrollTrigger`/`SplitText` on client, strictly honoring `prefers-reduced-motion`) and `BrowserShowcaseFrame.tsx` previewing AgriTech's dashboard, with fast `"Open Dashboard"` banner if already authenticated.

- [ ] **Step 4: Run auth & landing test to verify pass**

Run: `npx playwright test e2e/auth-and-landing.spec.ts`
Expected: PASS across desktop (`1280x800`) and mobile (`390x844`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/ frontend/src/components/landing/ frontend/src/app/login/page.tsx frontend/src/app/signup/page.tsx frontend/src/app/page.tsx frontend/e2e/auth-and-landing.spec.ts
git commit -m "feat(auth,landing): build WCAG 2.2 AA split-screen login/signup and editorial showcase landing"
```

---

### Task 6: Unified Authenticated Shell, Active Property Context, 10-Script Header & Mobile Drawer

**Files:**
- Create: `frontend/src/components/providers/ActivePropertyProvider.tsx`
- Modify: `frontend/src/app/layout.tsx`
- Modify: `frontend/src/lib/i18n.tsx`
- Modify: `frontend/src/components/LanguageSelectorPill.tsx`
- Modify: `frontend/src/components/LanguageSelectorModal.tsx`
- Modify: `frontend/src/components/AppLayout.tsx`
- Create: `frontend/e2e/workspace-flows.spec.ts`

**Interfaces:**
- Consumes: `propertyApi.list(token)`, `useAuth()`, `useTheme()`, `useLanguage()`.
- Produces: `ActivePropertyProvider` & `useActiveProperty(): { properties: Property[]; activeProperty: Property | null; setActivePropertyId: (id: string) => void; loading: boolean; refresh: () => Promise<void> }`.

- [ ] **Step 1: Write failing shell navigation, i18n header & mobile drawer tests**

In `frontend/e2e/workspace-flows.spec.ts`, test (with mocked auth token):
1. Desktop `AppLayout` displays `<AgriTechLogo />`, localized nav links (`Dashboard`, `Properties`, `Add Property`, `Climate`, `Crop Advice`, `Sensors`, `Irrigation`, `Profile`), `<LanguageSelectorPill />`, Theme toggle button, Active Property selector, and Role badge (`ADMIN` / `FARMER`).
2. Switching language in `<LanguageSelectorModal />` to Hindi (`hi`) translates nav labels and sets `data-lang-script="devanagari"`.
3. Mobile (`390x844`) uses a **single** accessible drawer (no competing fixed bottom bar), supports `Escape` close, restores focus to menu trigger, and has zero `raw #ECEAD0` light bleed in Dark mode.

- [ ] **Step 2: Run workspace test to verify failure**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "AppLayout shell"`
Expected: FAIL (`LanguageSelectorPill` not mounted in `AppLayout`, no theme toggle, no `Properties` nav item).

- [ ] **Step 3: Implement `ActivePropertyProvider`, localize `i18n.tsx`, and refactor `LanguageSelector*` + `AppLayout.tsx`**

1. Create `ActivePropertyProvider.tsx` fetching `propertyApi.list(token)` (gracefully handling offline backend with fallback to Delhi/Ludhiana coordinates and `isDemoFallback` flag).
2. Add navigation, auth, empty-state, and common button translation keys across all 11 languages in `frontend/src/lib/i18n.tsx`.
3. Refactor `LanguageSelectorPill.tsx` and `LanguageSelectorModal.tsx` to replace `#ECEAD0`/`#2A2919`/`#545333` with semantic `var(--bg-raised)` / `var(--text-primary)` / `var(--accent)` tokens and `>= 44px` close/option targets.
4. Upgrade `AppLayout.tsx` with `AgriTechLogo`, `layoutId="nav-active-pill"` indicator, top utility strip (`ActiveProperty` dropdown, `<LanguageSelectorPill />` opening `<LanguageSelectorModal />`, Theme `toggle-flip` button, Role indicator pill), single accessible Radix-focus-managed mobile drawer, and `.bg-archival-grain` + `.bg-topographic-field` root styling.

- [ ] **Step 4: Run shell tests to verify pass**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "AppLayout shell"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/providers/ActivePropertyProvider.tsx frontend/src/app/layout.tsx frontend/src/lib/i18n.tsx frontend/src/components/LanguageSelectorPill.tsx frontend/src/components/LanguageSelectorModal.tsx frontend/src/components/AppLayout.tsx frontend/e2e/workspace-flows.spec.ts
git commit -m "feat(shell): unify AppLayout with ActivePropertyProvider, 10-script i18n, theme toggle, and accessible drawer"
```

---

### Task 7: `/dashboard` Asymmetric Bento Command Center (Rewire `FarmAerialSurvey` & `RootZoneSoilCard`)

**Files:**
- Modify: `frontend/src/components/RootZoneSoilCard.tsx`
- Modify: `frontend/src/components/FarmAerialSurvey.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Modify: `frontend/e2e/workspace-flows.spec.ts`

**Interfaces:**
- Consumes: `useActiveProperty()`, `sensorApi.summary`, `cropApi.summary`, `cropApi.alerts`, `fetchClimate`, `computeClimateStats`, `RootZoneSoilCard`, `FarmAerialSurvey`.
- Produces: Refactored token-compliant `RootZoneSoilCard` & `FarmAerialSurvey` + upgraded `DashboardPage` Bento grid.

- [ ] **Step 1: Add failing dashboard Bento & rewired component tests**

Assert `/dashboard`:
1. Renders dynamic active farm coordinates/name and localized greeting (no hardcoded `"Good morning"`).
2. Renders `RootZoneSoilCard` and `FarmAerialSurvey` (`aerial-farm.jpg` `naturalWidth > 0`) with zero hardcoded `#2A2919`/`#545333` text invisible in `.dark` mode.
3. Under mocked backend `:8080` outage (`502`/abort), clears loading state cleanly, renders Open-Meteo weather KPIs (`tabular-nums`), and shows an actionable retry banner instead of hanging.

- [ ] **Step 2: Run dashboard test to verify failure**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Dashboard command center"`
Expected: FAIL (`RootZoneSoilCard` and `FarmAerialSurvey` absent from `/dashboard`).

- [ ] **Step 3: Refactor `RootZoneSoilCard` & `FarmAerialSurvey` to semantic tokens and wire `/dashboard`**

1. Replace all hardcoded hex colors (`#545333`, `#2A2919`, `#ECEAD0`, `#D9D7B6`) inside `RootZoneSoilCard.tsx` and `FarmAerialSurvey.tsx` with `:root`/`.dark` CSS custom properties and `color-mix()` status chips; enforce `>= 44x44px` zone hotspot tap buttons in `FarmAerialSurvey.tsx`.
2. Rebuild `frontend/src/app/dashboard/page.tsx` as an Asymmetric Bento grid:
   - Header with property context + freshness timestamp (`tabular-nums`) + `<TactileButton>` to `/properties/new`.
   - 4 `<BezelCard variant="kpi">` metrics (`Sensors`, `Crop Fields`, `Temperature`, `Rainfall / ET₀`).
   - Actionable Alerts Rail linking alerts directly to `/irrigation` or `/sensors`.
   - Asymmetric `lg:grid-cols-12`: 7-col `<FarmAerialSurvey />` + 5-col `<RootZoneSoilCard />` (using active property's live Open-Meteo soil moisture & temperature).
   - 14-day Climate Snapshot strip + `"No properties yet"` Double-Bezel empty CTA when property list is empty.

- [ ] **Step 4: Run dashboard test to verify pass**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Dashboard command center"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/RootZoneSoilCard.tsx frontend/src/components/FarmAerialSurvey.tsx frontend/src/app/dashboard/page.tsx frontend/e2e/workspace-flows.spec.ts
git commit -m "feat(dashboard): build Bento command center and rewire RootZoneSoilCard + FarmAerialSurvey"
```

---

### Task 8: `/properties` Inventory Page & `/properties/new` Interactive Map Wizard (Rewire `FarmMap`)

**Files:**
- Create: `frontend/src/app/properties/page.tsx`
- Modify: `frontend/src/app/properties/new/page.tsx`
- Modify: `frontend/src/components/FarmMap.tsx`
- Modify: `frontend/e2e/workspace-flows.spec.ts`

**Interfaces:**
- Consumes: `propertyApi`, `useActiveProperty()`, `usePropertyWizard()`, `FarmMap({ lat, lng, farmName, areaHectares, onLocationChange })`.
- Produces: `/properties` route rendering property inventory grid (`3:2` illustrative cover badged `"Illustrative"`), plus upgraded `/properties/new` Step 1 interactive `FarmMap` picker synced bidirectionally with `lat`/`lon`/`address`.

- [ ] **Step 1: Write failing `/properties` & `/properties/new` interactive map tests**

Assert:
1. Navigating to `/properties` renders registered farm cards (or clean empty state with `"Register farm"` `<TactileButton>`). Clicking `"Set Active"` switches `ActivePropertyProvider` state.
2. On `/properties/new`, Step 1 mounts `<FarmMap />` container alongside lat/lng inputs; Step 4 displays sensor recommendations using Lucide icons (zero `📍` emoji) and `color-mix()` priority badges.

- [ ] **Step 2: Run properties test to verify failure**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Properties inventory"`
Expected: FAIL (`404` on `/properties`, `<FarmMap />` absent on `/properties/new`).

- [ ] **Step 3: Create `/properties` page, refactor `FarmMap.tsx` tokens, and upgrade `/properties/new`**

1. Refactor hardcoded colors inside `FarmMap.tsx` to CSS tokens (`var(--bg-surface)`, `var(--border-default)`, `var(--text-primary)`).
2. Create `frontend/src/app/properties/page.tsx`: 3-column responsive grid (`minmax(0, 1fr)`), `BezelCard` per property with `aerial-farm.jpg` `3:2` slot explicitly badged `"Illustrative image"`, metadata (`areaHa`, `waterSource`, `soilType`), `"Active Farm"` / `"Select"` `<TactileButton>`, and `"Add Property"` primary CTA.
3. Upgrade `frontend/src/app/properties/new/page.tsx`: wire `<FarmMap />` inside Step 1 so map click/search updates `lat`, `lon`, and `address`; add `AnimatePresence` step transitions (`Silk` curve); replace raw `📍` emoji in Step 4 with `<MapPin />` and fix `${PRIORITY_COLOR[r.priority]}22` with `color-mix()`.

- [ ] **Step 4: Run properties test to verify pass**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Properties inventory"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/properties/page.tsx frontend/src/app/properties/new/page.tsx frontend/src/components/FarmMap.tsx frontend/e2e/workspace-flows.spec.ts
git commit -m "feat(properties): add /properties inventory and rewire FarmMap into 5-step onboarding wizard"
```

---

### Task 9: `/climate` Spatial Analytics Studio & `/recommendations` Advisory Hub

**Files:**
- Modify: `frontend/src/components/FarmerRecommendationCard.tsx`
- Modify: `frontend/src/app/climate/page.tsx`
- Modify: `frontend/src/app/recommendations/page.tsx`
- Modify: `frontend/e2e/workspace-flows.spec.ts`

**Interfaces:**
- Consumes: `FarmMap`, `RootZoneSoilCard`, `FarmerRecommendationCard`, `MEDIA_MANIFEST["crop-canopy"]`, `computeFarmerRecommendations` from `frontend/src/lib/climate.ts`, `recommendCrops` from `frontend/src/lib/crops.ts`, `SlidingTabs`.
- Produces: Tokenized Recharts on solid `--bg-surface` paper + accessible `"Data Table"` view toggle on `/climate`; tokenized 5-tab `FarmerRecommendationCard` + human-free `crop-canopy.webp` scouting strip on `/recommendations`.

- [ ] **Step 1: Write failing `/climate` and `/recommendations` tests**

Assert:
1. `/climate` mounts `<FarmMap />`, `<RootZoneSoilCard />`, Recharts charts on solid `--bg-surface` with axis tick font-size `>= 12px`, and a `"View as data table"` toggle rendering an accessible `<table>` with `tabular-nums`.
2. `/recommendations` renders `crop-canopy.webp` (`naturalWidth > 0`, zero `smart-farming` `<img>` references), mounts `<FarmerRecommendationCard />` with working 5-tab switching and interactive daily checklist, and renders top-5 scored crops with Lucide icons instead of `r.crop.emoji`.

- [ ] **Step 2: Run climate & recommendations test to verify failure**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Climate and recommendations"`
Expected: FAIL (`FarmMap`/`FarmerRecommendationCard` absent, Recharts axis tick `< 12px`, `<table>` missing).

- [ ] **Step 3: Upgrade `FarmerRecommendationCard`, `/climate`, and `/recommendations`**

1. Refactor `FarmerRecommendationCard.tsx` hardcoded hexes to CSS tokens, bind line 108 photo slot to `MEDIA_MANIFEST["crop-canopy"]` (human-free wheat canopy), wrap tab header in `<SlidingTabs layoutId="advisory-tabs" />`, and enforce `>= 44px` checklist item checkboxes.
2. Upgrade `frontend/src/app/climate/page.tsx`: integrate `<FarmMap />` + `<RootZoneSoilCard />`, switch Recharts stroke/fill colors to CSS custom properties (`var(--status-warning)`, `var(--status-info)`, `var(--status-good)`), set axis ticks `fontSize: 12`, add a `"Chart / Data Table"` `<SlidingTabs>` toggle so screen-reader & tabular users read exact values directly.
3. Upgrade `frontend/src/app/recommendations/page.tsx`: add natural-color human-free `MEDIA_MANIFEST["crop-canopy"]` (`/images/crop-canopy.webp`) field canopy banner, mount `<FarmerRecommendationCard />` driven by live Open-Meteo `computeFarmerRecommendations`, and replace `r.crop.emoji` in the top-5 crop cards with crisp Lucide botanical category badges.

- [ ] **Step 4: Run climate & recommendations test to verify pass**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Climate and recommendations"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/FarmerRecommendationCard.tsx frontend/src/app/climate/page.tsx frontend/src/app/recommendations/page.tsx frontend/e2e/workspace-flows.spec.ts
git commit -m "feat(climate,recommendations): wire FarmMap, RootZoneSoilCard, FarmerRecommendationCard, and accessible chart tables"
```

---

### Task 10: `/sensors` Fleet CRUD Console, `/irrigation` Valve Control & `/profile` Preferences

**Files:**
- Create: `frontend/src/components/sensors/AddSensorDialog.tsx`
- Create: `frontend/src/components/irrigation/CreateScheduleDialog.tsx`
- Modify: `frontend/src/app/sensors/page.tsx`
- Modify: `frontend/src/app/irrigation/page.tsx`
- Modify: `frontend/src/app/profile/page.tsx`
- Modify: `frontend/e2e/workspace-flows.spec.ts`

**Interfaces:**
- Consumes: `sensorApi`, `irrigationApi`, `MEDIA_MANIFEST["soil-sensing"]`, `MEDIA_MANIFEST["irrigation-drip"]`, `HoldConfirmButton`, `TactileButton`, `LanguageSelectorModal`, `useTheme()`.
- Produces: Working Radix `AddSensorDialog` calling `sensorApi.register(payload, token)`, RBAC-gated admin controls, `HoldConfirmButton` delete flow (`sensorApi.remove`), `CreateScheduleDialog` + human-free `irrigation-drip.webp` header strip + animated SVG pipe/valve flow schematic on `/irrigation`, and full preference console on `/profile`.

- [ ] **Step 1: Write failing `/sensors`, `/irrigation`, and `/profile` tests**

Assert:
1. On `/sensors` (logged in as `ADMIN`), clicking `"Add sensor"` opens accessible Radix Dialog, validates fields, and submits `POST /api/sensors/register`; logged in as `FARMER`, `"Add sensor"` and delete controls are hidden/disabled with read-only notice; status pills use valid `color-mix()` background (not `"var(...)18"`).
2. On `/irrigation`, Demo/Simulation vs Live Hardware distinction banner is visible alongside human-free `irrigation-drip.webp` strip, animated SVG valve schematic, schedules, and events.
3. On `/profile`, user can open `<LanguageSelectorModal />` and switch Light/Dark theme cleanly.

- [ ] **Step 2: Run sensors/irrigation/profile test to verify failure**

Run: `npx playwright test e2e/workspace-flows.spec.ts -g "Sensors, irrigation, and profile"`
Expected: FAIL (`Add sensor` opens nothing, no `HoldConfirmButton`, no Demo clarity banner).

- [ ] **Step 3: Implement `AddSensorDialog`, `CreateScheduleDialog`, and upgrade `/sensors`, `/irrigation`, `/profile`**

1. Build `AddSensorDialog.tsx` using `@radix-ui/react-dialog` + `react-hook-form` + `zod` calling `sensorApi.register`.
2. Upgrade `frontend/src/app/sensors/page.tsx`: fix `${STATUS_COLOR[s.status]}18` to `color-mix()`, add search + status filter chips, wire `AddSensorDialog` (ADMIN-only), wire `<HoldConfirmButton>` to `sensorApi.remove`, and add collapsible Hardware Placement Guide displaying human-free `soil-sensing.jpg` cleanly outside live sensor cards.
3. Build `CreateScheduleDialog.tsx` + animated SVG drip-valve pipe schematic (`motion-canvas` stroke flow, static under reduced-motion) and wire into `frontend/src/app/irrigation/page.tsx` alongside human-free `MEDIA_MANIFEST["irrigation-drip"]` header banner and explicit `"Demo valve simulator vs Live hardware"` clarity pill.
4. Upgrade `frontend/src/app/profile/page.tsx` with Role Permissions Matrix (`ADMIN` vs `FARMER`), Theme switcher, `<LanguageSelectorModal />` trigger, and Sign out `<TactileButton>`.

- [ ] **Step 4: Run sensors/irrigation/profile test to verify pass**

Run: `npx playwright test e2e/workspace-flows.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/sensors/AddSensorDialog.tsx frontend/src/components/irrigation/CreateScheduleDialog.tsx frontend/src/app/sensors/page.tsx frontend/src/app/irrigation/page.tsx frontend/src/app/profile/page.tsx frontend/e2e/workspace-flows.spec.ts
git commit -m "feat(sensors,irrigation,profile): wire sensor CRUD modal, hold-to-delete, valve schematic, and profile preferences"
```

---

### Task 11: Multi-Viewport, Multi-Script, Performance, Accessibility, Security & MiroFish QA Suite

**Files:**
- Create: `frontend/e2e/masterpiece.spec.ts`
- Modify: `graphify-out/` (via `graphify update .`)

**Interfaces:**
- Consumes: Complete built `frontend/` app (`npm run build && npm run start`).
- Produces: Full Playwright visual + behavioral verification across `1280x800`, `390x844`, and `320x640` in Light/Dark + `en`/`hi`/`te`; zero motion-perf violations; `sloplint.mjs` pass; `a11y-debugging` pass; `mirofish` 4-persona simulation ledger; updated `graphify-out/graph.json`.

- [ ] **Step 1: Write comprehensive `frontend/e2e/masterpiece.spec.ts` QA gate**

Assert on every route (`/`, `/login`, `/signup`, `/dashboard`, `/properties`, `/properties/new`, `/climate`, `/recommendations`, `/sensors`, `/irrigation`, `/profile`) across `1280x800` & `390x844`, Light & Dark, and `en` / `hi` / `te`:
- Zero console errors and zero uncaught page errors.
- `document.documentElement.scrollWidth <= window.innerWidth` (plus `320x640` reflow check on `/login` & `/dashboard`).
- Every visible `<img>` has `complete === true && naturalWidth > 0` and zero `src` matches `smart-farming`.
- Every visible interactive `<button>` / `<a href>` inside `<main>`/`<nav>` has `width >= 44 && height >= 44` on mobile (`390x844`).
- Zero leaked `"GCS Guard"` string anywhere in `document.body.innerText`.

- [ ] **Step 2: Run full build, Playwright matrix, motion-perf grep, `sloplint.mjs`, `a11y-debugging`, `security-audit`, and `mirofish`**

1. Build & typecheck: `npx tsc --noEmit && npm run build` inside `frontend/`.
2. Run Playwright matrix: `npx playwright test e2e/masterpiece.spec.ts` and visually inspect captured desktop & mobile screenshots via `read_file` (explicitly confirming zero human figures in any image across all routes).
3. Run `fixing-motion-performance` check: grep `frontend/src/` confirming `0` matches for `transition: all`, `ease-in`, and `width`/`height` keyframes.
4. Run Hallmark lint: `node C:\Users\anjan\.gemini\config\skills\hallmark\scripts\sloplint.mjs frontend/src --url http://localhost:3000/login --render` and confirm `0 FAIL`.
5. Run `a11y-debugging` + `debug-optimize-lcp` check via Chrome DevTools / Playwright accessibility tree on `/login`, `/dashboard`, `/climate`.
6. Execute `security-audit` guidance pass (check XSS sinks, token storage/logout cleanup, RBAC UI parity, external links) and `mirofish` 4-persona simulation (`Power User`, `First-Time Farmer`, `Screen-Reader User`, `Adversarial Skeptic`) logging P0–P3 findings (fix any P0/P1 immediately and re-test).
7. Refresh knowledge graph (`graphify update .`) and confirm 0 orphaned components remain in `frontend/src/components/`.

- [ ] **Step 3: Commit final verified polish**

```bash
git add frontend/e2e/masterpiece.spec.ts
git commit -m "test(e2e): verify multi-viewport, 10-script, dark mode, motion perf, a11y, and security gates"
```

---

### Task 12 (`/writing-skills` TDD Track): Author & Bulletproof Workspace Skill `.agents/skills/agritech-frontend-craft/SKILL.md`

**Files:**
- Create: `.agents/skills/agritech-frontend-craft/SKILL.md`
- Create (temporary test logs in scratch only, keep clean): `docs/superpowers/plans/agritech-skill-pressure-tests.md`

**Interfaces:**
- Follows `C:\Users\anjan\.gemini\config\plugins\superpowers\skills\writing-skills\SKILL.md` Iron Law: **NO SKILL WITHOUT A FAILING TEST FIRST**.
- Produces: Reusable project skill enforcing AgriTech's Tactile Agrarian Atelier tokens, 3D button/Double-Bezel composition, React 19 shader fallbacks, Tailwind v4 `@layer base` guardrails, and the strict **Zero-Humans Project-Style Imagery** mandate.

- [ ] **Step 1 (RED — Baseline Pressure Tests WITHOUT Skill):** Write 3 combined-pressure subagent scenarios (`docs/superpowers/plans/agritech-skill-pressure-tests.md`) testing:
  1. Time pressure + "build a quick AgriTech modal card" -> checks if agent invents raw `#fff` / `bg-green-700` / `transition: all` / flat buttons instead of `TactileButton`, `BezelCard`, and `color-mix()`.
  2. Sunk cost + "add WebGL logo + hero field photo with farmers to a new page" -> checks if agent installs `@react-three/fiber` v8 (breaks React 19), skips `IntersectionObserver` + `reducedMotion` fallback, or includes humans in imagery instead of golden-hour landscape/hardware assets.
  3. Authority pressure + "put KPI numbers over this farm photo" -> checks if agent violates solid-paper data rules or drops `aria-describedby` / `44px` hit targets.
  Dispatch fresh subagents WITHOUT the skill and document exact verbatim rationalizations.

- [ ] **Step 2 (GREEN — Write Minimal Skill Addressing Observed Baseline Failures):** Create `.agents/skills/agritech-frontend-craft/SKILL.md` with:
  - Valid frontmatter (`name: agritech-frontend-craft`, third-person `description` starting with `"Use when..."`, `<= 1024` chars).
  - Structural recipe matching exact failure modes (no vague soft prose, includes concrete `<TactileButton>` + `color-mix()` example + Zero-Humans `MEDIA_MANIFEST` policy, explicit Rationalization Table + Red Flags list countering verbatim Step 1 excuses).

- [ ] **Step 3 (Verify GREEN — Micro-Test Wording & Re-run Pressure Scenarios WITH Skill):** Run 5+ fresh-context wording micro-tests against a no-guidance control (manually reading every flagged match) and re-run all 3 pressure scenarios WITH `.agents/skills/agritech-frontend-craft/SKILL.md` present; confirm `100%` compliance under pressure.

- [ ] **Step 4 (REFACTOR — Close Loopholes & Commit):** Plug any newly surfaced rationalization, update rationalization table, re-verify until clean, and commit.

```bash
git add .agents/skills/agritech-frontend-craft/SKILL.md docs/superpowers/plans/agritech-skill-pressure-tests.md
git commit -m "docs(skills): add TDD-verified agritech-frontend-craft workspace skill"
```

---

## Self-Review Check (Completed Against `writing-plans/SKILL.md`)

1. **Spec Coverage:** Every visual pillar (palette, LiquidMetal logo, 3D tactile buttons, 4-tier backgrounds/images, Silk+Spring motion), login/signup blueprint, all 8 routes (`/`, `/login`, `/signup`, `/dashboard`, `/properties`, `/properties/new`, `/climate`, `/recommendations`, `/sensors`, `/irrigation`, `/profile`), all 7 orphaned components, all 30+ installed skills, QA gates, and `/writing-skills` TDD flow map directly to Tasks 1–12.
2. **Step Scan:** Each step states concrete file paths, exact signatures/assertions, runnable commands, and pass/fail criteria with zero `"TBD"` or generic filler.
3. **Type Consistency:** `ClimateStats` (`avgTempC`, `et0Total`), `MEDIA_MANIFEST`, `useActiveProperty()`, `TactileButton`, `HoldConfirmButton`, `BezelCard`, `AuthSlabFrame`, `SlidingTabs`, `AuthSplitShell`, `DemoAccountPicker`, and `LiquidMetalLogo` signatures align cleanly across `Interfaces` blocks.
4. **Review Focus Coverage:** All 5 uncovered failure classes (Tailwind v4 reset conflict, WebGL/reduced-motion fallback, dark-mode hex bleed, offline `:8080` recovery, mobile keyboard & Indic text overflow) are pinned to Tasks 1, 3, 5, 6, 7, 9, 10, and 11.
5. **Proportion:** Plan locks exact architectural boundaries, props, test criteria, and verification commands without pre-writing redundant component boilerplate.
