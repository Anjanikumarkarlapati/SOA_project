# Google Auth Port & Page Responsibility Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port Supabase Google OAuth from the OneDrive Vite frontend into the Downloads Next.js 16 `frontend/` (`http://localhost:5000`), wire global OAuth token exchange (`POST /api/auth/google`) and login buttons on `/`, `/login`, and `/signup`, consolidate overlapping page sections (`/climate`, `/recommendations`, `/profile`), and sync `.agents/skills/agritech-frontend-craft/SKILL.md`.

**Architecture:** `AuthProvider.tsx` hosts a global `onSupabaseSignIn` subscription (both immediate `getSession()` and `onAuthStateChange("SIGNED_IN")`) so OAuth redirects landing on `/`, `/login`, or `/signup` dynamically exchange the Supabase access token for a Spring Boot `auth-service` JWT via `POST http://localhost:8080/api/auth/google`, strip the URL hash, persist the session in Zustand (`useAuthStore`), and navigate to `/dashboard`. Page boundaries keep `/climate` strictly for 14-day charts/data tables, `/recommendations` strictly for crop scoring and `FarmerRecommendationCard`, `/sensors` strictly for probes and `RootZoneSoilCard`, and `/profile` strictly for identity, capabilities, preferences, and outbox sync.

**Tech Stack:** Next.js 16.4.3, React 19, `@supabase/supabase-js`, `@astryxdesign/core`, Zustand, Spring Cloud Gateway (`:8080`) + `auth-service` (`:8081`), Vitest, Playwright.

**Spec:** Derived from `C:\Users\anjan\OneDrive\Documents\SOA-Hackthon\frontend\src\{supabase.js,session.jsx,pages/Login.jsx}` and `auth-service\src\main\java\com\agritech\auth\{AuthController.java,SupabaseVerifier.java}`.

## Global Constraints
- Preserve Area light (`#FFFFFF`, `#485C11`, `#DFECC6`, `#8E9C78`, `#E9E9E9`) and dark (`#0E110B`, `#151911`, `#9AB556`, `#242F18`) tokens and `Crimson Text` / `DM Sans` / `DM Mono` + 11 Indic script typography.
- Never hardcode `localhost:5173` or `localhost:3000` in OAuth redirects; use `window.location.origin`.
- Never log or print secret values (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, tokens, passwords) to stdout or commit `.env.local`.
- Maintain Zero-Humans Imagery Policy and Zero-Emoji Policy (`frontend/src/`).

## Review Focus
- OAuth implicit hash arrives after initial mount (`SIGNED_IN` fires on a subsequent tick) — verify `onSupabaseSignIn` handles both immediate `getSession()` and `onAuthStateChange` without double-exchanging.
- `buildUser` maps backend `displayName` to `AuthUser.name` so Google users greet properly on `/dashboard`.
- Clearing `#access_token=...` hash after exchange prevents stale hash loops on refresh.
- Existing `AuthProvider` and `LoginPage`/`SignupPage` Vitest tests continue passing when `NEXT_PUBLIC_SUPABASE_URL` is unset in test environments (`supabaseEnabled === false`).
- Removing duplicate sections from `/climate` and `/profile` preserves all required `tier1`–`tier4`, `masterpiece`, and `workspace-flows` E2E selectors.

---

### Task 1: Sync Supabase Environment & Install `@supabase/supabase-js`
**Files:**
- Modify: `frontend/.env.local` (add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from OneDrive `frontend/.env` without printing values)
- Create: `frontend/.env.example`
- Modify: `frontend/package.json`

- [ ] **Step 1:** Sync `VITE_SUPABASE_URL` -> `NEXT_PUBLIC_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY` into `frontend/.env.local`.
- [ ] **Step 2:** Create `frontend/.env.example` with blank placeholders.
- [ ] **Step 3:** Run `cd frontend; npm install @supabase/supabase-js` and confirm `@supabase/supabase-js` is in `frontend/package.json`.

### Task 2: TDD Red Phase — Write Failing Google Auth & Page Consolidation Tests
**Files:**
- Create: `frontend/src/lib/__tests__/supabase-google-auth.test.tsx`

- [ ] **Step 1:** Write tests covering `authApi.google`, `buildUser({ displayName })`, `supabase.ts` dynamic origin handling, `GoogleSignInButton` SVG rendering, `AuthProvider` `SIGNED_IN` exchange + redirect, and page boundary assertions (`/climate` excludes `RootZoneSoilCard` & `FarmerRecommendationCard`; `/profile` excludes `MicroservicesPipelineCard`).
- [ ] **Step 2:** Run `cd frontend; npx vitest run src/lib/__tests__/supabase-google-auth.test.tsx` — verify FAIL (RED).

### Task 3: Implement Supabase Client, API Endpoints, `AuthProvider` OAuth Listener, and `GoogleSignInButton`
**Files:**
- Create: `frontend/src/lib/supabase.ts`
- Create: `frontend/src/components/auth/GoogleSignInButton.tsx`
- Modify: `frontend/src/lib/api.ts` (`AuthResponse.displayName`, `authApi.google`, `authApi.refresh`)
- Modify: `frontend/src/lib/auth.ts` (`buildUser` `displayName` mapping)
- Modify: `frontend/src/components/providers/AuthProvider.tsx`

- [ ] **Step 1:** Implement `frontend/src/lib/supabase.ts` (`supabaseEnabled`, `startGoogleSignIn`, `onSupabaseSignIn`, `supabaseSignOut`).
- [ ] **Step 2:** Update `api.ts`, `auth.ts`, and `AuthProvider.tsx` (global `onSupabaseSignIn` listener, URL hash scrub, `/dashboard` redirect, `logout()` calling `supabaseSignOut()`).
- [ ] **Step 3:** Implement `GoogleSignInButton.tsx` (`data-testid="google-signin-button"`, crisp 4-color inline SVG).

### Task 4: Wire Google Sign-In into Home (`/`), Login (`/login`), Signup (`/signup`), and Consolidate Page Boundaries
**Files:**
- Modify: `frontend/src/app/page.tsx`
- Modify: `frontend/src/app/login/page.tsx`
- Modify: `frontend/src/app/signup/page.tsx`
- Modify: `frontend/src/app/climate/page.tsx`
- Modify: `frontend/src/app/recommendations/page.tsx`
- Modify: `frontend/src/app/profile/page.tsx`

- [ ] **Step 1:** Add `GoogleSignInButton` + error `Banner` to `/`, `/login`, and `/signup`.
- [ ] **Step 2:** Remove duplicate `RootZoneSoilCard` & `FarmerRecommendationCard` from `/climate/page.tsx` and duplicate `MicroservicesPipelineCard` from `/profile/page.tsx`, adding clean switcher links between `/climate` and `/recommendations`.
- [ ] **Step 3:** Run `cd frontend; npx vitest run src/lib/__tests__/supabase-google-auth.test.tsx` — verify PASS (GREEN).

### Task 5: Update Project Frontend Skill (`/writing-skills`)
**Files:**
- Modify: `.agents/skills/agritech-frontend-craft/SKILL.md`

- [ ] **Step 1:** Update `SKILL.md` with the Area palette, Astryx component rules, Zero-Emoji policy, Supabase Google OAuth -> Gateway `/api/auth/google` contract, and Page Responsibility Matrix.

### Task 6: Full End-to-End Verification & Memory Sync
- [ ] **Step 1:** Restart Next.js dev server (`:5000`) to pick up new `.env.local` Supabase vars.
- [ ] **Step 2:** Run `npx tsc --noEmit`, `npm test`, live `POST http://localhost:8080/api/auth/google` probe (`401`, not `503`), and `npx playwright test` (all 8 E2E specs).
- [ ] **Step 3:** Run `browser` subagent check on `/`, `/login`, `/signup`, `/climate`, `/recommendations`, update `working.md`, and run `graphify update .`.
