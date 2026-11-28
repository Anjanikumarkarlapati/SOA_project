# AGENTS.md

Operational manual for AI coding agents working in `SOA-Hackthon` (AgriTech FieldShield & Daily Kisan Companion).

## 1. Quickstart, Astryx CLI & Verification Commands

Run all frontend commands from `frontend/` (`Next.js 16.4.6`, `React 19.3.0`, `@astryxdesign/core@0.7.17`, `Tailwind CSS 4`, port `5000`):

```powershell
cd frontend
npx astryx search "<query>"         # 1. Search @astryxdesign/core components & templates first
npx astryx build "<feature>"        # 2. Get recommended Astryx page/block frame
npx astryx component <Name>         # 3. Inspect exact component props BEFORE coding (never invent props)
npm run dev                         # Start dev server on http://localhost:5000
npx tsc --noEmit                    # Typecheck (must exit 0)
npm run lint                        # ESLint (0 errors required)
npx vitest run                      # Unit tests (Vitest + Testing Library)
npm run build                       # Production Next.js build check
npx playwright test                 # E2E suite (390x844 mobile & 1280x800 desktop)
```

Read-only backend health checks (`Spring Cloud Gateway :8080`, `Eureka :8761`):

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8761/actuator/health
```

## 2. Hub-and-Spoke Documentation Map

| Document | Purpose |
|---|---|
| [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Mandatory `/astryx` 8 rules, Area Editorial Botanical tokens, 11 Indic scripts, and **10-Feature Astryx Component Blueprint** |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full-stack topology, Graphify `786`-node AST map, `LIVE` vs. `SCOPED (v3)` 10-feature architecture, media/offline flows, security |
| [PRD.md](./PRD.md) | Personas, `LIVE` baseline, all 10 Daily Kisan Companion features, non-goals, and release gates |
| [frontend/AGENTS.md](./frontend/AGENTS.md) | Auto-generated Next.js 16 breaking-change notice (`nextjs-agent-rules`); **never delete** |
| [universal-image-capture](./.agents/skills/universal-image-capture/SKILL.md) | Cross-device camera (`capture="environment"` + zero-constraint `getUserMedia`), EXIF compression, IndexedDB blob store |
| [2026-11-28-agritech-daily-kisan-companion.md](./docs/superpowers/plans/2026-11-28-agritech-daily-kisan-companion.md) | Master TDD implementation plan (`Tasks 1-8`) covering all 10 companion features |

## 3. Graphify AST & Memory Workflow

1. **Query Graph First:** Query `graphify-out/graph.json` (`786` nodes, `1,762` edges, `145` communities) via `graphify` MCP (`query_graph`, `god_nodes`, `get_node`) before broad searches.
2. **Grep Callers on God Nodes:** `useFarmStore` (`43` edges, `property-store.ts`), `isOfflineToken()` (`33`, `api.ts`), `AppLayout()` (`32`, `AppLayout.tsx`), `useAuthStore` (`30`, `auth.ts`), `Button()` (`28`, `ui/Button.tsx`), `BezelCard()` (`24`, `ui/BezelCard.tsx`), `getActiveProperty()` (`20`, `property-store.ts`).
3. **Bounded Reads (`>150` lines):** Use `claude-mem` `smart_outline`/`smart_unfold` or narrow line slices on `i18n.tsx`, `property-store.ts`, `api.ts`, `FarmerRecommendationCard.tsx`, and `FarmMap.tsx`.
4. **Post-Task Sync:** Run `graphify update .`, `graphify save-result`, and `graphify reflect` from repo root, and update local `working.md` (never commit `working.md` or `graphify-out/`).

## 4. Astryx Frontend Rules & 10-Feature Contract

- **Use `@astryxdesign/core` Primitives First:** Build frames with `Layout`, `Section`, `Stack`, `Grid`; dense data (`MandiBoard`, `Roznamcha`, `StateAgriPulse`, `FpoBroadcastPanel`) as edge-to-edge `Table` or `List`/`Item` rows (never nested card-soup); focal widgets as `Card`/`BezelCard`/`ClickableCard`.
- **Exact Feature Primitives (See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) §4):**
  1. **Simple Farmer Mode + Location Cascade (`Task 1 & 2`):** `SegmentedControl` (`simple | full`), 3x controlled `Selector` (`State -> District -> Mandal`), `>=52px` `ClickableCard` tiles.
  2. **Deterministic 6 AM Action Card (`Task 2`):** `Card`/`BezelCard`, `StatusDot` + explicit `SAFE/CAUTION/HOLD` Spray-Safe Clock, `Button` (`Listen` via `gemini-3.8-flash-lite-tts` + Web Speech fallback).
  3. **Kisan Roznamcha (`Task 2`):** `Drawer` (desktop) / `BottomSheet` (touch) + `List`/`Item`/`Timestamp` + `@media print` PDF/WhatsApp digest.
  4. **"Kyun?" Dialect Explanations (`Task 2`):** `Collapsible`/`ToggleButton` revealing 2 sensor-cited sentences (`fieldshield.ts`) in the active Indic script.
  5. **State Agri-Pulse & Custom Link Truth Shield (`/updates`, `Task 3`):** `SegmentedControl`, `InputGroup`+`TextInput`, `ProgressBar` (`0-100%` 4-factor Truth Score), `Citation` (`.gov.in`), and `1080x1080` Canvas PNG report for WhatsApp groups.
  6. **Mandi & MSP Board (`/mandi`, `Task 4`):** Controlled `NumberInput` Personal Break-Even Cost Bar + edge-to-edge `Table` (`en-IN` `₹/quintal` profit after transport).
  7. **Govt Schemes, AgriStack & 72-Hr PMFBY Locker (`/schemes`, `Task 5 & 6`):** `TabList`/`Tab`, PMKSY `45%/55%` estimator, `CheckboxList` (11-digit Farmer ID), live `Timer` (72-hr GPS+photo locker).
  8. **Crop Photo Doctor (`Task 5 & 7`):** `Dialog` + `FileInput` (`capture="environment"`, zero-constraint `LiveCameraModal`, gallery, drop/paste) -> `/api/ai/diagnose` (`gemini-3.8-flash` + `responseSchema`) or IndexedDB queue.
  9. **Vernacular Voice + FPO 1-to-50 Broadcast (`Task 7`):** `BottomSheet`/`Drawer` with editable `TextArea` transcript check (`/api/ai/transcribe` via `gemini-3.5-transcribe`) + FPO 50-parcel WhatsApp broadcast panel.
  10. **Offline-First PWA & Mobile 5-Tab Thumb Bar (`Task 1 & 8`):** `@serwist/next` SW, `Banner` (`OnlineStatusBanner`), `MobileNav` (`Today`, `Mandi`, `Updates`, `Schemes`, `Camera/Voice`, `<=15%` viewport chrome), 11-locale parity.
- **Tokens & Anti-Slop:** Use semantic CSS/Astryx variables (`globals.css`, `AstryxProvider.tsx`; ignore legacy `#FDFBD4` in `AgriTech-Frontend-Design-Rules.txt`), controlled inputs (`value`+`onChange`), `LinkProvider` routing, `StatusDot` + text (no color-only status, no decorative `Badge` stacks, separate metadata with `·`), and `toLocaleString("en-IN")`.

## 5. Non-Negotiable Security, AI & Data Guardrails

- **Backend Isolation & Secrets:** Zero edits to Java/Spring Boot or `docker-compose.yml`. Read `GEMINI_API_KEY` strictly server-side in `frontend/src/app/api/*` (never `NEXT_PUBLIC_*`). Use `@google/genai >= 2.29.1` with current verified models (`gemini-3.8-flash`, `gemini-3.5-transcribe`, `gemini-3.8-flash-lite-tts` — never deprecated `2.5`/`2.0`/`1.5` stubs).
- **IndexedDB Media & Headers:** Store image `Blob`s only in IndexedDB (`agritech-media`), keeping `mediaId` pointers in `syncOutbox`. Set `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)` and CSP `media-src 'self' blob:` in `frontend/next.config.ts`.
- **SSRF, Uploads & Logout Purge:** Block non-HTTP(S) and private/loopback IPs in `/api/state-pulse/verify`; enforce `<=4 MB` and `sniffImageMime` magic bytes in `/api/ai/diagnose`; return `503 ai_unavailable` honestly without faking results; purge IndexedDB `agritech-media`, Roznamcha, PMFBY, and `syncOutbox` in `clearSessionData()`.
