# AgriTech Daily Kisan Companion & Truth Shield — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `frontend/` into an installable, offline-first Daily Kisan Companion featuring Simple Farmer Mode, deterministic 6 AM Action Cards with `"Kyun?"` dialect explanations, Kisan Roznamcha verifiable daily logs, Mandi & MSP break-even intelligence, Universal Camera & Image Upload (`CropImagePicker`), Government Schemes + 72-hr PMFBY Evidence Locker, FPO 1-to-50 Broadcasts, Crop Photo Doctor, and a State Agri-Pulse Truth Shield with **Custom Link & Forward Verification** (WhatsApp, Instagram, Reddit, X, YouTube) + Shareable PNG Image Reports.

**Architecture:** All enhancements live strictly inside `frontend/` (Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Zustand, Vitest, Playwright) while leaving all Java/Spring Boot backend modules untouched. Critical daily workflows run deterministically and offline-first via `localStorage` + IndexedDB (`agritech-media`) + FieldShield `syncOutbox`, layered with server-side Next.js API routes (`@google/genai`, SSRF-safe URL extraction, magic-byte image validation).

**Tech Stack:** Next.js `16.4.6`, React `19.3.0`, TypeScript `5`, Tailwind CSS `4`, Zustand `5.0.16`, `@serwist/next` + `serwist`, `@google/genai >= 2.29.1`, `lucide-react`, `vitest`, `@playwright/test`.

**Spec:** [2026-11-28-kisan-companion-architecture.md](../specs/2026-11-28-kisan-companion-architecture.md)

## Global Constraints

- **Backend Isolation:** Zero edits to Java/Spring Boot microservices or `docker-compose.yml`. All new endpoints live in `frontend/src/app/api/*`.
- **No Exposed Secrets:** `process.env.GEMINI_API_KEY` is read strictly server-side in Next.js Route Handlers; never expose keys or key-entry UI in the browser.
- **Permissions-Policy & CSP Fix:** Update `frontend/next.config.ts` from `camera=(), microphone=()` to `camera=(self), microphone=(self), geolocation=(self)` and add `media-src 'self' blob:` so camera/mic work on all devices.
- **Blobs Only in IndexedDB:** Image blobs must NEVER be written to `localStorage` or Zustand; store blobs in IndexedDB (`agritech-media`) and keep only `mediaId` references in `syncOutbox`.
- **Universal Capture Rules:** Always provide `<input type="file" accept="image/*" capture="environment">` + plain gallery upload; gate `getUserMedia` behind `isSecureContext` and call it with **zero resolution/fps constraints**.
- **SSRF & Auditable Truth Score:** `/api/state-pulse/verify` must reject non-`http(s)` schemes and private/loopback IP ranges; Truth Score (0%–100%) is always computed deterministically from 4 weighted signals (`Official Govt 0–50` + `Cross-Source 0–20` + `Recency 0–15` + `Ground/Scam Safety 0–15`).
- **Bharat UX & Verification Gate:** Preserve Area Editorial Botanical tokens, 11 Indic locales, ≥52 px Simple Mode touch targets, zero pill-badge stacks (`·`), and verify every task with `npx vitest run` (final gate: `npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test`).

## Review Focus

- **Camera Denied or No Webcam:** Denying `getUserMedia` or running on a webcam-less laptop must hide/bypass Live Camera cleanly while **Take Photo** and **Upload Photo** remain functional.
- **In-App Browsers (WhatsApp / Instagram WebView):** `<input capture="environment">` and gallery upload must work even when `getUserMedia` is blocked by an embedded WebView.
- **Large / Portrait EXIF / HEIC Photos:** A 12 MB portrait EXIF or HEIC photo must be oriented via `createImageBitmap(..., { imageOrientation: "from-image" })`, compressed below 1.5 MB JPEG (with EXIF stripped), or pass raw HEIC if ≤4 MB, or surface a clear error if oversized/invalid.
- **SSRF & Login-Walled Social Links:** `http://127.0.0.1:8080`, `file://`, or `javascript:` URLs fail closed (`400`); login-walled Instagram/WhatsApp links fall back to domain/scam checks + pasted caption/voice without crashing.
- **Offline Zero-Signal & Tenant Purge:** With `navigator.onLine === false`, 6 AM card, Roznamcha, cached Mandi/Schemes/Pulse, `speechSynthesis`, and IndexedDB photo queueing all work; logout clears `agritech-media` IndexedDB plus Roznamcha/PMFBY/verification logs.

---

### Task 1: Workspace State, 3-Level Location Cascade & Installable PWA Shell

**Files:**
- Modify: `frontend/package.json`, `frontend/next.config.ts`, `frontend/src/lib/property-store.ts`
- Create: `frontend/src/app/manifest.ts`, `frontend/src/app/sw.ts`, `frontend/src/lib/indian-locations.ts`, `frontend/src/components/pwa/PWAInstallButton.tsx`, `frontend/src/components/pwa/OnlineStatusBanner.tsx`, `frontend/src/components/ui/LocationCascadeSelect.tsx`
- Test: `frontend/src/lib/__tests__/indian-locations.test.ts`

**Interfaces:**
- Produces `FarmLocationProfile`: `{ stateCode: string; stateName: string; districtName: string; mandalOrBlock: string; lat?: number; lon?: number }`
- Produces store actions in `useFarmStore`: `farmerMode: "simple" | "full"`, `setFarmerMode(mode)`, `farmLocation: FarmLocationProfile`, `setFarmLocation(loc)`

- [ ] **Step 1: Write failing unit test for 3-level location cascade & default fallback**
  - Assert `getDistrictsForState("OD")` returns Odisha districts including `"Cuttack"` and `getMandalsForDistrict("AP", "Guntur")` returns valid mandals.
- [ ] **Step 2: Run test to verify it fails**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/indian-locations.test.ts`
- [ ] **Step 3: Implement `indian-locations.ts`, `farmerMode` + `farmLocation` in `property-store.ts`, `manifest.ts`, `@serwist/next` service worker, `PWAInstallButton`, `OnlineStatusBanner`, and `LocationCascadeSelect`**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/indian-locations.test.ts`

---

### Task 2: Simple Farmer Mode, Daily 6 AM Action Card, "Kyun?" Dialect Reasoning & Kisan Roznamcha

**Files:**
- Create: `frontend/src/lib/daily-briefing.ts`, `frontend/src/lib/roznamcha.ts`, `frontend/src/components/farmer/SimpleFarmerHome.tsx`, `frontend/src/components/farmer/DailyActionCard.tsx`, `frontend/src/components/farmer/RoznamchaDrawer.tsx`
- Modify: `frontend/src/app/dashboard/page.tsx`
- Test: `frontend/src/lib/__tests__/daily-briefing.test.ts`, `frontend/src/lib/__tests__/roznamcha.test.ts`

**Interfaces:**
- Produces `buildDailyBriefing(property, weather, topMandi, lang): DailyActionBriefing` reusing `evaluateValveInterlock().reasons` and `computeWaterBudget()` from `fieldshield.ts` into `{ irrigationVerdict, kyunReason, sprayWindow: { status: "SAFE" | "CAUTION" | "HOLD"; startHour; endHour; windKmh }, marketHeadline, whatsappText, spokenScript }`.
- Produces `appendRoznamchaEntry(entry)` & `exportRoznamchaPrintHtml(entries, property)` for verifiable offline-signed farm logs (valve runs, moisture, weather triggers).

- [ ] **Step 1: Write failing tests for deterministic 6 AM verdicts, "Kyun?" sensor citations, and Roznamcha log signing**
- [ ] **Step 2: Run tests to verify failure**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/daily-briefing.test.ts src/lib/__tests__/roznamcha.test.ts`
- [ ] **Step 3: Implement `daily-briefing.ts`, `roznamcha.ts`, `SimpleFarmerHome.tsx`, `DailyActionCard.tsx` (**Listen** + **Kyun?** + **Share on WhatsApp**), `RoznamchaDrawer.tsx`, and wire `farmerMode` toggle into `dashboard/page.tsx`**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/daily-briefing.test.ts src/lib/__tests__/roznamcha.test.ts`

---

### Task 3: State Agri-Pulse Feed & Custom Link / Forward Truth-Score Verifier + Shareable Image Report

**Files:**
- Create: `frontend/src/lib/truth-score.ts`, `frontend/src/lib/url-safety.ts`, `frontend/src/lib/truth-report-image.ts`, `frontend/src/app/api/state-pulse/feed/route.ts`, `frontend/src/app/api/state-pulse/verify/route.ts`, `frontend/src/components/pulse/StateAgriPulse.tsx`, `frontend/src/components/pulse/CustomLinkVerifier.tsx`, `frontend/src/app/updates/page.tsx`
- Test: `frontend/src/lib/__tests__/truth-score.test.ts`, `frontend/src/lib/__tests__/url-safety.test.ts`, `frontend/src/lib/__tests__/truth-report-image.test.ts`

**Interfaces:**
- Produces `validatePublicSocialUrl(rawUrl: string): { ok: true; url: URL; platform: "whatsapp" | "instagram" | "reddit" | "x" | "youtube" | "gov" | "web" } | { ok: false; reason: string }` (blocks `localhost`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, non-HTTP(S)).
- Produces `computeTruthScore(signals: TruthSignals): TruthScoreResult` returning `totalPercent` (0–100), `tierLabel` (`"VERIFIED_OFFICIAL" | "PARTIALLY_VERIFIED" | "UNVERIFIED_RUMOUR"`), 4-factor breakdown, and `scamWarning`.
- Produces `renderTruthReportPng(report: TruthReportCardData): Promise<Blob>` (1080×1080 offline Canvas PNG) + `shareTruthReportToWhatsApp(report, blob)`.
- `POST /api/state-pulse/verify` accepts `{ url?: string; text?: string; stateCode: string; districtName?: string; language: string }` and returns Truth Score + 2-sentence dialect explanation + WhatsApp fact-check share text.

- [ ] **Step 1: Write failing tests for SSRF URL safety, 4-factor deterministic Truth Score rubric & report image payload**
- [ ] **Step 2: Run tests to verify failure**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/truth-score.test.ts src/lib/__tests__/url-safety.test.ts src/lib/__tests__/truth-report-image.test.ts`
- [ ] **Step 3: Implement `url-safety.ts`, `truth-score.ts`, `truth-report-image.ts`, `/api/state-pulse/feed`, `/api/state-pulse/verify`, `CustomLinkVerifier.tsx`, `StateAgriPulse.tsx`, and `/updates` route**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/truth-score.test.ts src/lib/__tests__/url-safety.test.ts src/lib/__tests__/truth-report-image.test.ts`

---

### Task 4: Mandi & MSP Board with Personal Break-Even Cost Bar

**Files:**
- Create: `frontend/src/lib/mandi-data.ts`, `frontend/src/app/api/mandi/route.ts`, `frontend/src/components/mandi/MandiBoard.tsx`, `frontend/src/app/mandi/page.tsx`
- Test: `frontend/src/lib/__tests__/mandi-data.test.ts`

**Interfaces:**
- Produces `calculateBreakEven(inputCostPerAcre: number, expectedYieldQuintals: number, modalPriceInr: number, transportPerQuintal: number)` returning `{ breakEvenPerQuintal, netModalPerQuintal, profitPerQuintal, marginPercent, verdict: "SELL_NOW" | "HOLD" | "WATCH" }`.

- [ ] **Step 1: Write failing unit tests for break-even calculation and Indian rupee formatting (`en-IN`)**
- [ ] **Step 2: Run test to verify failure**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/mandi-data.test.ts`
- [ ] **Step 3: Implement `mandi-data.ts`, `/api/mandi/route.ts`, `MandiBoard.tsx`, and `/mandi` route**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/mandi-data.test.ts`

---

### Task 5: Universal Camera & Image Upload Pipeline

**Files:**
- Create: `frontend/src/lib/media-capabilities.ts`, `frontend/src/lib/image-prep.ts`, `frontend/src/lib/media-queue.ts`, `frontend/src/components/media/CropImagePicker.tsx`, `frontend/src/components/media/LiveCameraModal.tsx`
- Modify: `frontend/next.config.ts`, `frontend/src/lib/property-store.ts` (`SyncOutboxKind` + `clearSessionData()`)
- Test: `frontend/src/lib/__tests__/media-capabilities.test.ts`, `frontend/src/lib/__tests__/image-prep.test.ts`, `frontend/src/lib/__tests__/media-queue.test.ts`

**Interfaces:**
- Produces `detectCaptureCapabilities(env: CaptureEnvironment)` returning `{ showTakePhotoCapture, showUploadFile, showLiveCamera, showDropAndPaste, canShareImageFiles, isStandalonePwa }`.
- Produces `validateImageFile(file)`, `computeTargetSize(w, h, maxEdge = 1568)`, and `prepareImageForDiagnosis(file, { maxEdge: 1568, quality: 0.82, maxBytes: 1_500_000 })`.
- Produces `MediaStore` interface (`put`, `get`, `delete`, `clearAll`) backed by IndexedDB `agritech-media` in browser and in-memory adapter in tests.
- Produces `CropImagePicker({ onImageReady, disabled? })` combining `<input capture="environment">`, opt-in `LiveCameraModal` (`getUserMedia` with **no resolution constraints**), plain file upload, desktop drag/paste, and a preview/Retake step.
- Extends `SyncOutboxKind` in `property-store.ts` with `"crop_diagnosis" | "pmfby_evidence" | "roznamcha_entry"`.

- [ ] **Step 1: Write failing unit tests for capture capabilities, image sizing/validation, and `MediaStore` round-trip**
  - Assert: `computeTargetSize(4000, 3000)` → `{ width: 1568, height: 1176 }`; `computeTargetSize(800, 600)` stays `{ width: 800, height: 600 }`; `validateImageFile` rejects `image/gif` (`UNSUPPORTED_TYPE`) and 16 MB jpeg (`TOO_LARGE`); `detectCaptureCapabilities` with `hasMediaDevices: false` → `showLiveCamera: false`; with `isSecureContext: false` → `showLiveCamera: false`; in-memory `MediaStore` put/get/delete round trip.
- [ ] **Step 2: Run tests to verify failure**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/media-capabilities.test.ts src/lib/__tests__/image-prep.test.ts src/lib/__tests__/media-queue.test.ts`
- [ ] **Step 3: Update `next.config.ts` (`Permissions-Policy` + `media-src 'self' blob:`), extend `property-store.ts`, and implement `media-capabilities.ts`, `image-prep.ts`, `media-queue.ts`, `LiveCameraModal.tsx`, and `CropImagePicker.tsx`**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/media-capabilities.test.ts src/lib/__tests__/image-prep.test.ts src/lib/__tests__/media-queue.test.ts`

---

### Task 6: Government Schemes, PMKSY Drip Estimator, AgriStack Wallet & 72-Hr PMFBY Evidence Locker

**Files:**
- Create: `frontend/src/lib/schemes-data.ts`, `frontend/src/app/api/schemes/route.ts`, `frontend/src/components/schemes/SchemesAndLocker.tsx`, `frontend/src/app/schemes/page.tsx`
- Test: `frontend/src/lib/__tests__/schemes-data.test.ts`

**Interfaces:**
- Consumes `CropImagePicker` + `MediaStore` from **Task 5** for capturing offline GPS+photo crop-loss evidence without storing image blobs in `localStorage`.
- Produces `estimatePmksySubsidy(landAcres: number, farmerCategory: "small_marginal" | "other", stateCode: string)` and offline `PmfbyLossEvidencePack` persistence with live 72-hour countdown.

- [ ] **Step 1: Write failing unit tests for PMKSY 45%/55% subsidy math & 72-hr PMFBY deadline countdown**
- [ ] **Step 2: Run test to verify failure**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/schemes-data.test.ts`
- [ ] **Step 3: Implement `schemes-data.ts`, `/api/schemes/route.ts`, `SchemesAndLocker.tsx` (wired to `CropImagePicker`), and `/schemes` route**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/schemes-data.test.ts`

---

### Task 7: Crop Photo Doctor, Vernacular Voice Companion & FPO 1-to-50 Broadcast Command Center

**Files:**
- Create: `frontend/src/lib/image-sniff.ts`, `frontend/src/app/api/ai/diagnose/route.ts`, `frontend/src/app/api/ai/transcribe/route.ts`, `frontend/src/app/api/ai/tts/route.ts`, `frontend/src/components/ai/CropDoctorModal.tsx`, `frontend/src/components/ai/VoiceCompanionDrawer.tsx`, `frontend/src/components/fpo/FpoBroadcastPanel.tsx`
- Test: `frontend/src/lib/__tests__/image-sniff.test.ts`, `frontend/src/lib/__tests__/fpo-broadcast.test.ts`

**Interfaces:**
- Consumes `CropImagePicker` + `prepareImageForDiagnosis` + `MediaStore` from **Task 5**.
- Produces `sniffImageMime(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | "image/heic" | null` recognizing JPEG (`FFD8FF`), PNG (`89504E47`), WebP (`RIFF....WEBP`), and HEIC (`ftypheic`/`ftypheif`/`ftypmif1`) while rejecting `%PDF` or arbitrary payloads.
- `POST /api/ai/diagnose` (`runtime = "nodejs"`) accepts `multipart/form-data` (`image`, `cropName`, `language`, `propertyId`, optional `windKmh`, `rainProb`), enforces `Authorization`, per-IP rate limit (`10/min`), `<= 4 MB`, `sniffImageMime`, and calls `gemini-4-hydrogen` (`25s` timeout) returning `isHealthy`, `healthStatus`, `confidencePercent`, `problems[]`, `organicRemedies[]`, `recommendedMedicines[]`, and `spraySafetyNote` (or `503 ai_unavailable` without faking; `<60%` shows KVK + `1800-180-1551`).
- `POST /api/ai/transcribe` (`gemini-3.5-transcribe`) & `POST /api/ai/tts` (`gemini-3.8-flash-lite-tts` WAV) with offline Web Speech API fallback.
- `FpoBroadcastPanel` aggregates briefings across up to 50 member parcels into a single WhatsApp broadcast message + pooled water-saved summary.

- [ ] **Step 1: Write failing tests for `sniffImageMime` (JPEG/PNG/WebP/HEIC pass, `%PDF` reject) & FPO broadcast aggregation**
- [ ] **Step 2: Run tests to verify failure**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/image-sniff.test.ts src/lib/__tests__/fpo-broadcast.test.ts`
- [ ] **Step 3: Implement `image-sniff.ts`, `/api/ai/*` routes, `CropDoctorModal.tsx`, `VoiceCompanionDrawer.tsx`, and `FpoBroadcastPanel.tsx`**
- [ ] **Step 4: Run tests to verify pass**
  - Run: `cd frontend && npx vitest run src/lib/__tests__/image-sniff.test.ts src/lib/__tests__/fpo-broadcast.test.ts`

---

### Task 8: Mobile 5-Tab Thumb Bar, 11-Language i18n Parity & End-to-End Verification

**Files:**
- Modify: `frontend/src/components/AppLayout.tsx`, `frontend/src/lib/i18n.tsx`, `frontend/playwright.config.ts`
- Create: `frontend/e2e/fixtures/leaf.jpg`, `frontend/e2e/kisan-companion.spec.ts`

- [ ] **Step 1: Add navigation links (`Mandi & MSP`, `State Updates`, `Govt Schemes`) in `AppLayout.tsx` + 5-tab Fixed Bottom Bar on mobile (`Today`, `Mandi`, `Updates`, `Schemes`, `Camera/Voice`)**
- [ ] **Step 2: Add i18n keys across all 11 Indic locales in `i18n.tsx`**
- [ ] **Step 3: Add `mobile` (`390×844`) Playwright project in `playwright.config.ts` and write `kisan-companion.spec.ts` covering Simple Mode toggle, Crop Photo Doctor upload (`setInputFiles` with `leaf.jpg` + mocked `/api/ai/diagnose`), Live Camera capture (Chromium `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`), Custom Link Truth Shield + PNG report, Mandi break-even, and 72-hr PMFBY locker at `390x844` and `1280x800`**
- [ ] **Step 4: Run full verification suite**
  - Run: `cd frontend && npx tsc --noEmit && npm run lint && npx vitest run && npm run build && npx playwright test e2e/kisan-companion.spec.ts`
