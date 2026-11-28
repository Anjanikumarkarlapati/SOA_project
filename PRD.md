# PRD.md - AgriTech FieldShield & Daily Kisan Companion (Scoped v3)

- **Product:** AgriTech Field Portal (`frontend/`, Next.js `16.4.6` + `@astryxdesign/core@0.7.17`) + FieldShield Microservices Platform
- **Status:** Baseline `LIVE` (`73/73` Vitest, `53/53` Playwright, `100/100` Maven) | Companion v3 `SCOPED & READY FOR IMPLEMENTATION`
- **Target Scope:** `frontend/` + Next.js server route handlers (`frontend/src/app/api/*`); Java/Spring Boot backend remains untouched.

---

## 1. Problem Statement & Personas

Indian smallholder farmers face unpredictable power/rain windows, opaque mandi margins after input/transport costs, strict **72-hour PMFBY insurance claim cutoffs**, and viral WhatsApp/social subsidy rumours.

| Persona | Device & Context | Primary Jobs-to-be-Done |
|---|---|---|
| **Smallholder Farmer** (`< 2 ha`, age 40-65) | Budget Android (`390x844`), direct sunlight, soiled hands, intermittent 2G/4G | See or hear today's 6 AM water/spray/market action in local script; ask `"Kyun?"`; snap a crop photo; log storm damage offline |
| **Rural Youth / Family Mediator** | Shared Android/iPhone, active on WhatsApp, Instagram, Reddit, YouTube | Paste forwarded links into Truth Shield, verify the `0-100%` Truth Score, and share `1080x1080` PNG fact-check cards to village WhatsApp groups |
| **FPO Coordinator / Krishi Sakhi** | Laptop (`1280x800+`) or tablet managing `50` member parcels | Review pooled parcel telemetry, broadcast one verified WhatsApp morning briefing to 50 farmers, and export water-saving proof |

---

## 2. Baseline Capabilities (`LIVE` Today)

- **Auth & Parcel Setup:** Supabase Google OAuth + local HS256 JWT auth, 5-step farm wizard (`48` Indian crops, `7` soil types), `FarmMap`, `FarmGoogleMap`, and `FieldTerrain3D`.
- **FieldShield Agronomic Core (`fieldshield.ts`):** FAO-56 $ET_0$ water budget, Rain-Hold & Soil-Saturation valve interlock, 15/30/60 cm root-zone telemetry, and offline `syncOutbox`.
- **Astryx Editorial UI & 11 Locales:** Area Editorial Botanical theme (`globals.css` + `AstryxProvider.tsx`) across `en`, `hi`, `pa`, `mr`, `te`, `ta`, `kn`, `bn`, `gu`, `or`, and `ml`.

---

## 3. Scoped Requirements: All 10 Daily Kisan Companion Features

*(Mapped to Master Plan v3 `Tasks 1-8`, where Universal Media Capture is extracted as `Task 5` so Schemes `Task 6` and Crop Doctor/Voice/FPO `Task 7` share one unified cross-device camera & IndexedDB pipeline before Mobile Nav/E2E `Task 8`.)*

### Feature 1: Simple Farmer Mode + Location Cascade (`Task 1 & 2`)
- Persistent `farmerMode: "simple" | "full"` toggle rendered via Astryx `SegmentedControl` in `useFarmStore`.
- Sunlight-legible Simple Mode home view on `/dashboard` using Astryx `Grid` + `ClickableCard` tiles (`>= 52px` tall, explicit icon + vernacular label, zero multi-chart clutter).
- 3-level **State -> District -> Mandal** cascade (`Selector` trio in `LocationCascadeSelect.tsx`) synced automatically across `/mandi`, `/updates`, and `/schemes`.

### Feature 2: Deterministic 6 AM Action Card (`Task 2`)
- Focal Astryx `Card`/`BezelCard` presenting offline-first daily verdicts for **Water** (litres/minutes or skip), **Spray-Safe Clock** (`StatusDot` + `SAFE / CAUTION / HOLD` wind & rain window), and **Market** headline.
- One-tap **Listen** button streaming `gemini-3.8-flash-lite-tts` WAV audio when online and falling back automatically to browser `window.speechSynthesis` when offline, plus 1-tap **Share on WhatsApp**.

### Feature 3: Kisan Roznamcha (`Task 2`)
- Auto-signed, timestamped daily log of valve runs, soil moisture readings, and weather interlock triggers persisted offline (`roznamcha.ts`).
- Accessible via Astryx `Drawer` (`>= 640px`) / `BottomSheet` (`< 640px`) with `List` + `Item` + `Timestamp` rows, exportable as a scheme/insurance-ready printable PDF (`@media print`) or WhatsApp digest.

### Feature 4: "Kyun?" Dialect Explanations (`Task 2`)
- One-tap `"Kyun?"` Astryx `Collapsible` / `ToggleButton` on every verdict revealing a 2-sentence plain-language explanation in the farmer's active Indic script citing the exact sensor moisture %, forecasted rain mm/probability, and wind speed (`fieldshield.ts`).

### Feature 5: State Agri-Pulse & Custom Link Truth Shield + Shareable Image Report (`Task 3`, `/updates`)
- Location-filtered feed (`GET /api/state-pulse/feed`) rendered as clean Astryx `List`/`Item` rows with `SegmentedControl` filters (`All`, `Official 85%+`, `Social Pulse`, `Verify Link`).
- **Custom Link & Forward Verifier (`POST /api/state-pulse/verify`):** Paste any **WhatsApp, Instagram, Reddit, X, or YouTube link** (or forwarded text) into an Astryx `InputGroup` + `TextInput`/`TextArea` for SSRF/phishing pre-checks (`url-safety.ts`), public metadata extraction, and a deterministic **4-factor `0%-100%` Truth Score** (`ProgressBar` + `Citation` links + *Verified True* vs. *Unverified Rumour* dialect verdict).
- **Shareable Fact-Check Image Report (`truth-report-image.ts`):** Client-side `1080x1080` Canvas PNG generator stamping the Truth %, True/Rumour badge, checked link/claim, 2-sentence dialect summary, and 4-factor breakdown for 1-tap **WhatsApp Group sharing** (`navigator.share({ files })` + PNG download fallback).

### Feature 6: Mandi & MSP Board with Personal Break-Even Bar (`Task 4`, `/mandi`)
- Nearby APMC and e-NAM modal rates rendered in an edge-to-edge Astryx `Table` (`tabular-nums`, `en-IN` rupee formatting, MSP floor delta, and `StatusDot` `SELL_NOW / HOLD / WATCH`).
- Live **Personal Break-Even Cost Bar** (`Card` + controlled `NumberInput`s for per-acre input cost, expected yield, and transport) showing exact `₹/quintal` net profit margin.

### Feature 7: Government Schemes, AgriStack & 72-Hr PMFBY Evidence Locker (`Task 5 & 6`, `/schemes`)
- Astryx `TabList`/`Tab` organizing **PM-KISAN**, **PMKSY `45%/55%` Drip Subsidy Estimator** (`NumberInput` + `SegmentedControl`), **Soil Health Card**, **KCC**, and **11-digit AgriStack Farmer ID** (`CheckboxList`).
- Offline **72-Hour PMFBY Loss Locker** combining GPS coordinates, parcel telemetry, a live 72-hour Astryx `Timer` countdown, and `CropImagePicker` photos stored in IndexedDB (`agritech-media`).

### Feature 8: Crop Photo Doctor (`Task 5 & 7`)
- Cross-device `CropImagePicker` (unlocking `Permissions-Policy: camera=(self), microphone=(self)` in `next.config.ts`) supporting **Take Photo** (`capture="environment"`), opt-in **Live Camera** (`getUserMedia` with zero resolution constraints), **Gallery Upload**, and desktop **Drop/Paste**, compressing to `<= 1568px` / `<= 1.5MB` JPEG into IndexedDB.
- Astryx `Dialog` (`CropDoctorModal`) calling `POST /api/ai/diagnose` (`gemini-3.8-flash` + `sniffImageMime` magic-byte check) to return **Healthy / Not Healthy** status, **Detected Problems**, **Organic + Chemical Medicines** with per-acre dosage and harvest wait days, and **Spray-Safety Check** (with `<60%` KVK + `1800-180-1551` `Banner` referral and offline FieldShield queueing).

### Feature 9: Vernacular Voice Companion + FPO 1-to-50 Broadcast Center (`Task 7`)
- Tap-to-speak regional voice input (`POST /api/ai/transcribe` via `gemini-3.5-transcribe` + offline Web Speech fallback) inside an Astryx `BottomSheet`/`Drawer` with an editable `TextArea` transcript confirmation before submitting.
- **FPO Broadcast Panel** aggregating up to `50` member parcels in an Astryx `Table`/`List` to compose and send one verified WhatsApp morning briefing + pooled water-saved summary.

### Feature 10: Installable Offline-First PWA & Mobile 5-Tab Thumb Bar (`Task 1 & 8`)
- `@serwist/next` service worker caching (`manifest.ts` + `sw.ts`), `PWAInstallButton` (Android prompt + iOS Safari `BottomSheet` guide), and `OnlineStatusBanner` (`Banner`).
- Astryx `MobileNav` 5-tab thumb bar (`Today`, `Mandi`, `Updates`, `Schemes`, `Camera/Voice`) keeping total sticky chrome `<= 15%` of viewport height, full 11-language parity in `i18n.tsx`, and Playwright E2E verification at `390x844` and `1280x800`.

---

## 4. Explicit Non-Goals & Release Gates

- **Non-Goals:** Modifying Spring Boot Java microservices, paid WhatsApp Business Cloud API webhooks, ungrounded LLM Truth % guesses, or storing binary image blobs in `localStorage`.
- **Release Gates:** `npx tsc --noEmit` (`0` errors), `npm run lint` (`0` errors), `npx vitest run` (`100%` pass), `npm run build` (`0` errors), and `npx playwright test` passing across `390x844` and `1280x800` with `0` console/overflow errors.
