# CLAUDE.md — AgriTech Sensing Solutions

Rules for working in this codebase, with a focus on integrating Figma designs through the
Figma MCP server.

Read this before touching `frontend/`. The conventions below are not aspirational — they
describe what the code actually does today, with file paths and line references.

---

## 0. Orientation

Spring Cloud microservices behind an API gateway, plus a React operations dashboard.

| Path | What it is |
|------|------------|
| `frontend/` | Vite + React 18 dashboard (the only UI) |
| `api-gateway/`, `auth-service/`, `sensor-service/`, `crop-service/`, `irrigation-service/` | Spring Boot 3.3 services |
| `eureka-server/` | Service registry |
| `common/` | Shared error envelope, caller-identity helpers |

The dashboard talks **only** to the gateway on `:8080`, proxied in dev by
`frontend/vite.config.js`. Never add a `fetch` to a service port directly.

---

## 1. Token Definitions

### Where

**One place:** `frontend/src/styles.css`, as CSS custom properties on `:root` (lines 3–34),
with a dark override on `[data-theme='dark']` (lines 36–58).

There is **no** JS/JSON token layer, no Style Dictionary, no Tailwind config, and no token
transformation pipeline. A token is a CSS variable and nothing else.

```css
/* frontend/src/styles.css:3 */
:root {
  --bg-base: #f7f8f6;
  --bg-surface: #ffffff;
  --bg-raised: #fbfcfa;
  --text-primary: #1b1f1a;
  --text-secondary: #5c6659;
  --border: #e1e5dd;
  --accent: #2f6b3c;
  --accent-wash: #eaf1eb;
  --accent-rgb: 47, 107, 60;   /* for rgba() composition */

  --status-good: #2e7d32;
  --status-warning: #8f6708;
  --status-critical: #b3261e;
  --status-info: #3b6e91;
  --status-muted: #646e62;

  --radius: 8px;
  --sidebar-width: 232px;

  --font-ui: 'Inter Variable', 'Inter', system-ui, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SF Mono', ui-monospace, monospace;
}
```

### Rules when importing tokens from Figma

1. **Every new color becomes a variable in both themes.** A hex literal in a rule body is a
   bug. If you add `--surface-sunken` to `:root`, you add it to `[data-theme='dark']` in the
   same edit or dark mode silently breaks.
2. **Pair every color with an `-rgb` triplet if it needs alpha.** The codebase composes
   translucency as `rgba(var(--accent-rgb), 0.14)` (see `styles.css:136`), because CSS
   variables can't be alpha-adjusted directly.
3. **Contrast overrides the design file.** There is precedent at `styles.css:19`: the brief
   specified `#B8860B`, which measured 3.05:1 on the near-white surface, so it was darkened
   to `#8f6708` to clear 4.5:1 — and the reasoning was left in a comment. Do the same. When
   a Figma token fails WCAG AA on the surface it lands on, adjust it and **document why
   inline**. Do not silently ship the failing value, and do not silently "fix" it either.
4. Use `mcp__Figma__get_variable_defs` to pull the design file's variables rather than
   eyeballing hex values off a screenshot.

### Spacing and type

Spacing is **not** tokenized — it is literal `px`/`rem` in rules. Don't introduce a spacing
scale unless you convert existing usages; a half-migrated scale is worse than none. Base
type is 14px/1.5 on `body` (`styles.css:70`).

---

## 2. Component Library

### Where

| File | Contains |
|------|----------|
| `frontend/src/components.jsx` | Shared primitives: `Status`, `Toggle`, `RangeTabs`, `Empty`, `Loading`, plus `relativeTime`/`clockTime`/`formatDuration` |
| `frontend/src/Layout.jsx` | The authenticated app shell: sidebar nav, topbar, theme toggle, user chip |
| `frontend/src/pages/*.jsx` | One file per route; screen-local components live inline at the bottom of their page file |
| `frontend/src/icons.jsx` | The icon set (see §5) |

### Architecture

Plain function components, named exports, no default export except pages. **No TypeScript**
— this is `.jsx` with no prop types and no runtime validation. Match that; do not introduce
TS or PropTypes in a single file.

**No Storybook, no component docs site.** The pages are the usage reference.

### The one pattern you must not break: status encoding

Status is never communicated by color alone — every state carries a **color + icon shape +
text label**, driven by one map:

```jsx
/* frontend/src/components.jsx:29 */
const STATUS_MAP = {
  OPTIMAL:  { tone: 'good',     label: 'Optimal',           Icon: IconGood },
  WARNING:  { tone: 'warning',  label: 'Attention needed',  Icon: IconWarning },
  CRITICAL: { tone: 'critical', label: 'Critical',          Icon: IconCritical },
  OFFLINE:  { tone: 'critical', label: 'Offline',           Icon: IconOffline },
  // ...
}

export function Status({ value, label, className = '' }) {
  const entry = STATUS_MAP[value] || STATUS_MAP.NO_DATA
  return (
    <span className={`status status-${entry.tone} ${className}`}>
      <entry.Icon />
      {label ?? entry.label}
    </span>
  )
}
```

A new state goes in `STATUS_MAP` — never as a one-off colored `<span>` in a page. Charts get
their color through `statusColor(value)`, which resolves to `var(--status-*)`, so status
color stays in one place across CSS and JS.

### Loading states

`Loading` takes a `variant` (`rows` | `stats` | `cards` | `detail`) and each variant mirrors
the geometry of the real content so nothing reflows on data arrival (`components.jsx:107`).
If you add a screen with a new layout, add a matching variant rather than reusing a
mismatched one.

---

## 3. Frameworks & Libraries

```json
/* frontend/package.json */
"dependencies": {
  "@fontsource-variable/inter": "^5.3.0",
  "@fontsource/ibm-plex-mono": "^5.3.0",
  "@phosphor-icons/react": "^2.1.10",
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "^6.26.2",
  "recharts": "^2.12.7"
}
```

- **UI:** React 18.3, function components + hooks only.
- **Routing:** react-router-dom 6, declarative `<Routes>` in `frontend/src/App.jsx`.
- **Charts:** Recharts.
- **Styling:** plain CSS. **No Tailwind, no CSS-in-JS, no Sass, no CSS Modules.**
- **Build:** Vite 5 with `@vitejs/plugin-react`.

**Do not add a styling library when implementing a Figma design.** The correct move is new
CSS variables and new rules in `styles.css`. Adding Tailwind to match a Figma export would
fork the design system in two.

### Code splitting

Recharts is most of the bundle, so the three chart-heavy screens are lazy (`App.jsx:12`):

```jsx
const SensorDetail = lazy(() => import('./pages/SensorDetail'))
const Crops        = lazy(() => import('./pages/Crops'))
const CropDetail   = lazy(() => import('./pages/CropDetail'))
```

Keep the login and dashboard paths free of heavy imports.

---

## 4. Asset Management

**Current state: there are no image assets in this repo.** No `frontend/public/` directory,
no `src/assets/`, zero `.png`/`.jpg`/`.svg` files. All visuals today are CSS gradients, the
Phosphor icon set, and Recharts output.

This is the area a Figma design most often changes, so:

### Rules for adding assets

1. **Static, never-hashed files** (favicon, `og:image`) → create `frontend/public/` and
   reference them as absolute paths (`/og.png`). Vite copies `public/` verbatim.
2. **Everything else** → `frontend/src/assets/` and **import it**, so Vite fingerprints and
   cache-busts it:
   ```jsx
   import heroField from '../assets/hero-field.jpg'
   <img src={heroField} alt="" width={1600} height={900} />
   ```
3. **Pull assets through MCP, don't screenshot them.** `mcp__Figma__get_design_context`
   returns download URLs for referenced assets; `mcp__Figma__download_assets` fetches them.
   Re-encoding a screenshot loses quality and the correct dimensions.
4. **Optimize before committing.** There is no image pipeline in this build — what you
   commit is what ships. Prefer `.webp`, keep hero imagery under ~200KB, and always set
   explicit `width`/`height` to prevent layout shift.
5. **Decorative images get `alt=""`** plus `aria-hidden="true"` where appropriate. This
   codebase is consistent about this (`Layout.jsx:53`, `Login.jsx:24`) — keep it.
6. **No CDN is configured** and there is no image host. Everything is bundle-local and
   served by Vite/whatever serves `dist/`.

### Fonts are self-hosted on purpose

```jsx
/* frontend/src/main.jsx:6 — comment preserved from the original */
// Self-hosted so the dashboard renders without a round trip to a font CDN. Field tablets on
// a patchy connection get the interface immediately instead of a flash of fallback type.
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
```

**Do not replace these with a Google Fonts `<link>`.** If a Figma design calls for a new
typeface, add the corresponding `@fontsource` package and import it here. If no `@fontsource`
package exists, self-host the `woff2` under `src/assets/fonts/` with an `@font-face` block
and `font-display: swap`.

---

## 5. Icon System

**Source:** `@phosphor-icons/react`, re-exported under app-level names in
`frontend/src/icons.jsx`.

```jsx
/* frontend/src/icons.jsx */
import { Broadcast, Drop, Plant, SquaresFour, Warning } from '@phosphor-icons/react'
```

### Conventions

- **Pages name the concept, not the glyph.** Screens import `IconSensor`, `IconValve`,
  `IconCritical` — never `Broadcast` or `Drop` directly. `icons.jsx` owns which glyph
  represents which concept, so a glyph swap is a one-line change in one file.
- **Naming:** `Icon` + PascalCase concept (`IconSensor`, `IconCrop`, `IconLowBattery`).
- **Weight is standardized globally:** `regular` for interface glyphs, `fill` only where a
  solid shape is required (the healthy status dot).
- **Sized on a 20px interface grid**, 1.5px stroke. Pass explicit `width`/`height` for
  off-grid uses (`<IconCrop width={18} height={18} />`).

**When a Figma design uses a different icon set:** prefer remapping to the nearest Phosphor
glyph inside `icons.jsx`. Only export custom SVG from Figma when Phosphor genuinely lacks the
concept — and then inline it as a component in `icons.jsx` using `currentColor` for fill or
stroke, so it inherits theme color like every other icon.

---

## 6. Styling Approach

### Methodology

A **single global stylesheet**, `frontend/src/styles.css` (~1,670 lines), imported once in
`main.jsx`. Flat, semantic, lowercase-hyphenated class names — `.card`, `.nav-item`,
`.stat-strip`, `.status-good`, `.auth-card`. Loosely BEM-ish, not strict BEM. No CSS Modules,
no scoping, no utility classes.

The file is organized in commented sections; **add new rules to the matching section, not the
bottom**:

```
:root / [data-theme='dark']  tokens          line   3
App shell                                    line 111
Primitives                                   line 337
Status encoding                              line 542
Stat strip                                   line 590
Tables                                       line 643
Dashboard                                    line 715
Crop cards                                   line 816
Tabs / Toggle / Valve cards                  line 867+
Auth (login / create account)                line 1015
Empty / loading states                       line 1439
Responsive                                   line 1519
```

Inline `style={{}}` is used only for skeleton dimensions and one-off font weights. Keep it
that way — layout and color belong in the stylesheet.

### Theming

Light/dark via a `data-theme` attribute on the root element, driven by `useTheme()` in
`frontend/src/session.jsx`. Because every surface reads a variable, **no component knows
which theme is active.** Preserve this: a component that branches on theme in JS is a
regression.

### Responsive

Mobile-last, `max-width` breakpoints:

| Breakpoint | Effect |
|------------|--------|
| `1023px` | Sidebar collapses to a 64px icon rail (`--rail-width`) |
| `900px` / `767px` | Auth split-panel and grids stack |
| `480px` | Tightest phone layout |

### Accessibility — non-negotiable, this codebase already does it

- `@media (prefers-reduced-motion: reduce)` collapses CSS transitions (`styles.css:1429`,
  `1666`). Recharts animates in **JS**, so it's handled separately via
  `usePrefersReducedMotion()` (`components.jsx:8`) — remember this for any new animated chart.
- `@media (prefers-reduced-transparency: reduce)` drops the glass/blur effects
  (`styles.css:1112`).
- Visible focus rings: `outline: 2px solid var(--accent)` (`styles.css:97`).
- Semantic roles throughout: `role="switch"` + `aria-checked` on `Toggle`,
  `aria-pressed` on `RangeTabs`, `role="alert"` on form banners, `aria-invalid` +
  `aria-describedby` on invalid fields (`Login.jsx:140`).

**A Figma design will not tell you any of this.** Porting a design means re-implementing
these behaviors on the new markup, not dropping them.

---

## 7. Project Structure

```
frontend/src/
├── main.jsx          entry: fonts, providers, router mount
├── App.jsx           route table + auth gate + lazy boundaries
├── Layout.jsx        authenticated shell (sidebar, topbar)
├── session.jsx       SessionProvider, useSession, useTheme, usePolling
├── api.js            every backend call, one method per endpoint
├── components.jsx    shared primitives
├── icons.jsx         icon set
├── styles.css        the entire design system
└── pages/
    ├── Login.jsx     sign-in + create-account (unauthenticated)
    ├── Dashboard.jsx
    ├── Sensors.jsx   / SensorDetail.jsx
    ├── Crops.jsx     / CropDetail.jsx
    └── Irrigation.jsx
```

**Pattern: flat infrastructure at `src/` root, one file per route in `pages/`.** There is no
`features/` or per-component-folder structure. A screen-specific subcomponent lives at the
bottom of its own page file (see `Feature` in `Login.jsx:74`). Promote to `components.jsx`
only on the second use.

### Data flow

All network access goes through `api.js`, which centralizes the `/api` prefix, bearer token
header, and error envelope:

```js
/* frontend/src/api.js:29 */
async function request(method, path, { body, token } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`/api${path}`, { method, headers, /* ... */ })
  if (!response.ok) throw new ApiError(response.status, payload?.error, payload?.message)
  return payload
}
```

Screens fetch via `usePolling(loader, deps, intervalMs = 15000)` from `session.jsx` — a
fetch-on-mount + interval refresh returning `{ data, error, loading }`. Use it; don't write a
bare `useEffect` + `fetch`.

### Authorization

Role comes **from the JWT the server issued**, never from client state:

```jsx
/* frontend/src/session.jsx:35 */
isAdmin: session?.role === 'ADMIN',
```

`isAdmin` gates *visibility* only. The gateway and services enforce the real rule — never
treat a hidden button as a security control.

---

## 8. Figma MCP workflow for this repo

1. **Duplicate community files first.** A `figma.com/community/file/<id>` URL has no file
   key and the MCP tools cannot read it. Duplicate into your drafts and use the resulting
   `figma.com/design/<key>/<name>?node-id=1-2` URL. Files you only have *view* access to
   fail with "you don't have edit access" — that includes `/site/` URLs for community
   templates.
2. `get_variable_defs` → map to CSS variables in `:root` **and** `[data-theme='dark']`.
3. `get_design_context` on the specific node → adapt, don't paste. The returned code is
   generic React/CSS that knows nothing about `.card`, `Status`, or `usePolling`.
4. `download_assets` → `frontend/src/assets/`, optimized, with explicit dimensions.
5. Check contrast on every status and text color against **both** themes before shipping.
6. `npm run build --prefix frontend` must pass before commit.

### Density warning

The project is an **operations dashboard** — dense tables, live telemetry, 13 devices,
48-hour trend charts. Most Figma templates (including the marketing/product-launch designs
referenced for this project) are **landing pages** with large display type and generous
whitespace. Adopt such a design's *visual language* — palette, typeface, nav treatment,
button and card shapes, imagery — but keep dashboard-appropriate density. Transplanting
landing-page spacing onto the telemetry screens will push a four-field table below the fold.

---

## 9. Backend & verification

- Build everything: `sh ./mvnw -B -DskipTests package` (the wrapper is committed).
- Unit tests: `sh ./mvnw test`.
- End-to-end: start the six services, then `bash scripts/smoke-test.sh` — 18 checks covering
  auth, role split, telemetry validation, cross-service health scoring, valve control and
  logout revocation.
- `scripts/stack.ps1` is **PowerShell only**; on Linux/macOS launch the jars directly:
  ```bash
  for m in eureka-server api-gateway auth-service sensor-service crop-service irrigation-service; do
    nohup java -jar $m/target/$m-1.0.0.jar > .run/$m.log 2>&1 &
  done
  ```
  Allow ~30s for Eureka registration before the first cross-service call.

### Authentication — read before changing it

Auth is **Spring Boot + JWT**, implemented in `auth-service/`: email/password login issuing
24h HS256 tokens, refresh tokens, and a revocation list the gateway consults. The gateway is
the only component that parses a JWT; it strips client-supplied `X-User-*` headers and sets
its own from the verified token.

**There is no Supabase in this project, and no Google/OAuth/OIDC of any kind** — a grep for
`google`, `oauth`, `oidc` and `supabase` across the repo returns zero hits. If third-party
auth is wanted, it is new work: it must mint *this system's* JWT after verifying the external
identity, so the gateway's trust model and the `X-User-Role` contract keep working.
Introducing Supabase as a parallel auth path would bypass that model — don't do it without an
explicit decision.
