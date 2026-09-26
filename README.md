# AgriTech Sensing Solutions

Precision-agriculture platform built to `AGRITECH_PRD.md` and `AGRITECH_UI_UX.md`: soil telemetry
comes in from an IoT fleet, the crop service scores each field against its optimal envelope, and
the irrigation service opens and closes valves from that score.

Spring Cloud microservices behind an API gateway with Eureka service discovery, plus a React
operations dashboard.

---

## Architecture

```
                        +-------------------+
  Dashboard (5173) ---> |  API Gateway 8080 |  JWT validation, routing, rate limiting
                        +---------+---------+
                                  | lb:// (Eureka)
        +-------------+-----------+-----------+--------------+
        v             v                       v              v
  auth-service  sensor-service          crop-service   irrigation-service
      8081           8082                    8083             8084
                       ^                      |  ^              |
                       |                      |  |              |
                       +--- telemetry --------+  +-- health ----+
                       ^                                        |
                       +----------- valve state ----------------+

                     Eureka Server 8761  (all services register)
```

| Module | Port | Responsibility |
|--------|------|----------------|
| `eureka-server` | 8761 | Service registry, 30s health checks, 90s de-registration |
| `api-gateway` | 8080 | Single entry point: JWT validation, identity headers, rate limiting, CORS |
| `auth-service` | 8081 | Login, registration, 24h JWTs, refresh tokens, revocation list |
| `sensor-service` | 8082 | Device registry, telemetry ingestion and validation, historical queries |
| `crop-service` | 8083 | Health scoring, optimal-range evaluation, recommendations, forecasts |
| `irrigation-service` | 8084 | Schedules, valve control, moisture cut-out, emergency stop |
| `common` | - | Shared error envelope and caller-identity helpers |
| `web` | 3000 | Next.js dashboard (current) |
| `frontend` | 5173 | Vite dashboard (legacy, kept until the swap is signed off) |

**Security model.** The gateway is the only component that parses a JWT. It strips any
client-supplied `X-User-*` headers and sets its own from the verified token, so a downstream
service can trust `X-User-Role` without re-validating. Inter-service calls go direct through
Eureka and never traverse the gateway.

---

## Running it

Requires JDK 21+ and Node 20+. No global Maven needed - the wrapper is committed.

First, set the JWT signing secret. There is no default: auth-service signs tokens with it and the
gateway verifies them, so a committed fallback would be a published signing key, and both
services refuse to start without one.

```bash
export AGRITECH_JWT_SECRET=$(openssl rand -base64 48)
```

Google sign-in additionally needs `SUPABASE_URL` and `SUPABASE_ANON_KEY` exported for
auth-service, and `frontend/.env` filled in from `frontend/.env.example`. Both are optional - the
password login works without them, and the Google button hides itself when unconfigured.

```bash
./scripts/stack.ps1 start
```

That builds every module and launches the six services in dependency order, waiting for each to
report healthy. Then start the dashboard:

```bash
npm install --prefix web
npm run dev --prefix web
```

- Dashboard: http://localhost:3000
- API gateway: http://localhost:8080
- Eureka: http://localhost:8761

The Vite app in `frontend/` still runs (`npm run dev --prefix frontend`, port 5173) and talks to
the same gateway. It is kept only so the two can be compared side by side; delete it once the
Next app is signed off.

Other actions: `./scripts/stack.ps1 status`, `stop`, `restart`. Logs land in `.run/`.

Give the services ~30 seconds after startup before the first cross-service call: that is Eureka's
registry fetch interval, and until it completes the gateway has no route targets.

### Demo accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@agritech.io` | `admin1234` | ADMIN - full sensor, schedule and valve control |
| `farmer@agritech.io` | `farmer1234` | FARMER - read-only telemetry and crop health |

The dashboard never asks which role you are; nav and controls are filtered from the role inside
the issued token.

### Seeded data

`sensor-service` seeds a 13-device pilot farm across four fields and backfills 48 hours of
telemetry, then keeps emitting readings every 30 seconds. One device is deliberately left dark so
the offline state is visible, and one field starts dry so the critical-alert path is exercised.
Set `SIMULATOR_ENABLED=false` to run against real devices instead - they post to
`POST /api/telemetry/ingest`, which is the actual contract.

---

## Tests

```bash
./mvnw test              # unit tests
bash scripts/smoke-test.sh   # end-to-end against a running stack
```

The smoke test covers the PRD's section 9.3 scenarios: unauthenticated rejection, login for both
roles, forged-token rejection, farmer/admin authorization split, device registration, telemetry
ingestion including out-of-range rejection, health scoring from live telemetry, cross-service
trend retrieval through Eureka, manual valve control, emergency stop, schedule CRUD, and logout
revocation taking effect at the gateway.

---

## API

All paths are relative to the gateway (`http://localhost:8080`). Everything except
`/api/auth/login`, `/api/auth/register` and `/api/auth/refresh` needs `Authorization: Bearer <jwt>`.

### Auth
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | Returns access token, refresh token, role, farm |
| POST | `/api/auth/register` | ADMIN or FARMER |
| POST | `/api/auth/refresh` | Exchanges a refresh token for a new pair |
| POST | `/api/auth/logout` | Revokes the access token id and the refresh token |
| GET | `/api/auth/me` | Decoded claims |

### Sensors and telemetry
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/sensors/register` | Admin only |
| GET | `/api/sensors` | Paginated; `page`, `size`, `q`, `health`, `fieldId` |
| GET/PUT/DELETE | `/api/sensors/{deviceId}` | PUT and DELETE are admin only |
| GET | `/api/sensors/summary` | Online / offline / low-battery counts |
| POST | `/api/telemetry/ingest` | Bulk; each reading validated independently |
| GET | `/api/telemetry/{deviceId}` | `range` = 1h, 24h, 7d, 30d, 90d |
| GET | `/api/telemetry/field/{fieldId}/latest` | Averaged rollup used by crop-service |
| GET | `/api/telemetry/field/{fieldId}/series` | Bucketed series for charts |
| GET | `/api/telemetry/stats` | Ingestion volume |

### Crops
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/crops` | Every field with its latest health snapshot |
| GET | `/api/crops/{cropId}/health` | Current score, computed on demand if stale |
| GET | `/api/crops/{cropId}/metrics` | Environment series, health trend, optimal bands |
| POST | `/api/crops/analyze` | Manual analysis; body `{"cropId": "..."}` or empty for all |
| GET | `/api/crops/alerts` | Fields outside their optimal envelope |
| GET | `/api/crops/summary` | Share of fields at optimal |

### Irrigation
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/irrigation/schedules` | POST is admin only |
| GET/PUT/DELETE | `/api/irrigation/schedules/{id}` | Admin only for writes |
| PATCH | `/api/irrigation/schedules/{id}/active` | The list's on/off toggle |
| GET | `/api/irrigation/events` | Valve activity for the alert feed |
| GET | `/api/valves` | All zones with live state |
| POST | `/api/valves/{id}/open` | `durationMinutes` 1-240; admin only |
| POST | `/api/valves/{id}/close` | Admin only |
| POST | `/api/valves/emergency-stop` | Closes every open valve |

Errors use one envelope everywhere, per PRD 7.3:

```json
{ "error": "validation_error", "message": "soilMoisture out of range (0-100)", "timestamp": "..." }
```

---

## How the automation actually works

**Health score.** Each of soil moisture, temperature and pH scores 100 inside the crop's optimal
band and loses points in proportion to how far outside it sits, measured in band widths. The three
are weighted 50/30/20 toward moisture. A drift up to 35% of a band width outside is a warning;
beyond that is critical. See `HealthScore.java` and its tests.

**Irrigation forecast.** Moisture slope over the last six hours is extrapolated to the moment it
would cross below the optimal floor. Only forecasts inside the PRD's 48-hour horizon are reported;
past that the extrapolation is noise.

**Water saving.** Every schedule defaults to `skipIfMoist`: before opening, the irrigation service
asks crop-service for the field's health and skips the run if moisture is already at or above the
optimal ceiling. A running zone that reaches that ceiling shuts itself off mid-run.

**Closed loop in the demo.** Opening a valve tells sensor-service which field is being watered, so
simulated soil moisture climbs while the valve is open and the health score recovers. That path
exists only for the simulator; real deployments learn it from the sensors.

---

## Frontend stack

`web/` is Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn, replacing the Vite SPA.

Everything is client-rendered behind the auth guard: the dashboard polls live telemetry, so there
is nothing meaningful to server-render. Next earns its place here for file-based routing, route
level code-splitting and `next/font`, not for SSR.

| Concern | How it works |
|---------|--------------|
| API access | `next.config.ts` rewrites `/api/*` to the gateway, so the browser sees one origin and no CORS preflight. Override with `GATEWAY_URL`. |
| Auth | JWT in `localStorage`, restored in an effect. `SessionProvider` exposes `ready` so a refresh does not bounce a signed-in user to `/login` mid-hydration. |
| Theme | An inline script in `<head>` applies the stored theme before first paint, so dark-mode users get no white flash. |
| Charts | Recharts is `dynamic(..., { ssr: false })` per screen, keeping it out of the login and shell bundles. |
| Route params | Next 16 delivers `params` as a Promise; the `[cropId]` and `[deviceId]` pages await it. |

Three components come from the VengeanceUI registry via `npx shadcn add`:
`spotlight-navbar` (primary navigation), `gooey-search` (jump to a page or field), and
`agent-bento-grid`, whose tile shape the dashboard's `BentoCard` is built on.

The design tokens carried over verbatim and drive both our components and anything pulled from a
registry, because `globals.css` maps shadcn's semantic variables (`--primary`, `--card`,
`--border`) onto the AgriTech palette. The contrast audit was re-run after the port and matches
the Vite app exactly: every foreground/background pair clears WCAG AA in both themes, worst case
4.63:1.

---

## Design system notes

The dashboard implements `AGRITECH_UI_UX.md`: its tokens, its status encoding (colour plus shape
plus label), its 8px radius scale, its responsive breakpoints, and full dark mode. Icons come from
Phosphor at the brief's 1.5px/20px spec rather than hand-drawn paths, and Inter plus IBM Plex Mono
are self-hosted so the interface renders without a font-CDN round trip.

Two brief values were changed, both because the same brief requires WCAG AA on every status
indicator and its literal hex could not reach it:

| Token | Brief | Shipped | Reason |
|-------|-------|---------|--------|
| `--status-warning` (light) | `#B8860B` | `#8F6708` | 3.05:1 on the light surface; darkened in the same hue to 4.79:1 |
| `--status-muted` (light/dark) | not specified | `#646E62` / `#95A190` | first pick failed AA at 3.15:1 and 4.01:1 |

Every foreground/background pair in the shipped palette now clears 4.5:1 in both themes, worst
case 4.63:1. The chart library is code-split, so signing in and the dashboard load 249 kB of
JavaScript instead of 672 kB.

---

## Deliberate simplifications

These are the corners this build cuts, and what replaces each when it stops being enough. They are
also marked with `ponytail:` comments at the relevant code.

| Simplification | Ceiling | Upgrade |
|----------------|---------|---------|
| H2 in-memory per service | Data is lost on restart | Point `spring.datasource.*` at PostgreSQL; TimescaleDB for the telemetry table |
| In-memory rate-limit counters | N gateway replicas allow N times the quota | Spring Cloud Gateway's Redis rate limiter |
| Revocation list polled every 15s | A logged-out token works for up to 15 more seconds | Shared Redis revocation set |
| Refresh tokens in memory | Restart logs everyone out | Move `TokenStore` to Redis or the database |
| Try/catch fallbacks on inter-service calls | No circuit breaking, just short timeouts | `spring-cloud-starter-circuitbreaker-resilience4j` |
| Device simulator inside sensor-service | Not a real protocol adapter | Delete it; devices already post to the same ingest endpoint |
| No message queue | Health analysis is a 5-minute poll, not event-driven | Kafka between ingestion and analysis |

Not built, per the PRD's own scope: Kubernetes manifests, ELK, Prometheus dashboards, and the
Phase 2+ items in section 16.

# SOA_project
