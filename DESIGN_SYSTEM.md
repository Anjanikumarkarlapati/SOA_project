# DESIGN_SYSTEM.md

Authoritative **Astryx + Area Editorial Botanical** frontend design system for `frontend/` (`@astryxdesign/core@0.7.17`, Next.js `16.4.6`, React `19.3.0`, Tailwind CSS `4`), grounded in live [globals.css](./frontend/src/app/globals.css) and [AstryxProvider.tsx](./frontend/src/components/providers/AstryxProvider.tsx).

> **Source-of-Truth Note:** `AgriTech-Frontend-Design-Rules.txt` in the repo root is a historical audit of an earlier Vite `#FDFBD4` prototype. Do not copy its hex values. All UI code must follow the Astryx rules, CSS custom properties, and component mappings below.

---

## 1. Mandatory Astryx Workflow & 8 Core Rules

Before building or editing any UI surface in `frontend/`, query the local Astryx CLI from `frontend/`:

```powershell
cd frontend
npx astryx search "<what you need>"          # 1. Discover matching components & templates
npx astryx build "<feature idea>"            # 2. Pick the closest page/block template frame
npx astryx component <Name>                  # 3. Read exact props BEFORE writing JSX (never guess props)
npx astryx docs is-my-code-good --full       # 4. Self-review checklist before completion
```

### The 8 Non-Negotiable Astryx Rules
1. **Components Over Raw Primitives:** Reach for `@astryxdesign/core/*` (`Layout`, `Section`, `Stack`, `HStack`, `VStack`, `Grid`, `Card`, `ClickableCard`, `Table`, `List`, `Item`, `SegmentedControl`, `Selector`, `FileInput`, `Drawer`, `BottomSheet`, `Dialog`, `AlertDialog`, `Banner`, `ProgressBar`, `StatusDot`, `Collapsible`, `Timer`, `Citation`, `MobileNav`, `Heading`, `Text`, `Button`, `IconButton`) before raw `<div>`, `<span>`, `<button>`, or `<input>`.
2. **Frame-First Page Layout:** Scaffold regions and width budgets (`AppLayout` + `Layout` / `Section` / `Grid`) before filling content.
3. **Rows Over Card-Soup for Dense Data:** Render mandi rates, scheme checklists, Roznamcha logs, and State Agri-Pulse feeds as clean edge-to-edge rows (`Table` or `List` + `Item` + `Divider`); reserve `Card` and `BezelCard` for focal anchors (6 AM Action Card, Truth Score Meter, Break-Even Bar).
4. **StyleX (`xstyle`) or Semantic Tailwind Utilities:** Customize Astryx components via `xstyle` or semantic token classes; never attach inline `#hex` or arbitrary `px` styles to raw DOM nodes.
5. **Semantic Tokens Only:** Reference `--bg-*`, `--text-*`, `--border-*`, `--accent*`, `--status-*`, and Astryx `--color-*` / `--spacing-*` / `--radius-*` variables so Daylight and Night Field themes switch automatically.
6. **Controlled Form Inputs:** Every `Selector`, `TextInput`, `TextArea`, `NumberInput`, `CheckboxList`, `SegmentedControl`, and `FileInput` uses controlled `value` + `onChange`.
7. **Router-Integrated Links:** Navigate via `Link` / `useLinkComponent()` (wired to `next/link` inside `AstryxProvider.tsx`), never raw `<a href>` tags for internal routes.
8. **Status = `StatusDot` + Icon + Vernacular Word:** Reserve `Badge` strictly for counts and enumerated tiers; never rely on color alone or decorative pill-badge stacks.

---

## 2. Color Tokens (`globals.css` & `AstryxProvider.tsx`)

### 2.1 Surface, Ink, Border & Botanical Accent Tokens

| CSS Variable | Astryx Theme Mapping | Daylight (`:root`) | Night Field (`.dark`) | Role |
|---|---|---|---|---|
| `--bg-base` | `--color-background-body` | `#FFFFFF` | `#0E110B` | Sunlight-legible alabaster / night canvas (`>= 4.5:1` contrast) |
| `--bg-surface` | `--color-background-surface` / `card` | `#FFFFFF` | `#151911` | Cards, drawers, sheets, dialogs |
| `--bg-raised` | `--color-background-muted` | `#F7F8F5` | `#1D2318` | Secondary wells, dropzones, skeleton wells |
| `--bg-bezel` | Outer bezel frame | `#F2F4EE` | `#11150E` | Outer ring in `BezelCard` and `EditorialPhotoFrame` |
| `--text-primary` | `--color-text-primary` | `#000000` | `#F5F7F2` | Primary headings, readings, body copy |
| `--text-secondary` | `--color-text-secondary` | `#6F6F6F` | `#A6B09D` | Lead copy, dialect explanations, labels |
| `--text-muted` | Captions & eyebrows | `#767676` | `#8A9580` | Eyebrows, `·` inline metadata, timestamps |
| `--border-default` | `--color-border` | `#E9E9E9` | `#262E20` | `1px` single-elevation card and row dividers |
| `--border-strong` | `--color-border-emphasized` | `#C7C9C2` | `#47543B` | Active inputs, focus boundaries, scrollbars |
| `--accent` | `--color-accent` | `#485C11` | `#9AB556` | Primary CTAs, active tabs, verified meters |
| `--accent-hover` | Hover accent | `#38480D` | `#B0C96E` | Primary button / interactive hover |
| `--accent-wash` | `--color-accent-muted` | `#DFECC6` | `#242F18` | Secondary tactile fill, selected tile wash |
| `--on-accent` | `--color-on-accent` | `#FFFFFF` | `#0E110B` | Foreground ink/icons on `--accent` |

### 2.2 Semantic Status Tokens (`StatusDot` + `Banner` + Explicit Label)

| Token | Astryx Token | Daylight | Night Field | Domain Meaning |
|---|---|---|---|---|
| `--status-good` | `--color-success` | `#485C11` | `#9AB556` | Safe spray window, `85-100%` Verified True, `SELL_NOW` above cost, `HEALTHY` leaf |
| `--status-warning` | `--color-warning` | `#9A6300` | `#E0B243` | Caution wind (`15-20 km/h`), `55-84%` Partially Verified, `HOLD`/`WATCH`, mild stress |
| `--status-critical` | `--color-error` | `#B3261E` | `#F07A72` | Spray/Irrigation `HOLD`, `0-54%` Unverified Rumour/Scam, `<24h` PMFBY timer, disease |
| `--status-info` | `--color-info` | `#2C5E8A` | `#78B1DB` | Forecast advisories, synced Roznamcha entries, AgriStack progress |

---

## 3. Typography & 11-Language Indic Scale

- **Font Stack & Loading:** Preconnected `<link rel="stylesheet">` tags with `display=swap` in `frontend/src/app/layout.tsx` (zero render-blocking CSS `@import`s) loading `Fraunces` (`opsz` `9..144`, `400..700`, `SOFT 50, WONK 0`, `--font-serif`), `Plus Jakarta Sans` (`400..700`, `--font-sans`), and `JetBrains Mono` (`400/500/600` with `tabular-nums`, `--font-mono`; never apply `700`/faux-bold to `JetBrains Mono`).
- **Astryx Scale (`agritechFieldTheme`):** `scale: { base: 15.5, ratio: 1.225 }`, paired with `<Heading level={1|2|3}>` and `<Text>`.
- **Semantic Type Classes (`globals.css`):** `.type-page-title` (`clamp(1.75rem, 2.5vw, 2.25rem)`), `.type-section-title` (`clamp(1.375rem, 1.8vw, 1.625rem)`), `.type-card-title` (`19px`), `.type-eyebrow` (`11px` mono), `.type-lead` (`15px`), `.type-kpi` (`clamp(1.5rem, 2.1vw, 1.875rem)` tabular mono), `.type-kpi-sm` (`18px` tabular mono), `.type-caption` (`12px`, minimum `11px` floor).
- **11 Indic Locales (`en`, `hi`, `pa`, `mr`, `te`, `ta`, `kn`, `bn`, `gu`, `or`, `ml`):** `html[data-lang-script]` swaps to `Noto Serif <Script>` / `Noto Sans <Script>` (with `"Plus Jakarta Sans"` Latin fallback), sets `--indic-line-height: 1.65-1.70`, `--indic-tracking: 0`, resets `font-variation-settings: normal` on non-Latin headings, and disables uppercase/letter-spacing on `.type-eyebrow` for non-Latin scripts.

---

## 4. Astryx Component Blueprint for All 10 Daily Kisan Companion Features

Every feature maps directly to installed `@astryxdesign/core` primitives and Bharat UX ergonomics:

| # | Feature & Task | Primary `@astryxdesign/core` Primitives | Bharat UX & Layout Rules |
|---|---|---|---|
| **1** | **Simple Farmer Mode + Location Cascade (`Task 1 & 2`)** | `SegmentedControl` (`simple \| full`), 3x controlled `Selector` inside `HStack`/`Stack` (`State -> District -> Mandal`), `Grid` + `ClickableCard` (`min-h-[52px]` sunlight-legible icon+label tiles) | Persist `farmerMode` & `farmLocation` in `useFarmStore`; changing location updates `/mandi`, `/updates`, and `/schemes` together |
| **2** | **Deterministic 6 AM Action Card (`Task 2`)** | `Card` / `BezelCard` focal anchor, `Heading`, `StatusDot` + explicit `SAFE / CAUTION / HOLD` Spray-Safe Clock label, tactile `Button` (`Listen`, `Share on WhatsApp`), `Skeleton` while hydrating | 100% offline deterministic Water, Spray, and Market verdicts; `Listen` streams `gemini-3.8-flash-lite-tts` WAV or falls back to `speechSynthesis` |
| **3** | **Kisan Roznamcha (`Task 2`)** | `Drawer` (`>= 640px` desktop) / `BottomSheet` (`< 640px` touch) with `Layout` (`DrawerHeader`, `LayoutContent`, `LayoutFooter`), `List` + `Item` + `Timestamp`, `Button` (`Export PDF`, `WhatsApp Digest`) | Auto-signs valve runs, soil moisture %, and weather triggers locally; `@media print` produces clean white-paper scheme/insurance proof |
| **4** | **"Kyun?" Dialect Explanations (`Task 2`)** | `ToggleButton` or `Collapsible` trigger (`"Kyun?"` in active script) revealing a calm `--bg-raised` `Section` + `Text` (`.type-lead`) + `IconButton` (`Listen`) | Strictly 2 plain-language sentences in the active Indic script citing exact sensor moisture %, rain mm/prob, and wind speed from `fieldshield.ts` |
| **5** | **State Agri-Pulse & Custom Link Truth Shield + Shareable Image Report (`Task 3`, `/updates`)** | `SegmentedControl` (`All`, `Official 85%+`, `Social Pulse`, `Verify Link`), `InputGroup` + `TextInput`/`TextArea` (paste WhatsApp/Instagram/Reddit/X/YouTube URL), `ProgressBar` (`0-100%` Truth Score), `Collapsible` (4-factor breakdown), `Citation` (`.gov.in` links), `List`/`Item` feed rows | SSRF/phishing pre-check + 4-factor deterministic Truth Score (`Verified True` vs `Unverified Rumour`) + offline `1080x1080` Canvas PNG generator for 1-tap WhatsApp Group sharing |
| **6** | **Mandi & MSP Board with Personal Break-Even Bar (`Task 4`, `/mandi`)** | `Card` (Break-Even input strip with controlled `NumberInput`s for cost/yield/transport + `ProgressBar` margin visual), edge-to-edge `Table` (`tabular-nums` `.type-kpi-sm` APMC & e-NAM rows, MSP delta, `StatusDot` `SELL_NOW / HOLD / WATCH`) | Format all currency with `toLocaleString("en-IN")` (`₹2,340/q`); dense APMC comparisons render as `Table` rows, never nested cards |
| **7** | **Government Schemes, AgriStack & 72-Hr PMFBY Evidence Locker (`Task 5 & 6`, `/schemes`)** | `TabList` + `Tab` (`Income & Insurance`, `Water & Soil`, `AgriStack & Credit`, `72-Hr Loss Locker`), `NumberInput` + `SegmentedControl` (PMKSY `45%/55%` drip estimator), `CheckboxList` (11-digit Farmer ID checklist), `Timer` (live 72-hr countdown) | Offline-persisted checklists + GPS/sensor/photo PMFBY evidence packs stored in IndexedDB (`agritech-media`) without touching `localStorage` blob quotas |
| **8** | **Crop Photo Doctor (`Task 5 & 7`)** | `Dialog` (`CropDoctorModal` with `Layout`), `FileInput` + tactile `Button` (`Take Photo` `capture="environment"`, opt-in `LiveCameraModal`, `Upload`, desktop Drop/Paste), `Thumbnail` preview, `StatusDot` (`HEALTHY` / `NOT HEALTHY`), `List`/`Item` problems & per-acre medicine dosages, `Banner` (`<60%` KVK + `1800-180-1551`) | Works across Android/iOS, WhatsApp/Instagram WebViews, tablets, and laptops; compresses `<= 1568px` / `<= 1.5MB` JPEG into IndexedDB when offline |
| **9** | **Vernacular Voice Companion + FPO 1-to-50 Broadcast Center (`Task 7`)** | `BottomSheet` / `Drawer` (`VoiceCompanionDrawer`), `TextArea` (editable live transcript check before submit), `Card` + `Table`/`List` (`FpoBroadcastPanel` for 50 member parcels + anomaly `StatusDot` + 1-tap `Button` WhatsApp broadcast) | Farmer always sees and confirms what `gemini-3.5-transcribe` heard before executing; FPO coordinator generates one pooled morning briefing & water-saved summary |
| **10** | **Installable Offline-First PWA & Mobile 5-Tab Thumb Bar (`Task 1 & 8`)** | `Banner` (`OnlineStatusBanner` showing queued FieldShield count), `Button` / `BottomSheet` (`PWAInstallButton` for Android prompt + iOS Safari sheet), `MobileNav` (`Today`, `Mandi`, `Updates`, `Schemes`, `Camera/Voice`) + `SideNav` on desktop | Total sticky top header + `MobileNav` height stays `<= 15%` of `390x844` viewport with reserved bottom scroll padding and zero horizontal overflow at `390x844` & `1280x800` |

---

## 5. Tactile, Motion & Print Polish

- **Sizing & Radii (`AstryxProvider.tsx`):** `--size-element-sm: 36px`, `--size-element-md: 44px`, `--size-element-lg: 48px` (Simple Farmer Mode primary tiles override to `>= 52px`), `--radius-inner: 10px`, `--radius-element: 14px`, `--radius-container: 24px`, pill buttons `9999px`.
- **Metadata Hygiene:** Use `MetadataList` or inline `.type-caption` separated by `·` (`State Govt · 2h ago · Guntur`); never render rows of decorative colored pills.
- **Motion & Reduced-Motion:** Circular View Transitions theme toggle (`520ms`), `.surface-enter` (`340ms`), and Astryx `Drawer`/`BottomSheet` slide transitions all respect `@media (prefers-reduced-motion: reduce)`.
- **Print Readiness (`@media print`):** Hides `.no-print`, `MobileNav`, `SideNav`, and buttons while rendering Kisan Roznamcha, PMKSY subsidy sheets, and PMFBY evidence summaries in crisp `#111111` ink on `#FFFFFF`.
