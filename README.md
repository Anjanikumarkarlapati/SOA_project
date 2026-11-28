# AgriTech Sensing Solutions

Precision-agriculture platform built to [`docs/AGRITECH_PRD.md`](docs/AGRITECH_PRD.md) (requirements,
NFR targets, threat model and traceability matrix): soil telemetry
comes in from an IoT fleet, the crop service scores each field against its optimal envelope, and
the irrigation service opens and closes valves from that score.

Spring Cloud microservices behind an API gateway with Eureka service discovery, plus React/Next.js
operations dashboards.

---

## Architecture

```
                        +-------------------+
  Dashboards (5173/3000)|  API Gateway 8080 |  JWT validation, routing, rate limiting
                        +---------+---------+
                                  | lb:// (Eureka)
        +-------------+-----------+-----------+----------------+------------------+
        v             v                       v                v                  v
  auth-service  sensor-service          crop-service   climate-service   recommendation-service
      8081           8082                    8083             8086                8087
                       ^                      |  ^              ^                  ^
                       |                      |  |              |                  |
                       +--- telemetry --------+  +-- owner-checked property facade+
                       |                      |                                     |
                       +-------- irrigation-service 8084 --------------------------+

                     Eureka Server 8761  (7 Spring Boot services register)
```

| Module | Port | Responsibility |
|--------|------|----------------|
| `eureka-server` | 8761 | Service registry, 30s health checks, 90s de-registration |
| `api-gateway` | 8080 | Single entry point: JWT validation, HMAC-signed identity headers, rate limiting, Resilience4j circuit breakers, Retry, OWASP security headers, CORS, aggregated Swagger UI (`/swagger-ui.html`) |
| `auth-service` | 8081 | Login, registration (`FARMER` pinned), 15-min JWTs, DB-backed rotating refresh tokens, revocation list, Google/Supabase federation |
| `sensor-service` | 8082 | Device registry, telemetry ingestion and validation, historical queries |
| `crop-service` | 8083 | Property ownership, crop field CRUD, health scoring, daily reports, and the authenticated `/api/farm/**` property facade |
| `climate-service` | 8086 | Stateless Open-Meteo historical retrieval, caching, ET0/water-balance/GDD statistics and risk indices |
| `recommendation-service` | 8087 | Persistent crop reference data (`recommendation_service.crops`) and weighted, explainable crop ranking |
| `irrigation-service` | 8084 | Schedules, valve CRUD and control, moisture cut-out, emergency stop |
| `common` | - | Shared error envelope (`ApiExceptionHandler`), `CallerContext` tenant/role enforcement, `InternalAuth` HMAC verification, `Secrets` startup checks, `OpenApiConfig` |
| `frontend` | 5173 | Operations dashboard (React 18 + Vite 5 SPA) |
| `web` | 3000 | Next.js 16 dashboard (App Router, React 19, Tailwind v4, shadcn) |

**Security model.** The gateway is the only component that parses a JWT. On every request it
strips any client-supplied `X-User-*` headers, sets its own from the verified token, and
HMAC-signs them (`X-Gateway-Signature` + timestamp). Every service rejects an `/api` call whose
signature is missing, wrong or older than 60 s, so calling a service port directly with a forged
`X-User-Role: ADMIN` gets a 401. Inter-service calls go direct through Eureka and sign themselves
as the `SERVICE` identity. Access tokens live 15 minutes; the dashboard renews them silently
with the rotating refresh token.

**Resilience.** Each gateway route has a Resilience4j circuit breaker with a fallback that
returns a fast 503 plus `Retry-After`, so one dead service never takes the others down.

---

## Running it

Requires JDK 21+ and Node 20+. No global Maven needed - the wrapper is committed.

```bash
./scripts/stack.ps1 start
```

That builds all 9 child Maven modules (`pom.xml`) and launches `eureka-server` plus the seven Spring Boot services (8 processes; 11 with `-Replicas`) in dependency order, waiting for each to report healthy. Then start either dashboard:

```bash
# React + Vite dashboard (port 5173)
npm install --prefix frontend
npm run dev --prefix frontend

# Next.js 16 dashboard (port 3000)
npm install --prefix web
npm run dev --prefix web
```

- Vite dashboard: http://localhost:5173
- Next.js dashboard: http://localhost:3000
- API gateway: http://localhost:8080 (Swagger UI: http://localhost:8080/swagger-ui.html)
- Eureka: http://localhost:8761

Other actions: `./scripts/stack.ps1 status`, `stop`, `restart`. Logs land in `.run/`.

### Database

The five stateful data services persist their entities with Spring Data JPA (`climate-service` is stateless with no database). PostgreSQL is the preferred shared database for a demo with replicas; each stateful service writes only to its own schema (`auth_service`, `sensor_service`, `crop_service`, `recommendation_service`, or `irrigation_service`). Flyway manages schema migrations on `auth_service` (`V1`), `crop_service` (`V1`–`V4`), and `recommendation_service` (`V1`), while `sensor_service` and `irrigation_service` use Hibernate `ddl-auto: update` (`create_namespaces: true`). When `DB_URL` is unset, each stateful service falls back to its own persistent H2 file under `.run/data/` (`AUTO_SERVER=TRUE;DATABASE_TO_LOWER=TRUE`).

With PostgreSQL 16+ installed and running on localhost, create the application role/database and write
the connection settings to the ignored root `.env` file:

```powershell
.\scripts\db-setup.ps1
.\scripts\stack.ps1 start
```

The setup script asks for the local PostgreSQL `postgres` administrator password, generates an
application password, preserves other `.env` settings, and keeps the prior file as `.env.bak`. Copy
`.env.example` only when you need a starting template; do not commit `.env`. `scripts/stack.ps1`
also generates `AGRITECH_JWT_SECRET` and `AGRITECH_INTERNAL_SECRET` into `.env` on first run
(services refuse to start without >= 32-char non-default secrets). No Supabase database credentials
are needed. To reseed the H2 demo database, stop the stack and remove `.run/data/`.

**Load balancing.** `./scripts/stack.ps1 start -Replicas` adds a second sensor, crop and irrigation
instance (ports 18082-18084) under the same Eureka names. The gateway (`lb://`) and the
`@LoadBalanced` RestTemplates round-robin across them; all instances of a service share its DB, and
timed jobs run only on the primary (`--agritech.jobs.enabled=false` on replicas). A connection
failure to a dead instance is retried on the next one, at the gateway and service to service.
`bash scripts/lb-test.sh` proves it: registry, 50/50 split, shared state, and failover after
killing an instance.

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
`POST /api/telemetry/ingest`, which is the actual contract. That endpoint is not public: the field
gateway must send `Authorization: Bearer <token>` for an account on the owning farm, and a reading
addressed to a device on someone else's farm is rejected in the per-reading `rejected` list.

---

## Tests

```bash
./mvnw.cmd test                  # 95 unit & integration tests across 17 test classes (10 Maven modules)
bash scripts/smoke-test.sh       # 33-check end-to-end verification against a running stack
bash scripts/crud-demo.sh        # 18-check CRUD + 40-read round-robin + shared DB demo
bash scripts/lb-test.sh          # 14-check discovery + load balancing + failover (needs start -Replicas)
python scripts/security-probes.py  # 37-check live security & rubric probe suite
```

The smoke test (`33 checks`) covers the PRD's section 9.3 scenarios: unauthenticated rejection,
login for both roles, forged-token rejection, farmer/admin authorization split, device
registration, telemetry ingestion including out-of-range rejection, health scoring from live
telemetry, cross-service trend retrieval through Eureka, manual valve control, emergency stop,
schedule CRUD, climate analytics (`/api/climate/history`), crop recommendations
(`/api/recommendations/score`), and logout revocation taking effect at the gateway. Scenario 3
checks: all seven API services registered in Eureka, 15-min token TTL, refresh rotation and replay
rejection, exact-match public auth paths, direct-to-service bypass rejection, header-based role
escalation, OWASP security headers, correlation ids, rate-limit headers, `no-store`, the 1 MB body
cap, and 6 route circuit breakers.

`AgriTech_Fast_Test.postman_collection.json` (`84 requests` across `14 folders`; 86 executed
including 2 auto-login prerequests, `124` assertions passing via `postman collection run`) exercises
auth, sensors, telemetry, crops, valves, schedules, `Farm & Properties` (`/api/farm/**`),
`Climate & Recommendations` (`/api/climate/**`, `/api/recommendations/**`), farmer RBAC checks,
Eureka discovery, `OpenAPI & Swagger`, and gateway/actuator error paths against
`AgriTech_Local.postman_environment.json`.

Backend unit and integration tests (`95` `@Test` methods across `17` classes in all `10` Maven
reactor modules: `common` 22, `api-gateway` 9, `auth-service` 20, `sensor-service` 14,
`crop-service` 21, `climate-service` 2, `recommendation-service` 3, `irrigation-service` 4,
`eureka-server` 0) include `JwtAuthFilterTest` (valid, missing, forged-key, expired, `alg:none`,
revoked, spoofed headers, exact public paths), `RouteRetryConfigTest` (`CircuitBreaker` outside
`GET`-only `Retry` on `IOException` and `PrematureCloseException`), `InternalAuthTest` (signed
passes; unsigned, escalated, replayed and wrong-secret signatures are rejected),
`CallerContextTest`, `ApiExceptionHandlerTest` (including `ConstraintViolationException` -> 400),
and `SensorControllerTenantTest`.

`scripts/security-probes.py` runs `37` live checks (`H05` unauthenticated Eureka `:8761` is an
accepted local-demo simplification). Frontend verification includes in-repo
`frontend/tests/sensorCapabilities.test.js`, `scripts/e2e/farm-flow.js`, and
`scripts/check-i18n.mjs`, while the companion Next.js 16 frontend checkout on `:5000`
(`c:\Users\anjan\Downloads\SOA-Hackthon\frontend`) verifies **69 Vitest unit tests** (11 files)
and **51 Playwright E2E tests** (8 spec files) against the `:8080` gateway.

---

## API

All paths are relative to the gateway (`http://localhost:8080`; interactive docs at
`http://localhost:8080/swagger-ui.html`). Protected routes require `Authorization: Bearer <jwt>`;
public routes are `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`,
`/api/auth/google`, `/actuator/health`, `/swagger-ui.html`, `/<service>/v3/api-docs`, and
`/fallback/**`.

### Auth
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | Returns access token (15 min), refresh token, role, farm, displayName |
| POST | `/api/auth/register` | Public signup; always creates `FARMER` with a unique `FARM-xxxxxxxx` tenant ID (ignores caller `role`) |
| POST | `/api/auth/google` | Supabase token introspection (`/auth/v1/user`); provisions `FARMER` on `FARM-001` |
| POST | `/api/auth/refresh` | Exchanges a single-use rotating refresh token for a new pair |
| POST | `/api/auth/logout` | Revokes the access token `jti` and drops `{refreshToken}` |
| GET | `/api/auth/revoked` | Revoked `jti` set polled every 15 s by gateway `RevocationCache` |
| GET | `/api/auth/me` | Decoded claims (`email`, `role`, `farmId`, `displayName`, `expiresAt`) |
| PUT | `/api/auth/me` | Change password (`currentPassword`, `newPassword`) |
| DELETE | `/api/auth/me` | Delete account, drop all refresh tokens, revoke current `jti` |

### Sensors and telemetry
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/sensors/register` | `ADMIN` or peer `SERVICE` |
| GET | `/api/sensors` | Paginated, tenant-scoped; `page`, `size`, `q`, `health`, `fieldId` |
| GET/PUT/DELETE | `/api/sensors/{deviceId}` | Tenant-scoped GET; `PUT` and `DELETE` allow `ADMIN` or peer `SERVICE` |
| GET | `/api/sensors/summary` | Online / offline / low-battery counts (tenant-scoped) |
| POST | `/api/telemetry/ingest` | Bulk; each reading validated independently with per-reading tenant ownership check |
| GET | `/api/telemetry/{deviceId}` | `range` = `1h`, `24h`, `7d`, `30d`, `90d` (or `from`/`to` ISO-8601) |
| GET | `/api/telemetry/{deviceId}/latest` | Latest reading for one device |
| GET | `/api/telemetry/field/{fieldId}/latest` | Averaged rollup used by `crop-service` |
| GET | `/api/telemetry/field/{fieldId}/series` | Bucketed series for charts |
| POST | `/api/telemetry/field/{fieldId}/irrigation-event` | Simulator watering signal from `irrigation-service` |
| GET | `/api/telemetry/stats` | Ingestion volume |

### Crops
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/crops` | Create a field, map optimal bands from `CropCatalog`, and provision its sensor |
| GET | `/api/crops` | Tenant-scoped fields with latest health snapshot |
| GET/PUT/DELETE | `/api/crops/{cropId}` | Single field read; rename/resize/replant (`PUT`); remove field, snapshots, and sensor (`DELETE`) |
| GET | `/api/crops/{cropId}/health` | Current score, computed on demand if stale |
| GET | `/api/crops/{cropId}/metrics` | Environment series, health trend, optimal bands (`range` = `24h`, `7d`, `30d`, `90d`) |
| POST | `/api/crops/analyze` | Manual analysis; body `{"cropId": "..."}` or empty for all visible fields |
| GET | `/api/crops/alerts` | Fields outside their optimal envelope |
| GET | `/api/crops/summary` | Share of fields at optimal |

### My farm and properties (authenticated owner scope)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/farm/me` | Default or selected (`?propertyId=`) farm property plus newest readings graded against the crop; `204` until onboarding |
| PUT | `/api/farm/me` | First-login setup and default-property edits: `farmName`, `landSize`, `landUnit` (`ACRES`/`HECTARES`), `cropId`, `state`, `district`, `sensors`, `profile` |
| GET/POST | `/api/farm/properties` | List all properties owned by the signed-in account, or create an additional property |
| GET/PUT/DELETE | `/api/farm/properties/{propertyId}` | Read, update, or delete one owned property |
| GET | `/api/farm/properties/{propertyId}/climate` | Owner-checked historical climate analytics proxied to `climate-service` (`start`, `end`) |
| GET | `/api/farm/properties/{propertyId}/recommendations` | Owner-checked crop ranking orchestrating `climate-service` and `recommendation-service` (`start`, `end`) |
| GET | `/api/farm/me/reports` | Report history (up to 90 days, optional `?propertyId=`), newest first |
| GET | `/api/farm/me/reports/latest` | Today's report (rebuilt at most every 15 min), or yesterday's if today has no data yet |
| GET | `/api/farm/me/reports/{date}` | One day, `YYYY-MM-DD` (optional `?propertyId=`) |

Every `/api/farm` call is scoped to the caller's gateway-verified email; there is no farm id in the
URL to tamper with.

### Climate analytics (`climate-service`)
| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/climate/history` | Query `lat`, `lon`, `start`, `end` (`YYYY-MM-DD`); Open-Meteo historical summary, ET0, water balance, GDD, and `annualSeries` |
| GET | `/api/internal/climate/history` | Internal `SERVICE`-role route called by `crop-service` via Eureka (`lb://climate-service`) |

### Crop recommendations (`recommendation-service`)
| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/recommendations/score` | Body `{climate, soilType, waterSource, waterAvailability, intent, targetDate, limit}`; `intent` in `GROW_NOW`, `PLAN_DATES`, `RECOMMEND_BEST`; returns weights, ranked crops, and adaptations |
| POST | `/api/internal/recommendations/score` | Internal `SERVICE`-role route called by `crop-service` via Eureka (`lb://recommendation-service`) |

### Irrigation
| Method | Path | Notes |
|--------|------|-------|
| GET/POST | `/api/irrigation/schedules` | `POST` is admin only |
| GET/PUT/DELETE | `/api/irrigation/schedules/{id}` | Admin only for writes |
| PATCH | `/api/irrigation/schedules/{id}/active` | On/off toggle; admin only |
| GET | `/api/irrigation/events` | Valve activity for the alert feed (tenant-scoped) |
| GET/POST | `/api/valves` | All zones with live state; `POST` creates a zone (admin only) |
| GET | `/api/valves/{id}/status` | Single zone status |
| PUT/DELETE | `/api/valves/{id}` | Reconfigure or decommission a zone (admin only; refuses delete while open) |
| POST | `/api/valves/{id}/open` | `durationMinutes` 1–240; admin only (409 if saturated) |
| POST | `/api/valves/{id}/close` | Admin only |
| POST | `/api/valves/emergency-stop` | Closes every open valve (`ADMIN`/`SERVICE`) or the caller's own farm's valves (`FARMER`) |
| GET | `/api/valves/summary` | Total zones and running count |

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

## Farm setup, simulated sensors and daily reports

**First login.** A farmer with no farm is sent to `/onboarding`: crop (48 Indian crops), location,
land size (acres or hectares) and farm name, then a sensor checklist. The soil probe (moisture,
soil temperature, pH) is always on; air temperature, humidity, light, soil NPK, rainfall and paddy
water level are optional, with the ones that suit the crop pre-ticked. Saving stores a
`farm_profiles` row against the user and creates the field and its sensor device.

**Simulated sensors.** There is no hardware yet, so each farm's device is simulated by
`FarmSimulation` (sensor-service) from crop-tuned targets that crop-service picks at setup
(`FarmService.simProfile`). Readings follow a physical model rather than dice: a day/night
temperature curve, humidity that falls as it warms and jumps in rain, sunlight that is zero at night,
soil that dries through the day and recovers after rain, slow nutrient uptake, and paddy water that
drains and is refilled. Each day's weather is seeded by farm and date, so farms differ and stay
consistent. Only the chosen sensors report. Everything is labelled as simulated in the API and UI.
Real devices replace this by posting the same fields to `/api/telemetry/ingest`.

**Crop ranges and grading.** `CropCatalog` (crop-service) holds temperature, soil moisture,
humidity, pH, light, N/P/K and paddy water-level ranges for every crop. A reading is **Optimal**
inside its range, **Normal** within 10% of the range width outside it, **Warning** within 35%, and
**Critical** beyond that.

**Daily report.** `ReportBuilder` turns an IST calendar day of readings into: farm details, a
sensor summary (average; light's midday peak; rain's total), the overall condition (Optimal /
Acceptable / Needs attention / Critical), alerts that say what each abnormal reading means for the
crop, practical recommendations (irrigation, temperature, disease, soil pH, fertiliser, light, paddy
water) and a short summary. Reports are stored per user per day in `daily_reports`; today's is
rebuilt at most every 15 minutes, and a nightly job (00:15 IST) freezes yesterday's for every farm.
The dashboard shows the latest report with a picker for past days.

**Browser test.** `scripts/e2e/farm-flow.js` signs up a brand-new farmer and walks the whole flow
onboarding, sensor choice, saved farm, simulated readings, crop ranges, report,
history, server-side persistence, and the existing pages.

```bash
playwright-cli open
playwright-cli run-code --filename=scripts/e2e/farm-flow.js
```

Each run creates an `e2e-<timestamp>@agritech.test` user.

---

## Farm onboarding and India irrigation planning

A farmer who signs in for the first time (role `FARMER`, no farm set up yet) is sent to
`/onboarding`, a five-step wizard:

1. **Crop** - 48 Indian crops across cereals, millets, pulses, oilseeds, cash crops, vegetables,
   fruits, spices and plantation crops, with Hindi names and Kharif/Rabi/Zaid seasons.
2. **Location** - every state and union territory, key agricultural districts, or "use my
   location" (nearest district). The district sets the climate zone.
3. **Field** - farm name, area (acres or hectares), sowing date, soil type (pre-filled from the
   zone), irrigation method (drip / sprinkler / flood) and pump size.
4. **Sensors** - which sensors the farm needs (see "Farm setup, simulated sensors and daily
   reports"), with the full hardware kit and indicative INR prices one click away.
5. **Irrigation plan** - a seven-day plan uses the live Open-Meteo forecast when available and
   falls back to the district's IMD climate normals. Completing setup saves the farm to the server
   and opens the dashboard.

During setup the planner performs the work previously shown on the Farm Assistant screen:

- **Water need.** FAO-56 ET0 comes from live weather, or Hargreaves ET0 from climate normals.
  Stage-dependent Kc gives crop use (ETc); effective rain is subtracted, irrigation efficiency
  applied, and water volume and pump minutes are calculated from field area and pump flow.
- **Timing and advisories.** Temperature bands determine irrigation windows. Hot days split water
  between pre-dawn and evening, avoiding 11:00-16:00; cold days use late morning, with a light
  evening run on frost nights. Rain can skip irrigation. Crop, heat, frost and fungal advisories
  are shown alongside the seven-day schedule.
- **Sensors.** The wizard recommends sensors, quantities and indicative INR costs from crop,
  field area and irrigation zones.

These are setup recommendations and a forecast plan; completing setup does not actuate physical
valves. The farm is stored on the server; the browser keeps a copy for the wizard. The small **+** in the
top bar opens the setup again from any page, pre-filled, to change crop, land or sensors. The
engine is in `frontend/src/farm/` (`india.ts` crop and regional data, `engine.ts` calculations).

## Languages

The dashboard has a language button (top right; also on the login and onboarding screens)
offering English plus all 22 languages of the Eighth Schedule: Hindi, Bengali, Marathi, Telugu,
Tamil, Gujarati, Urdu, Kannada, Odia, Malayalam, Punjabi, Assamese, Maithili, Santali (Ol Chiki),
Kashmiri, Nepali, Sindhi, Dogri, Konkani, Manipuri (Bengali script), Bodo and Sanskrit. The choice
is saved in the browser. It translates the whole interface, including the onboarding wizard, the
sensor recommendations, the seven-day irrigation plan and its advisories. Urdu, Kashmiri and Sindhi switch
the page to right-to-left.

- The strings live in `frontend/src/i18n/en.ts`, with one file per language in
  `frontend/src/i18n/locales/`. Each language is loaded only when it is picked. A key a language
  does not have falls back to English.
- `node scripts/check-i18n.mjs` (repo root) checks every language for unknown keys, mismatched
  `{placeholders}` and coverage.
- These stay in English: text that comes from the backend (alert messages, recommendations),
  device IDs, and state and district names.
- The translations were machine-authored. Have native speakers review them before production use,
  especially the less-resourced languages (Bodo, Santali, Dogri, Manipuri, Kashmiri, Sindhi,
  Konkani, Maithili and Sanskrit).

## Frontend stack

Two dashboards exist in this repository, both communicating exclusively through the API gateway (`:8080`):

1. **`frontend/` (React 18 + Vite 5 SPA on `:5173`)**: routed with React Router, charted with Recharts, styled with plain CSS (`frontend/src/styles.css`: `DM Sans`, `Crimson Text` headlines, `DM Mono` data labels, olive accents), self-hosted via `@fontsource`, and featuring Properties, PropertyDetail, Climate, Recommendations, Settings, Crops, Sensors, Irrigation, Assistant, and Onboarding pages.
2. **`web/` (Next.js 16.3.4 + React 19.2.8 on `:3000`)**: App Router dashboard with Tailwind CSS v4, shadcn, Recharts, `Inter` and `IBM Plex Mono` (`next/font/google`), and the same 22-language i18n layer.

| Concern | How it works |
|---------|--------------|
| API access | `frontend/vite.config.js` proxies `/api/*` to `:8080`, and `web/next.config.ts` rewrites `/api/:path*` to `${GATEWAY_URL:-http://localhost:8080}/api/:path*`, so the browser sees one origin and no CORS preflight. |
| Auth | JWT in `localStorage`, renewed silently with the rotating refresh token. |
| Theme | An inline script in `frontend/index.html` (and `web/src/app/layout.tsx`) applies the stored theme (`agritech.theme`) before first paint, so dark-mode users get no white flash. |

---

## Design system notes

Both dashboards share the status-encoding contract (colour plus shape plus label), responsive
breakpoints, light/dark themes, and Phosphor icons (`@phosphor-icons/react` at 1.5 px / 20 px; `web/`
also pairs Lucide icons for shadcn primitives). Fonts are self-hosted in `frontend/` (`DM Sans`,
`Crimson Text`, `DM Mono` via `@fontsource`) and loaded via `next/font/google` in `web/` (`Inter`,
`IBM Plex Mono`).

Two brief values were changed in both themes because WCAG AA requires >= 4.5:1 on every status
indicator and the original hex values fell short:

| Token | Brief | Shipped | Reason |
|-------|-------|---------|--------|
| `--status-warning` (light) | `#B8860B` | `#8F6708` | 3.05:1 on the light surface; darkened in the same hue to 4.79:1 |
| `--status-muted` (light/dark) | not specified | `#646E62` / `#95A190` | first pick failed AA at 3.15:1 and 4.01:1 |

Every foreground/background pair in the shipped palette clears 4.5:1 in both themes, worst case
4.63:1. Heavy chart views are lazy-loaded (`React.lazy` in `frontend/src/App.jsx`) so initial sign-in
and dashboard navigation avoid loading the full charting bundle upfront.

---

## Deliberate simplifications

These are the corners this build cuts, and what replaces each when it stops being enough. They are
also marked with `ponytail:` comments at the relevant code.

| Simplification | Ceiling | Upgrade |
|----------------|---------|---------|
| Local H2 file DB fallback (`AUTO_SERVER=TRUE`) when `DB_URL` is unset; `sensor`/`irrigation` use `ddl-auto: update` | H2 replicas must run on one host; telemetry uses relational tables | Configure PostgreSQL via `scripts/db-setup.ps1` (supported today with 5 schemas + Flyway on `auth`, `crop`, `recommendation`); add Flyway to `sensor`/`irrigation` and TimescaleDB for telemetry |
| Timed jobs run on the primary instance only (`--agritech.jobs.enabled=false` on replicas) | If the primary dies, simulation/analysis/schedules pause until it restarts | ShedLock on the shared DB |
| In-memory rate-limit counters | N gateway replicas allow N times the quota | Spring Cloud Gateway's Redis rate limiter |
| Revocation list polled every 15s | A logged-out token works for up to 15 more seconds | Shared Redis revocation set |
| Gateway circuit breakers only (`SensorClient` degrades via try/catch) | Service-to-service calls retry the next instance (`spring-retry`), then degrade by try/catch | Resilience4j on `SensorClient` / `FarmClient` too |
| Duplicated `CropCatalog` / `ClimateStatistics` / `PublicWeatherClient` across services | Crop or climate helpers must stay aligned across services | Extract a shared non-servlet domain library module |
| Device simulator inside sensor-service | Not a real protocol adapter | Delete it; devices already post to the same `/api/telemetry/ingest` contract |
| No message queue | Health analysis is a 5-minute poll, not event-driven | Kafka between ingestion and analysis |

Not built, per the PRD's own scope: Kubernetes manifests, ELK, Prometheus dashboards, and the
Phase 2+ items in section 16.

# SOA_project
