
# AgriTech Sensing Solutions

**Continuous Evaluation Project — Review 1**

**Architecture report and evaluation notes, aligned with the Review 1 rubrics and current codebase**

How the platform works, what evidence in the codebase proves each rubric claim, and the verified status
of every security, discovery, gateway, and persistence control.

Spring Boot 3.3.4 / Spring Cloud 2023.0.3 / Java 21 · Reconciled against the current repository working tree

---

## Table of contents

**Part I — The project and how it works**

1. How to use this document
2. The system at a glance
3. The request lifecycle, end to end
4. The automation logic (what makes it more than CRUD)
5. Running and demonstrating it

**Part II — Rubric-by-rubric notes**

6. Rubric 1 — Problem Analysis and Requirement Specification
7. Rubric 2 — Microservice Identification and Service Discovery
8. Rubric 3 — JWT Authentication
9. Rubric 4 — API Gateway Configuration
10. Rubric 5 — LinkedIn article (out of scope)

**Part III — Rubric summary, demo script, and file inventory**

11. The one-page scoring summary
12. Completed improvements vs remaining optional work
13. Demo script for the review room
14. Viva questions you should expect, with the answers
15. Appendix — file inventory for the report

## How to use this document

This is two documents stapled together, and both halves are needed for the same purpose.

The first half is the **technical write-up**: what the project is, what every service owns, and how a
request actually flows through it. The second half is the **scoring playbook**: for each rubric, the
evidence in your own code that proves the claim, the language that earns the marks, and the honest
list of holes an examiner will find if you let them.

Every rubric section uses the same four-part shape:

| Part | What it gives you |
| --- | --- |
| **What the rubric asks** | The 0 / 2 / 5 / 7 / 10 ladder, and what the top rung actually means |
| **What your project does** | Claims tied to real file paths and real config keys — nothing you cannot defend |
| **How to present it** | Sentences and diagrams to put in the report and say in the room |
| **Gap and fix** | What is missing for a 10, with code you can paste |

> **Documentation status — Verified against current codebase**
>
> `docs/AGRITECH_PRD.md` (with quantified problem statement, 5 personas, DTI and `docs/survey/farmer-survey.md`, `FR-1`..`FR-12`, `NFR-1`..`NFR-8`, Mermaid use-case diagram, traceability matrix in section 14, scope boundaries in section 15, and Phase 2+ roadmap in section 16) is present in the repository and maps directly to the `PRD 7.x` and `FR-*` code annotations. Design tokens and contrast measurements are documented in `README.md`, `frontend/src/styles.css`, and `web/src/app/globals.css`.

Rubric 5 (LinkedIn article with DTI concepts) is out of scope for backend code verification; a draft is present at `linkedin-article/AgriTech_LinkedIn_Article_final.md`.

---

# Part I — The project and how it works

## The system at a glance

AgriTech Sensing Solutions is a precision-agriculture control platform. A fleet of field sensors reports
soil moisture, soil temperature, pH and battery level (plus optional environmental metrics for user farms).
The platform scores each field's crop health against that crop's optimal envelope, retrieves historical
climate analytics and ranks 48 Indian crops, and drives irrigation valves from the score — opening zones
when moisture is forecast to fall below the optimal floor, and shutting them off early when moisture reaches
the optimal ceiling so it does not waste water.

It is a **Spring Cloud microservices system**: **nine child Maven modules** under one reactor `pom.xml`
(**six domain services**, `api-gateway`, `eureka-server`, and shared library `common` — **7 Spring Boot
services registered in Eureka**), a Netflix Eureka registry for service discovery, and browser dashboards
(`frontend/` React+Vite on `:5173` and `web/` Next.js 16 on `:3000`) that talk only to the gateway.

| Module | Port | Owns | Responsibility |
| --- | --- | --- | --- |
| `eureka-server` | 8761 | — | Service registry; 30 s heartbeat, 90 s eviction |
| `api-gateway` | 8080 | no data | Single entry point: JWT validation, HMAC-signed identity headers, rate limiting, Resilience4j circuit breakers, Retry, OWASP security headers, CORS, aggregated Swagger UI (`/swagger-ui.html`) |
| `auth-service` | 8081 | `User`, `StoredToken` (`auth_service`) | Login, registration (`FARMER` pinned, unique `FARM-xxxxxxxx`), 15-min JWTs, DB-backed rotating refresh tokens, revocation list, Google/Supabase federation |
| `sensor-service` | 8082 | `SensorDevice`, `TelemetryReading`, `FieldWatering` (`sensor_service`) | Device registry, telemetry ingestion and per-item validation, historical queries, farm simulation |
| `crop-service` | 8083 | `Crop`, `HealthSnapshot`, `FarmProperty`, `PropertyWaterDetails`, `PropertyCropIntent`, `DailyReport`, `FarmProfile` (`crop_service`) | Crop CRUD, health scoring, optimal-range evaluation, daily reports, and `/api/farm/**` property facade |
| `climate-service` | 8086 | stateless (no DB) | Open-Meteo historical retrieval, caching, ET0/water-balance/GDD climate statistics and risk indices |
| `recommendation-service` | 8087 | `CropReference` (`recommendation_service`) | Persistent 48-crop catalog (`Flyway V1`) and weighted explainable crop ranking |
| `irrigation-service` | 8084 | `IrrigationSchedule`, `Valve`, `IrrigationEvent` (`irrigation_service`) | Schedules, valve CRUD and control, moisture cut-out, emergency stop |
| `common` | — | no data | Shared error envelope (`ApiExceptionHandler`), `CallerContext` tenant/role helpers, `InternalAuth` HMAC filter, `Secrets` startup validation, `OpenApiConfig` |
| `frontend` | 5173 | no data | Operations dashboard (React 18 + Vite 5 SPA) |
| `web` | 3000 | no data | Next.js 16 App Router dashboard (React 19, Tailwind v4, shadcn, Recharts) |

Build stack, straight from the root `pom.xml` and module POMs:

| Concern | Choice |
| --- | --- |
| Language | Java 21 |
| Framework | Spring Boot 3.3.4 |
| Cloud | Spring Cloud 2023.0.3 |
| Gateway | Spring Cloud Gateway (reactive / WebFlux), Resilience4j CircuitBreaker + Retry, `springdoc-openapi` `2.6.0` |
| Discovery | Netflix Eureka client + server |
| JWT & Internal Trust | `jjwt` 0.11.5 (HS256, 15-min TTL) + HMAC-SHA256 `GatewaySigner` / `InternalAuth` (60 s skew, fail-fast `Secrets` / `GatewaySecrets`) |
| Password hashing | `BCryptPasswordEncoder` (`spring-security-crypto`) + timing-equalized `dummyHash` |
| Persistence | PostgreSQL 16+ (5 service schemas + Flyway on `auth`, `crop`, `recommendation`) with persistent local H2 file fallback (`AUTO_SERVER=TRUE;DATABASE_TO_LOWER=TRUE`) |
| Frontends | `frontend/` (React 18.3, Vite 5.4, React Router, Recharts) and `web/` (Next.js 16.3.4, React 19.2.8, Tailwind v4, shadcn, Recharts) |

> **Note — One sentence that describes the whole architecture**
>
> Every request enters through one gateway that verifies the JWT, strips and HMAC-signs identity headers,
> enforces rate limits and circuit breakers, and routes across six domain services that own separate
> database schemas and collaborate strictly through Eureka service IDs.

## The request lifecycle, end to end

This is the diagram to have on screen when the examiner asks "walk me through what happens when a
farmer opens the dashboard".

**A single authenticated dashboard request, from click to JSON**

```
Browser (frontend :5173 or web :3000)
   |
   |   GET /api/crops   Authorization: Bearer <jwt>
   v
api-gateway :8080
   |
   |   [1] RequestIdFilter  order -200  assign X-Request-Id, Cache-Control: no-store, ACCESS log
   |   [2] JwtAuthFilter    order -100  verify HS256, jti not revoked
   |   [3] strip client X-User-* / X-Gateway-* -> set & HMAC-sign verified identity headers
   |   [4] RateLimitFilter  order -50   charge IP (100/m), user (1000/m), device (100/m); strictest wins
   |   [5] Default filters (SecureHeaders, RequestSize 1MB) + CircuitBreaker + Retry
   |   [6] resolve lb://crop-service ..........> Eureka :8761
   |       <.................................... healthy instances (round-robin across :8083 / :18083)
   v
crop-service :8083 (or :18083)
   |
   |   [7] InternalAuth verifies HMAC signature (<= 60 s skew); CallerContext scopes by farmId
   |   [8] resolve http://sensor-service .....> sensor-service :8082 / :18082 (HMAC-signed SERVICE)
   |       <..... averaged soil moisture / temperature / pH
   |   [9] score against Crop optimal bands, weights 50/30/20
   v
api-gateway :8080
   |
   v
Browser   ->   200 JSON, or shared JSON error envelope (503 + Retry-After: 10 via /fallback/{service} if open)
```

Five things worth saying out loud about this flow, because each one maps to a rubric row:

1. **The browser never learns a service hostname.** `frontend/vite.config.js` proxies `/api/*` and
   `web/next.config.ts` rewrites `/api/:path*` to the gateway, so the origin is single and there is no
   CORS preflight in normal use (gateway CORS also covers `http://localhost:*` and `http://127.0.0.1:*`).
2. **The gateway is the only JWT parser in the system.** Documented verbatim in
   `api-gateway/src/main/java/com/agritech/gateway/JwtAuthFilter.java:24-26`.
3. **Discovery and zero-trust signing are used twice in one request** — gateway to service, then
   `crop-service` to `sensor-service` (`climate-service` / `recommendation-service` / `irrigation-service`).
   All calls target Eureka service IDs (`lb://` or `@LoadBalanced RestTemplate`), never hardcoded ports, and
   all `/api/**` calls require a valid HMAC signature (`InternalAuth`).
4. **Filters are ordered deliberately**: `RequestIdFilter` (`-200`) sets correlation logging first,
   `JwtAuthFilter` (`-100`) validates and signs identity second, and `RateLimitFilter` (`-50`) runs third
   so it can enforce per-user and caller-scoped device buckets cleanly.
5. **Failures look the same everywhere.** Service errors use `common/ApiExceptionHandler.java`, and
   gateway filter/fallback errors use `GatewayResponses` / `FallbackController` (`{"error", "message", "timestamp"}`),
   per PRD 7.3 (with `GlobalErrorWebExceptionHandler` / `NotFoundHandler` handling unmatched WebFlux paths).

## The automation logic (what makes it more than CRUD)

This is the part that separates a "microservices demo" from a "system", so it belongs in the report even
though no rubric row names it directly.

**Health score.** For each of soil moisture, soil temperature and pH: 100 inside the crop's optimal band,
losing points in proportion to how far outside it the reading sits, measured in *band widths* rather than
raw units. The three are weighted 50 / 30 / 20 toward moisture. A drift of up to 35 % of a band width is
a warning; beyond that is critical. Implemented in `crop-service/.../HealthScore.java`, covered by
`HealthScoreTest`.

**Irrigation forecast.** The moisture slope over the last six hours is extrapolated forward to the moment
it would cross below the optimal floor. Only forecasts inside a 48-hour horizon are reported — beyond
that, linear extrapolation of a noisy signal is not worth showing the farmer.

**Water saving.** Every schedule defaults to `skipIfMoist`. Before opening, irrigation-service asks
crop-service for the field's health and *skips the run* if moisture is already at or above the optimal
ceiling. A zone already running shuts itself off mid-run when it reaches that ceiling. This is the
closed loop, and it is the strongest answer to "why does this need to be more than one service?".

**Demo closure.** `sensor-service/DeviceSimulator.java` seeds 13 devices across 4 fields, backfills 48
hours of 15-minute samples on a sine daily cycle, then emits every 30 seconds. One device is deliberately
left offline and one field starts dry, so the alert paths are visible without waiting for a failure.
When a valve opens, irrigation-service calls
`POST /api/telemetry/field/{id}/irrigation-event`, and simulated moisture climbs ~1.4 per tick while
watering — so the score visibly recovers on screen. Set `SIMULATOR_ENABLED=false` to run against real
devices; they post to the same `POST /api/telemetry/ingest` contract.

## Running and demonstrating it

```powershell
./scripts/stack.ps1 start -Replicas   # build all 9 modules, then launch 8 services + 3 replicas in dep order
npm install --prefix frontend
npm run dev --prefix frontend         # http://localhost:5173 (React + Vite)
# or:
npm install --prefix web
npm run dev --prefix web              # http://localhost:3000 (Next.js 16)
```

`stack.ps1` loads the git-ignored root `.env` into the child process environment (and generates
`AGRITECH_JWT_SECRET` and `AGRITECH_INTERNAL_SECRET` on first run if absent, since services refuse to
start without >= 32-character non-default keys), then starts eureka(8761) → auth(8081) → sensor(8082)
→ crop(8083) → climate(8086) → recommendation(8087) → irrigation(8084) → gateway(8080) as
`java -jar <module>/target/<name>-1.0.0-exec.jar` (plus optional replicas on `:18082`, `:18083`,
`:18084` with `--agritech.jobs.enabled=false`), blocking on each service's `/actuator/health` returning
`UP` (300 s timeout) and writing logs to `.run/`. `-SkipBuild` skips `mvnw -q -B package -DskipTests` —
which means **backend edits silently run as stale JARs unless you rebuild first**.

| Credential | Role | Sees |
| --- | --- | --- |
| `admin@agritech.io` / `admin1234` | ADMIN | Full sensor, schedule and valve control |
| `farmer@agritech.io` / `farmer1234` | FARMER | Read-only telemetry and crop health |

The dashboard never asks which role you are; navigation and controls are filtered from the `role` claim
inside the issued token. That is a good line to say in a viva — it means authorisation is driven by the
token, not by a UI setting.

Verification, across all levels:

```bash
./mvnw.cmd test                  # 95 unit & integration tests across 17 test classes (10 Maven modules)
bash scripts/smoke-test.sh       # 33-check end-to-end suite against a running stack
bash scripts/crud-demo.sh        # 18-check CRUD + 40-read round-robin + shared DB demo
bash scripts/lb-test.sh          # 14-check discovery + load balancing + live failover (-Replicas)
python scripts/security-probes.py  # 37-check live security & rubric probe suite
```

The smoke test (`33 checks`) covers the PRD's section 9.3 scenarios: unauthenticated rejection, login
for both roles, forged-token rejection, the farmer/admin authorisation split, device registration,
telemetry ingestion including out-of-range rejection, health scoring from live telemetry, cross-service
trend retrieval through Eureka, manual valve control, emergency stop, schedule CRUD, climate analytics
(`/api/climate/history`), crop recommendations (`/api/recommendations/score`), all 7 API services
registered in Eureka, 15-min token TTL, refresh rotation, exact-match public auth paths, direct-to-service
bypass rejection, OWASP headers, `X-Request-Id`, rate-limit headers, `no-store`, 1 MB body cap, 6 route
circuit breakers, and logout revocation taking effect at the gateway.
`AgriTech_Fast_Test.postman_collection.json` adds **84 requests across 14 folders** (86 executed incl.
2 auto-login prerequests, **124 assertions** in `postman collection run`), and the companion Next.js 16
frontend checkout (`:5000`, `c:\Users\anjan\Downloads\SOA-Hackthon\frontend`) runs **69 Vitest + 51 Playwright** tests.

Give the services ~30 seconds after startup before the first cross-service call — that is Eureka's
registry-fetch interval, and until it completes the gateway has no route targets. Know this before the
demo, because a 502/503 in the first few seconds is expected behaviour and not a bug.

---

# Part II — Rubric-by-rubric notes

## Rubric 1 — Problem Analysis and Requirement Specification

**The ladder.** 0 no understanding · 2 limited understanding · 5 basic understanding · 7 good analysis
and well-defined requirements · 10 deep analysis and complete structure.

### What "complete structure" is actually testing

Rows scored on *structure* are marked off a checklist. For a requirement specification the examiner's
mental checklist is almost always:

1. A problem statement with a **quantified cost**, not a topic
2. Named stakeholders with **different** needs
3. Numbered, **testable** functional requirements
4. Non-functional requirements expressed as **measurable targets**
5. Explicit scope boundary — what is deliberately *not* being built
6. Constraints and assumptions
7. A **traceability matrix** linking each requirement to the artifact that satisfies it

Most student submissions do 1–4 and stop. Items 5, 6 and 7 are what separates 7 from 10 — and your
project is unusually well-positioned for them, because you already have the raw material.

### What your project already does

You have real, citable evidence for all seven items in `docs/AGRITECH_PRD.md`, `docs/survey/farmer-survey.md`, and `README.md`:

| Checklist item | Evidence already in the repo |
| --- | --- |
| Quantified problem | `docs/AGRITECH_PRD.md` section 1: 70 % global agricultural freshwater withdrawals, 35–40 % flood/furrow efficiency, 3 quantified losses, and DTI survey instrument (`docs/survey/farmer-survey.md`). |
| Distinct stakeholders | `docs/AGRITECH_PRD.md` section 2: 5 personas (`FARMER`, `ADMIN`, IoT device, platform operator, evaluator), enforced via `CallerContext` (`ADMIN`, `FARMER`, `SERVICE`). |
| Numbered FRs | `docs/AGRITECH_PRD.md` section 5.2 defines `FR-1`..`FR-12`, matching inline code annotations (`JwtService`, `CallerContext`, `SensorController`, `TelemetryController`, `CropController`, `IrrigationController`, `ValveController`). |
| Sectioned spec | Code comments cite `PRD 5.1`, `PRD 5.2`, `PRD 5.4`, `PRD 7.1` routing, `PRD 7.2` rate limits, `PRD 7.3` error envelope, `PRD 8.1`/`8.2` discovery/LB, `PRD 9.3` test scenarios, `PRD 16` Phase 2+. |
| Explicit non-goals | `docs/AGRITECH_PRD.md` section 15 ("Scope boundaries and architectural debt") and `README.md` ("Deliberate simplifications") document cut corners, ceilings, and upgrade paths alongside `ponytail:` comments. |
| Measurable NFRs | `docs/AGRITECH_PRD.md` section 6: `p50 18–28 ms` / `p95 38–47 ms` gateway latency (`n = 450`), `15 min` access TTL, `30-day` refresh TTL, `100/1000/100 req/min` tiers, `1 MB` payload cap, `30 s` heartbeat, `90 s` eviction, `15 min` offline threshold, `20 %` battery threshold, `48 h` forecast horizon, WCAG AA `4.5:1` contrast (worst case `4.63:1`). |
| Traceability & tests | `docs/AGRITECH_PRD.md` section 14 maps `FR-1`..`FR-12` and `NFR-1`..`NFR-8` to code and **95 `@Test` methods across 17 test classes** (10 Maven modules) plus live verification scripts and 84 Postman requests. |

### The traceability matrix (aligned with `docs/AGRITECH_PRD.md` §14)

| Req | Requirement | Where satisfied | Verifiable by |
| --- | --- | --- | --- |
| FR-1 | Issue a 15 min HS256 JWT + DB-backed rotating 30-day refresh token + `jti` revocation | `auth-service/.../JwtService.java`, `AuthService.java`, `TokenStore.java`, `AuthController.java`, `JwtAuthFilter.java`, `RevocationCache.java` | `JwtAuthFilterTest` (8), `AuthControllerWebTest` (7), `AuthServicePersistenceTest` (6), smoke test |
| FR-2 | Role separation (`ADMIN` / `SERVICE` vs `FARMER`) and `farmId` multi-tenant isolation | `common/.../CallerContext.java`, `common/.../InternalAuth.java` | `CallerContextTest` (8), `InternalAuthTest` (10), `SensorControllerTenantTest` (8), `B01`–`B12` probes |
| FR-3 | Register, update, list (paginated), and decommission sensors | `sensor-service/.../SensorController.java`, `SensorDevice.java` | `SensorControllerTenantTest` (8), smoke test, Postman |
| FR-4 | Bulk telemetry ingestion with independent per-item validation and tenant check; 1h..90d history | `sensor-service/.../TelemetryController.java` | Smoke test (`accepted=0` on 812 % moisture), `B10` probe, Postman |
| FR-5 | Crop CRUD and 0–100 health scoring (50/30/20 weighted) with trend series | `crop-service/.../HealthScore.java`, `CropAnalysisService.java`, `CropController.java` | `HealthScoreTest` (5), `crud-demo.sh` (18 checks), smoke test |
| FR-6 | OPTIMAL/WARNING/CRITICAL alerts and 48 h time-to-irrigation forecast | `crop-service/.../HealthScore.java`, `CropController.alerts` | `HealthScoreTest` (5), Postman |
| FR-7 | DAILY/WEEKLY irrigation schedules with `skipIfMoist` and active toggle | `irrigation-service/.../IrrigationController.java`, `IrrigationScheduler.java` | `IrrigationSchedulerTest` (4), smoke test |
| FR-8 | Valve CRUD, bounded 1–240 min open, moisture ceiling cut-off, emergency stop | `irrigation-service/.../ValveController.java`, `ValveService.java` | Smoke test, Postman |
| FR-9 | Inter-service collaboration through Eureka service IDs (`@LoadBalanced`) | `SensorClient.java`, `ClimateServiceClient.java`, `RecommendationServiceClient.java`, `FarmClient.java` | Smoke test, `lb-test.sh` (14 checks) |
| FR-10 | Federated Google sign-in via Supabase `/auth/v1/user` introspection | `auth-service/.../SupabaseVerifier.java`, `AuthController.google` | `SupabaseVerifierTest` (7) |
| FR-11 | Authenticated `/api/farm/**` property registration, `FarmSimulation`, and IST daily reports | `crop-service/.../FarmController.java`, `FarmService.java`, `ReportBuilder.java`, `sensor-service/.../FarmSimulation.java` | `PropertyRegistrationTest` (4), `ReportBuilderTest` (12), `FarmSimulationTest` (5), Postman |
| FR-12 | Historical climate analytics (`/api/climate/**`) and 48-crop recommendations (`/api/recommendations/**`) | `climate-service/.../ClimateController.java`, `recommendation-service/.../RecommendationController.java` | `ClimateStatisticsTest` (2), `CropRecommendationServiceTest` (3), smoke test, Postman |
| NFR-1..8 | Latency, rate limits, 6 circuit breakers, `GET` Retry, Eureka `lb://`, edge+HMAC security, WCAG AA, 1 MB cap | `api-gateway`, `common`, `eureka-server`, `docs/AGRITECH_PRD.md` §6 & §14 | 54 security/tenant tests + `RouteRetryConfigTest` (1) + 37 `security-probes.py` + 33 `smoke-test.sh` |

### Verification status and remaining items

| Item | Status in current codebase | Notes |
| --- | --- | --- |
| `docs/AGRITECH_PRD.md` + `docs/survey/farmer-survey.md` | **Present** | Covers quantified problem, 5 personas, DTI stages, FR-1..FR-12, NFR-1..NFR-8, Mermaid use cases, traceability matrix (§14), scope boundaries (§15), Phase 2+ (§16). |
| Measurable NFR targets | **Present** | Latency (`p50 18–28 ms`, `p95 38–47 ms`), rate tiers (`100/1000/100`), timeouts, 1 MB cap, WCAG AA contrast (`4.63:1` worst case). |
| Multi-tenant `farmId` model | **Implemented** | `CallerContext` scopes every tenant resource (`404` on cross-tenant IDs); per-farm `FARM_ADMIN` role is explicitly scoped as Phase 2+ (§16). |
| Unit & integration test suite | **Implemented (95 tests / 17 classes)** | Covers `JwtAuthFilterTest`, `RouteRetryConfigTest`, `InternalAuthTest`, `CallerContextTest`, `ApiExceptionHandlerTest`, `SensorControllerTenantTest`, `AuthControllerWebTest`, `AuthServicePersistenceTest`, `ReportBuilderTest`, `HealthScoreTest`, `PropertyRegistrationTest`, `ClimateStatisticsTest`, `CropRecommendationServiceTest`, `IrrigationSchedulerTest`, and more. |
| Survey field collection | **Human step remaining** | `docs/survey/farmer-survey.md` includes the 16-question instrument and demo sample (`n = 30`); replace demo figures with live farmer responses as collected. |

## Rubric 2 — Microservice Identification and Service Discovery

**The ladder.** 0 not identified · 2 few services defined · 5 basic service split · 7 well-structured
services · 10 highly modular design.

### What "highly modular" is actually testing

Three questions decide this row: *why do these boundaries exist*, *does each service own its data*, and
*can one service change or scale without touching the others*. If your decomposition story is "the
tutorial had these folders", you are at 5. If it is "each boundary is a business capability with its own
data and its own scaling profile", you are at 10.

### What your project does — the decomposition story

You have **six domain services plus three infrastructure/shared modules** (`api-gateway`, `eureka-server`,
and `common` — 9 child Maven modules in `pom.xml`), and the boundaries are drawn on distinct scaling,
ownership, and security axes:

| Service | Business capability | Owns | Scaling driver | Change cadence |
| --- | --- | --- | --- | --- |
| `auth-service` | Identity and access | `User`, `StoredToken` (`auth_service`) | login bursts, low per-request cost | low — security code stays stable |
| `sensor-service` | Device telemetry & simulation | `SensorDevice`, `TelemetryReading`, `FieldWatering` (`sensor_service`) | **write volume** — scales with device count | low |
| `crop-service` | Agronomic analysis & farm facade | `Crop`, `HealthSnapshot`, `FarmProperty`, `DailyReport`, etc. (`crop_service`) | **CPU** — scoring, reports, orchestration | high — rules evolve often |
| `climate-service` | Historical weather & climate indices | stateless (Open-Meteo + cache) | **external API latency / caching** | medium |
| `recommendation-service` | Crop ranking & reference catalog | `CropReference` (`recommendation_service`) | **CPU** — multi-factor scoring across 48 crops | medium |
| `irrigation-service` | Actuation | `IrrigationSchedule`, `Valve`, `IrrigationEvent` (`irrigation_service`) | low volume, **safety-critical** isolation | medium |

**Service dependencies — synchronous, through Eureka service-ids**

```
   Dashboards:  frontend :5173 (Vite)  |  web :3000 (Next.js 16)
                                  |
                                  v
   +-----------------------------------------------------------------------+
   |                        api-gateway :8080                              |
   |  RequestId, JWT verify, HMAC sign, rate limit, CircuitBreaker, Retry  |
   +----+------------+-------------+-------------+-------------+-----------+
        v            v             v             v             v
   auth-service  sensor-service  crop-service  climate-svc  recommendation-svc
      :8081      :8082/:18082    :8083/:18083    :8086          :8087
                     ^               | ^           ^              ^
                     |               | +-----------+--------------+
                     |               v
                     +------- irrigation-service :8084/:18084

   All 7 Spring Boot services register with eureka-server :8761 (30s heartbeat, 90s eviction)
   common (shared JAR) = ApiExceptionHandler + CallerContext + InternalAuth + Secrets + OpenApiConfig
```

Every synchronous service-to-service call, with its purpose:

| Caller | Callee | Call | Why |
| --- | --- | --- | --- |
| Dashboards | api-gateway | `/api/**` | All UI traffic; one origin, no preflight |
| api-gateway | auth-service | `GET /api/auth/revoked`, polled every 15 s (HMAC `SERVICE`) | Revoked token ids |
| crop-service | sensor-service | `/api/telemetry/**`, `/api/sensors/**` (`SensorClient`) | Averaged telemetry, series, farm kit provisioning |
| crop-service | climate-service | `GET /api/internal/climate/history` (`ClimateServiceClient`) | Open-Meteo historical retrieval & ET0/risk indices |
| crop-service | recommendation-service | `POST /api/internal/recommendations/score` (`RecommendationServiceClient`) | Ranked 48-crop recommendations per property |
| irrigation-service | crop-service | `GET /api/crops/{id}/health` (`FarmClient`) | Decide whether to skip a run (`skipIfMoist`) |
| irrigation-service | sensor-service | `POST /api/telemetry/field/{id}/irrigation-event` (`FarmClient`) | Signal that a zone is watering |

The dependency graph is **acyclic**, and there are no hardcoded localhost ports in any route or client.

Note the one infrastructure edge: `api-gateway -> auth-service` for the revocation list (`RevocationCache`).
Rather than share a database across services, the gateway polls a read-only endpoint signed with the `SERVICE`
HMAC identity; the Phase 2 upgrade is a shared Redis revocation set (`README.md` / PRD §15).

Say this in the room: *the split is not by screen, it is by scaling profile and by blast radius.*
Sensor-service scales with device writes; crop-service scales with analysis CPU and orchestrates property
workflows; climate-service isolates external Open-Meteo I/O without touching any DB; recommendation-service
isolates crop-ranking weights and reference data; irrigation-service is safety-isolated so a bad deploy in
analytics cannot actuate a valve.

**Data ownership is real.** Each stateful service owns its own dedicated PostgreSQL schema (`auth_service`,
`sensor_service`, `crop_service`, `recommendation_service`, `irrigation_service`; `climate-service` is
stateless) with Flyway migrations on `auth_service` (`V1`), `crop_service` (`V1`–`V4`), and
`recommendation_service` (`V1`), and persistent H2 file fallback (`AUTO_SERVER=TRUE;DATABASE_TO_LOWER=TRUE`)
when `DB_URL` is unset. There is no shared database and no cross-service foreign key. When `crop-service`
needs soil moisture, it calls `sensor-service` via Eureka — it never reads sensor tables.

### Service discovery — the actual mechanics

This is where you can clearly out-score the cohort, because you can show the config rather than describe
the concept.

**Server.** `@EnableEurekaServer` on port 8761 (`eureka-server`).

**Clients.** Every service carries `spring-cloud-starter-netflix-eureka-client` and registers via
config — no `@EnableDiscoveryClient` annotation is needed on the Spring Cloud 2023 line, and the
dependency plus these keys do the work:

```yaml
eureka:
  client:
    service-url:
      defaultZone: ${EUREKA_URL:http://localhost:8761/eureka}
  instance:
    prefer-ip-address: true
```

`prefer-ip-address: true` matters: it makes the registry hand back an IP rather than a reverse-DNS
hostname, which is what lets the stack run on a laptop without a DNS server.

**Consumers use logical names, never hostnames.** Gateway routes resolve through the registry:

```yaml
- id: sensor-service
  uri: lb://sensor-service
  predicates:
    - Path=/api/sensors/**,/api/telemetry/**
```

Inter-service clients do the same with a `@LoadBalanced` `RestTemplate` (backed by `spring-retry`) and
`WebClient` — `SensorClient` calls `http://sensor-service/...`, `ClimateServiceClient` calls
`http://climate-service/...`, `RecommendationServiceClient` calls `http://recommendation-service/...`,
`FarmClient` calls `http://crop-service/...` and `http://sensor-service/...`, and `RevocationCache` calls
`http://auth-service/...`. **There is not a single hardcoded `localhost:808x` in any route or client in
the codebase.**

**Load balancing.** `lb://` URIs are round-robined across healthy instances, which is the PRD 8.2
requirement. Start with `.\scripts\stack.ps1 start -Replicas` to run two instances each of
`sensor-service` (`:8082`/`:18082`), `crop-service` (`:8083`/`:18083`), and `irrigation-service`
(`:8084`/`:18084`), then run `bash scripts/lb-test.sh` (14 checks) and `bash scripts/crud-demo.sh` (18 checks).

**Registry timings to quote:** 30 s heartbeat, 90 s eviction, 30 s client registry fetch. The last one is
the reason a fresh stack can return 502/503 for the first ~30 seconds — quote it as a *known trade-off of AP
eventual consistency in Eureka* rather than as a bug.

> **Note — The theory sentence that lifts this row**
>
> Eureka is an AP system in CAP terms: it prefers availability and partition tolerance over a strongly
> consistent registry view. That is the correct choice for service discovery, because routing to an
> instance that just died is recoverable with a retry, whereas refusing to route at all is not. The 30 s
> registry-fetch interval is the visible price of that choice.

### Status of modularity improvements and remaining scope

| Item | Status | Notes / Remaining path |
| --- | --- | --- |
| Gateway Resilience4j & `Retry` | **Implemented** | All 6 API routes place Resilience4j `CircuitBreaker` + `/fallback/{service}` (503 + `Retry-After: 10`) outside a `GET` `Retry` (`2` retries on `java.io.IOException` and `PrematureCloseException`, verified by `RouteRetryConfigTest`); `crop-service` and `irrigation-service` also enable `spring-retry` on `@LoadBalanced RestTemplate` (`lb-test.sh` proves live `:18082` kill failover 20/20 + 6/6). Only `SensorClient` catch-block circuit breaking remains a `ponytail:` note. |
| PostgreSQL schemas + Flyway | **Implemented** | Dedicated PostgreSQL schemas (`auth_service`, `sensor_service`, `crop_service`, `recommendation_service`, `irrigation_service`) via `scripts/db-setup.ps1`, Flyway on `auth`/`crop`/`recommendation`, persistent H2 file fallback with `DATABASE_TO_LOWER=TRUE`. (`sensor`/`irrigation` still use `ddl-auto: update`). |
| Secret defaults removed | **Implemented** | `Secrets.java` and `GatewaySecrets.java` fail fast at startup if `AGRITECH_JWT_SECRET` or `AGRITECH_INTERNAL_SECRET` is missing, `< 32` chars, or matches old repo defaults; `stack.ps1` generates per-env secrets into `.env`. |
| Shared domain kernel | **Open debt** | `CropCatalog`, `ClimateStatistics`, and `PublicWeatherClient` are currently duplicated across services (`crop-service`, `climate-service`, `recommendation-service`); extract to a shared non-servlet library module. |
| Eureka registry auth (`H4`) | **Open (accepted for local demo)** | `:8761/eureka/apps` is unauthenticated on localhost; add HTTP Basic auth before network exposure. |
| Event-driven analysis | **Phase 2 roadmap** | Health analysis polls every 5 minutes; Kafka decoupling between telemetry ingest and crop scoring is scoped in PRD §15–16. |
| Distributed tracing / containers | **Phase 2 roadmap** | `X-Request-Id` correlation is implemented; Micrometer Tracing + Zipkin and Docker Compose / Kubernetes manifests remain Phase 2 non-goals (PRD §16). |

## Rubric 3 — JWT Authentication

**The ladder.** 0 not implemented · 2 partial setup · 5 basic authentication · 7 secure implementation ·
10 robust and secure.

### What "robust and secure" is actually testing

7 means the token works and is verified. 10 means the *lifecycle* is handled — issuance, expiry, refresh,
revocation, role propagation, key management, and the attack surface — and that you can name the threats
you defended against. Expect to be pushed on: replay, forged roles, token leakage, algorithm confusion,
and what happens between logout and the next poll.

### What your project does

**Issuance.** `auth-service` verifies credentials with `UserRepository.findByEmail` plus
`BCryptPasswordEncoder.matches` (timing-equalized with a per-startup `dummyHash` so unknown emails
do not fail faster), then mints a signed token strictly after DB commit:

```java
// auth-service/.../JwtService.issue()  — FR-1
Jwts.builder()
    .setId(UUID.randomUUID().toString())   // jti — the revocation handle
    .setSubject(user.getEmail())           // sub
    .claim("role", user.getRole())
    .claim("farmId", user.getFarmId())
    .claim("name", user.getDisplayName())
    .setIssuedAt(now)
    .setExpiration(new Date(now.getTime() + accessTtlMs))
    .signWith(key, SignatureAlgorithm.HS256)
    .compact();
```

| Claim | Value | Why it is there |
| --- | --- | --- |
| `jti` | random UUID | Lets a stateless token be individually revoked |
| `sub` | email | Stable user identity |
| `role` | ADMIN / FARMER | Drives authorisation without a DB round-trip (`register` always pins `FARMER`) |
| `farmId` | e.g. `FARM-001` or `FARM-xxxxxxxx` | Tenant scoping (`CallerContext.requireAccess` / `scopeListFilter`) |
| `name` | display name | UI only |
| `iat` / `exp` | issued / expiry | **15 min** TTL (`agritech.jwt.access-ttl-minutes: 15`, `expiresIn: 900`) |

**Validation happens in exactly one place.** `JwtAuthFilter` is a `GlobalFilter` at order `-100`. It
short-circuits `OPTIONS` and public paths, parses the bearer token using `GatewaySecrets.require("AGRITECH_JWT_SECRET", ...)`,
checks the revocation cache, strips client identity/signature headers, and signs verified ones via `GatewaySigner`:

```java
static final Set<String> PUBLIC_PATHS = Set.of(
        "/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/google",
        "/actuator/health", "/fallback", "/swagger-ui.html",
        "/auth-service/v3/api-docs", "/sensor-service/v3/api-docs",
        "/crop-service/v3/api-docs", "/irrigation-service/v3/api-docs",
        "/climate-service/v3/api-docs", "/recommendation-service/v3/api-docs");
```

```java
private ServerHttpRequest forward(ServerHttpRequest request, String email, String role, String farmId) {
    return request.mutate().headers(h -> {
        IDENTITY_HEADERS.forEach(h::remove);   // strips X-User-Email/Role/Farm-Id and X-Gateway-*
        signer.apply(h, email, role, farmId);  // sets identity + X-Gateway-Timestamp + X-Gateway-Signature
    }).build();
}
```

> **Do this — The detail that proves you understand the design**
>
> Client-supplied `X-User-*` and `X-Gateway-*` headers are removed on **every** request (including public
> paths) before verified values are written and HMAC-signed by `GatewaySigner`. Downstream, `common/InternalAuth`
> verifies that HMAC signature with constant-time `MessageDigest.isEqual` and a 60 s timestamp window on every
> `/api/**` request — rejecting direct port calls (e.g. `:8082`) with `401 untrusted_caller`.

**Authorisation & multi-tenancy.** Downstream, `common/CallerContext.requireAdmin()` throws a 403 `ApiException`
unless `X-User-Role` is `ADMIN` (`isPrivileged` allows `ADMIN` and peer `SERVICE` calls). Missing role
defaults to `FARMER` (fail-closed to the lower privilege). `CallerContext.requireAccess` and `scopeListFilter`
enforce tenant `farmId` isolation (returning `404` on cross-tenant IDs to block enumeration).

**Refresh and revocation.** Access token TTL is **15 minutes** (`access-ttl-minutes: 15`). Refresh tokens
are opaque UUIDs persisted in `auth_service.stored_tokens` via `TokenStore` (`StoredTokenRepository`) with
a 30-day TTL and atomic pessimistic-lock single-use rotation (`findByIdForUpdate`) at `POST /api/auth/refresh`.
`POST /api/auth/logout` revokes both the access token's `jti` and the refresh token (`{refreshToken}`),
and `DELETE /api/auth/me` drops all refresh tokens and revokes the presenting `jti`. The gateway learns
about revocations by polling `lb://auth-service` `/api/auth/revoked` (HMAC-signed as `SERVICE`) every 15 s
(`RevocationCache`, `agritech.jwt.revocation-poll-ms`).

**Federated Google login.** The frontend performs OAuth through `supabase-js`; the resulting Supabase token
is posted to `POST /api/auth/google`; `SupabaseVerifier` **introspects** it by calling
`{SUPABASE_URL}/auth/v1/user` rather than verifying it locally; first-time users are auto-provisioned as
`FARMER` on `FARM-001`; and the platform then issues its *own* internal 15-min JWT, so the rest of the system
is completely unaware that Google was involved.

That last point is the answer to "why not just use the Supabase token everywhere?". Internal tokens carry
`role` and `farmId`, keep the gateway's verification path single and fast, and let you swap identity
providers without touching five business services.

> **Warning — There is a real technical reason behind the introspection — use it**
>
> An earlier version of `SupabaseVerifier` verified Supabase tokens locally with the legacy HS256 JWT
> secret (the `.bak` files at the repo root still hold it). Supabase moved to ES256/JWKS-signed tokens, so
> local HS256 verification began returning 401. Introspecting `GET /auth/v1/user` works regardless of the
> signing algorithm.

**Tested.** `auth-service` runs 20 tests (`AuthControllerWebTest` 7, `AuthServicePersistenceTest` 6,
`SupabaseVerifierTest` 7), `api-gateway` runs `JwtAuthFilterTest` (8), and `common` runs `InternalAuthTest`
(10) and `CallerContextTest` (8) — plus `SensorControllerTenantTest` (8) in `sensor-service`.

### Threat model — verified controls and remaining trade-offs

| Threat | Status | Evidence |
| --- | --- | --- |
| Password disclosure & timing enumeration | **Defended** | BCrypt hashes + per-startup `dummyHash` timing equalization (`AuthService`, `A08` probe) |
| Self-registration role escalation | **Defended** | `AuthService.register` ignores caller `role`, always pins `FARMER` + unique `FARM-xxxxxxxx` (`AuthControllerWebTest`, `A02` probe) |
| Forged role via header injection | **Defended** | `IDENTITY_HEADERS.forEach(h::remove)` on all requests before `GatewaySigner.apply(...)` (`JwtAuthFilterTest`, `A09` probe) |
| Direct service bypass (`:8082` etc.) | **Defended** | `InternalAuth` constant-time HMAC-SHA256 verification (`<= 60 s` skew) rejects unsigned/forged calls with `401 untrusted_caller` (`InternalAuthTest` 10 tests, `H01`/`H02` probes) |
| Cross-tenant IDOR / data leakage | **Defended** | `CallerContext.requireAccess` (`404`), `scopeListFilter`, `TelemetryController.canIngest` (`CallerContextTest` 8, `SensorControllerTenantTest` 8, `B01`–`B12` probes) |
| Unsigned / tampered token replay | **Defended** | `parseClaimsJws` with `SecretKey` throws on mismatch; `JwtException` → 401 `invalid_token` (`JwtAuthFilterTest`, `A03`/`A04` probes) |
| Long-lived access token leakage | **Defended** | Shortened to **15 min** (`access-ttl-minutes: 15`) with DB-backed single-use rotating refresh tokens (`findByIdForUpdate`, `A07` probe) |
| Weak / committed signing secrets | **Defended** | Defaults removed; `Secrets.java` & `GatewaySecrets.java` fail startup if missing, `< 32` chars, or matching old defaults; `stack.ps1` generates random keys into `.env` |
| Stolen-but-valid token after logout | **Partly defended** | `jti` persisted in `auth_service.stored_tokens`, but gateway poll leaves up to a 15 s window (`RevocationCache`) — documented upgrade is shared Redis |
| `alg: none` / algorithm confusion | **Defended by construction** | `parseClaimsJws` pins a `SecretKey` and HS256 (`JwtAuthFilterTest.unsignedAlgNoneTokenIsRejected`) |
| Symmetric HS256 signing | **Accepted trade-off** | Gateway and auth-service share `AGRITECH_JWT_SECRET`; RS256/ES256 (public key at gateway) is scoped in PRD §15 |
| Token storage in browser | **Accepted demo trade-off** | SPAs store access/refresh tokens in `localStorage`; moving refresh tokens to `HttpOnly` cookies is documented in `SECURITY-AUDIT-2026-10-28.md` (M9) |
| CORS localhost pattern | **Dev-only config** | `allowedOriginPatterns: http://localhost:*` / `127.0.0.1:*` (`H08` verifies foreign origins like `evil.example.com` are rejected 403) |
| Secrets in the working tree | **Checked — clean** | `.gitignore` covers `.env`, `**/.env`, `.env.*.local`; `.env.example` holds placeholders only |

### Remaining hardening items (optional post-demo)

| Priority | Item | Notes |
| --- | --- | --- |
| 1 | Authenticate Eureka (`H4`) & gate `/swagger-ui.html` (`M10`) / `/api/auth/revoked` (`SERVICE` check) | Currently left open for localhost single-host demo |
| 2 | Move `TokenStore` revocation cache to shared Redis | Closes the 15 s `RevocationCache` polling window |
| 3 | Move SPA refresh token to `HttpOnly` cookie (`M9`) | Mitigates XSS refresh theft |
| 4 | Migrate HS256 → RS256/ES256 | Gateway holds verification public key only |

## Rubric 4 — API Gateway Configuration

**The ladder.** 0 not configured · 2 partial routing · 5 basic routing · 7 proper configuration · 10
optimised and secure.

### What "optimised and secure" is actually testing

7 is a working route table. 10 adds the cross-cutting concerns that a gateway exists to own: rate
limiting, resilience, observability, request/response shaping, security headers, and a documented reason
for every line of config. The word *optimised* invites you to talk about the reactive stack, connection
reuse, caching, and load distribution.

### What your project does

**Route table.** Six API routes plus six OpenAPI doc routes, all discovery-resolved (`lb://`), in
`api-gateway/src/main/resources/application.yml`:

| id | uri | predicates / filters |
| --- | --- | --- |
| `auth-service` | `lb://auth-service` | `Path=/api/auth/**` · CircuitBreaker + Retry (`2`, `GET`, `IOException` / `PrematureCloseException`) |
| `sensor-service` | `lb://sensor-service` | `Path=/api/sensors/**,/api/telemetry/**` · CircuitBreaker + Retry |
| `crop-service` | `lb://crop-service` | `Path=/api/crops/**,/api/farm/**` · CircuitBreaker + Retry |
| `climate-service` | `lb://climate-service` | `Path=/api/climate/**` · CircuitBreaker + Retry |
| `recommendation-service` | `lb://recommendation-service` | `Path=/api/recommendations/**` · CircuitBreaker + Retry |
| `irrigation-service` | `lb://irrigation-service` | `Path=/api/irrigation/**,/api/valves/**` · CircuitBreaker + Retry |
| `*-service-docs` (6 routes) | `lb://<service>` | `Path=/<service>/v3/api-docs` · `SetPath=/v3/api-docs` |

Default filters applied to every route: **`SecureHeaders`** (CSP, HSTS, `X-Frame-Options: DENY`,
`nosniff`, `Referrer-Policy`) and **`RequestSize`** (`maxSize: 1MB`, returns 413 on oversized bodies).
HTTP client bounds are `connect-timeout: 2000` ms and `response-timeout: 10s`.

Two deliberate choices worth explaining:

- **`spring.cloud.gateway.discovery.locator.enabled: false`.** Auto-discovery would publish every
  registered service under a `/servicename/**` path, exposing internal services directly. Explicit routes
  act as an allow-list.
- **No `StripPrefix`.** The gateway forwards the path unchanged, and downstream controllers map the full
  `/api/...` path so external and internal contracts stay identical.

**Filter chain, in execution order.**

| Order | Component | Responsibility |
| --- | --- | --- |
| `-200` | `RequestIdFilter` | Assign/propagate `X-Request-Id`, set `Cache-Control: no-store`, write `ACCESS` log with latency |
| `-100` | `JwtAuthFilter` | Verify HS256, check revocation, strip `X-User-*`/`X-Gateway-*`, set & HMAC-sign headers (`GatewaySigner`) |
| `-50` | `RateLimitFilter` | Three-tier fixed-window limiting charging every applicable bucket (strictest wins), emits `X-RateLimit-*` |
| route | `CircuitBreaker` + `Retry` | 2 `GET` retries on `IOException` / `PrematureCloseException`, Resilience4j breaker (`50%` of 10 calls, 10 s open) → `/fallback/{service}` (503 + `Retry-After: 10`) |
| background | `RevocationCache` | Polls `lb://auth-service/api/auth/revoked` every 15 s (HMAC `SERVICE`) |
| error / docs | `GatewayResponses`, `FallbackController`, `springdoc-openapi` | Uniform PRD 7.3 JSON error shape; aggregated Swagger UI at `/swagger-ui.html` |

Auth running *before* rate limiting allows the limiter to key on the verified `X-User-Email` rather
than only on IP. Note also that `RateLimitFilter` charges IP, user, and caller-scoped `X-Device-Id`
buckets simultaneously (strictest wins) and ignores `X-Forwarded-For` unless `trust-forwarded-for: true`.

**Rate limiting, per PRD 7.2.**

| Caller | Key | Limit |
| --- | --- | --- |
| Anonymous | client IP (`trust-forwarded-for: false`) | 100 / min |
| Authenticated | verified `X-User-Email` | 1000 / min |
| Device | `device:<X-Device-Id>:<user|anon>` | 100 / min |

**CORS** is configured at the gateway for `http://localhost:*` and `http://127.0.0.1:*` across all
methods, exposing `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-Request-Id`. In normal dev use
the browser sees one origin (`frontend/vite.config.js` `/api` proxy and `web/next.config.ts` `/api/:path*`
rewrite).

**Observability.** `management.endpoints.web.exposure.include: health,info,gateway,circuitbreakers` —
`/actuator/health` and `/actuator/circuitbreakers` (showing all 6 route breakers) are live (`200`),
`RequestIdFilter` logs every request to `ACCESS`, and `JwtAuthFilter` logs rejected tokens to `AUDIT`
(`audit.warn("auth REJECTED path={} reason={}", ...)`). (Note: Spring Cloud Gateway 4.x disables
`/actuator/gateway/routes` by default, returning 404.)

**Health-gated startup.** `stack.ps1` blocks on each service's `/actuator/health` returning `UP` before
launching the next, so the gateway never starts against an empty registry.

### Status of gateway controls and remaining scope

| Item | Status | Notes / Remaining path |
| --- | --- | --- |
| Circuit breakers & `Retry` | **Implemented** | Resilience4j `CircuitBreaker` + `/fallback/{service}` (`503`, `Retry-After: 10`) + `GET` `Retry` (`2`, `IOException` / `PrematureCloseException`) on all 6 API routes (`RouteRetryConfigTest` 1, `smoke-test.sh` 6 breakers, `lb-test.sh` 20/20 failover). |
| Security response headers | **Implemented** | `SecureHeaders` default filter emits CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`. |
| Payload size cap | **Implemented** | `RequestSize` default filter caps bodies at `1MB` (`smoke-test.sh` verifies 1.1 MB returns 413). |
| Correlation IDs & `no-store` | **Implemented** | `RequestIdFilter` (`-200`) sets `X-Request-Id`, `Cache-Control: no-store`, and `ACCESS` latency logs. |
| Aggregated OpenAPI / Swagger | **Implemented** | `springdoc-openapi` `2.6.0` serves `/swagger-ui.html` across all 6 `/<service>/v3/api-docs` routes. |
| Exact-match public API paths | **Implemented** | `PUBLIC_PATHS` exact match rejects `/api/auth/loginX` (`401`); asset prefixes apply only to `/fallback/`, `/swagger-ui`, `/webjars`, and `v3/api-docs`. |
| In-memory fixed-window counters | **Accepted single-gateway trade-off** | Swap in Redis `RequestRateLimiter` when scaling gateway horizontally (`ponytail:` at `RateLimitFilter.java:39`). |
| Response caching / TLS / Zipkin | **Phase 2 roadmap** | Local dev uses HTTP without response caching; Micrometer Tracing + Zipkin and TLS termination are Phase 2 items. |
| Minor gateway helper sync | **Low-priority cleanup** | `GatewayHealthController` and `NotFoundHandler` / `GlobalErrorWebExceptionHandler` list only the original 4 routes and use `{status,error,path}` on unmatched paths. |

## Rubric 5 — LinkedIn article (out of scope, three lines)

You asked me to skip this. Since it is still a scored row, three sentences: the DTI angle your project
actually supports is *closed-loop automation on live sensor data* — the system decides, actuates, and
re-measures, which is the definition of precision agriculture rather than dashboards. Structure it as
problem → architecture → one concrete water-saving number → what you would do next. Publish it before the
review, not during; "Modules and System Architecture only Present" is a 2, and the article is 10 marks
for an hour of writing.

---

# Part III — Rubric summary, demo script, and file inventory

## The one-page scoring summary

| Rubric | Implemented state today | Evidence in repository |
| --- | --- | --- |
| 1 — Problem analysis and requirements | Complete spec & traceability | `docs/AGRITECH_PRD.md` (`FR-1`..`FR-12`, `NFR-1`..`NFR-8`, §14 traceability, §15 scope boundaries), `docs/survey/farmer-survey.md`, 95 tests / 17 classes |
| 2 — Microservices and discovery | 9 child Maven modules, 6 domain services + Eureka | `pom.xml`, `eureka-server`, PostgreSQL 5-schema isolation + Flyway + persistent H2 fallback, `@LoadBalanced` clients (`SensorClient`, `ClimateServiceClient`, `RecommendationServiceClient`, `FarmClient`), `lb-test.sh` (14 checks) |
| 3 — JWT authentication | Short-lived JWT + zero-trust internal HMAC + tenant isolation | 15-min HS256 JWT, DB-backed single-use refresh rotation, `Secrets`/`GatewaySecrets`, `InternalAuth` HMAC (`60 s`), `CallerContext` multi-tenancy, `scripts/security-probes.py` (37 checks) |
| 4 — API gateway | Hardened reactive gateway | 6 API routes + 6 OpenAPI routes (`/swagger-ui.html`), `RequestIdFilter` (`-200`), `JwtAuthFilter` (`-100`), `RateLimitFilter` (`-50`), `SecureHeaders`, `RequestSize` (`1 MB`), Resilience4j `CircuitBreaker` + `GET` `Retry` + `/fallback/{service}` |

## Completed improvements vs remaining optional work

| # | Item | Status |
| --- | --- | --- |
| 1 | `docs/AGRITECH_PRD.md` + `docs/survey/farmer-survey.md` + FR/NFR traceability matrix + Scope Boundaries | **Done** |
| 2 | 15-min access-token TTL + DB-backed single-use rotating refresh tokens (`TokenStore`) | **Done** |
| 3 | Mandatory >= 32-char non-default signing secrets (`Secrets` / `GatewaySecrets`) + auto-generated `.env` | **Done** |
| 4 | Constant-time HMAC gateway-to-service trust (`InternalAuth` / `GatewaySigner`) + `CallerContext` tenant scoping | **Done** |
| 5 | Resilience4j `CircuitBreaker` + `/fallback/{service}` + `GET` `Retry` on all 6 API routes + `spring-retry` | **Done** |
| 6 | Aggregated `springdoc-openapi` Swagger UI at `/swagger-ui.html` + `SecureHeaders` + `RequestSize` (1 MB) + `X-Request-Id` | **Done** |
| 7 | PostgreSQL multi-schema persistence + Flyway (`auth`, `crop`, `recommendation`) + `DATABASE_TO_LOWER=TRUE` H2 fallback | **Done** |
| 8 | 95 tests across 17 classes + `smoke-test.sh` (33) + `lb-test.sh` (14) + `crud-demo.sh` (18) + `security-probes.py` (37) + Postman (84 reqs / 124 assertions) + companion UI (`69 Vitest + 51 Playwright`) | **Done** |
| 9 | Optional Phase 2 hardening: Eureka HTTP Basic (`H4`), Redis rate limiter/revocation, RS256, Zipkin tracing, Docker/K8s, shared-kernel module | **Scoped in PRD §15–16** |

## Demo script for the review room

Rehearse this in order using `.\scripts\stack.ps1 start -Replicas`.

1. Start the stack (`.\scripts\stack.ps1 start -Replicas`); show `stack.ps1` health-gating each of the 8 services + 3 replicas. *(Rubric 4)*
2. Open Eureka at `http://localhost:8761`; point at the registry showing **7 applications / 10 instances** (`SENSOR-SERVICE` ×2, `CROP-SERVICE` ×2, `IRRIGATION-SERVICE` ×2). *(Rubric 2)*
3. Hit `http://localhost:8080/actuator/circuitbreakers` (6 `CLOSED` breakers) and `http://localhost:8080/swagger-ui.html` (aggregated OpenAPI docs for all 6 services). *(Rubrics 2, 4)*
4. Log in as `farmer@agritech.io`, inspect the 15-min JWT claims (`jti`, `sub`, `role`, `farmId`, `exp`). *(Rubric 3)*
5. As farmer, attempt `POST /api/sensors/register` → `403`. Same call as `admin@agritech.io` → `201`. *(Rubrics 1, 3)*
6. Send a `curl` with `X-User-Role: ADMIN` and no token to `:8080` → `401`; with a farmer token + `X-User-Role: ADMIN` → header stripped, still `403`; and directly to `:8082/api/sensors` with forged headers → `401 untrusted_caller` (`InternalAuth`). *(Rubrics 3, 4)*
7. Ingest an out-of-range reading (`soilMoisture: 812`); show per-item validation rejecting it inside a valid batch (`accepted: 0`). *(Rubric 1)*
8. Show a dry field go critical, open a valve, watch moisture and the health score recover, then watch the zone cut off at the optimal ceiling. *(Rubric 1)*
9. Logout, wait up to 15 s for `RevocationCache` sync, replay the old token → `401 token_revoked`. *(Rubric 3)*
10. Run `bash scripts/smoke-test.sh` (33 checks), `bash scripts/crud-demo.sh` (18 checks), `bash scripts/lb-test.sh` (14 checks + live kill failover), and `python scripts/security-probes.py` (37 checks). *(All rows)*
11. Close on `docs/AGRITECH_PRD.md` §15 Scope Boundaries table: what was traded off for a single-host demo, its ceiling, and its upgrade path. *(Rubric 1)*

## Viva questions you should expect, with the answers

**Why six domain services (seven with the gateway) and not one?** Because the scaling axes and blast radii
differ: `sensor-service` scales with device write volume, `crop-service` scales with CPU and property
orchestration, `climate-service` isolates stateless Open-Meteo API calls, `recommendation-service` owns
48-crop ranking rules, and `irrigation-service` is isolated so an analytics bug cannot physically actuate a valve.

**Why Eureka and not Consul or Kubernetes Services?** Eureka is client-side load balancing with a
locally cached registry, so it survives the registry dying — an AP trade-off that suits discovery. It is
also the reference implementation for the Spring Cloud stack in use.

**Where are the signing keys held?** Separate keys are required at startup via `Secrets` and `GatewaySecrets`
with no repo defaults: `AGRITECH_JWT_SECRET` (shared by `auth-service` to mint 15-min JWTs and `api-gateway`
to verify them) and `AGRITECH_INTERNAL_SECRET` (shared by `api-gateway` and downstream services for
`GatewaySigner`/`InternalAuth`). Business services never parse JWTs; migrating JWTs to RS256/ES256 lets
the gateway hold a public key only.

**How does a downstream service know the role is genuine?** The gateway strips client `X-User-*` and
`X-Gateway-*` headers on every request, sets verified ones, and signs them with HMAC-SHA256
(`X-Gateway-Signature`, `X-Gateway-Timestamp`). Every service's `InternalAuth` filter verifies that
signature with constant-time comparison (`<= 60 s` skew) on all `/api/**` routes, blocking direct-port
spoofing with `401 untrusted_caller`.

**What happens if a service is down when another service or client needs data?** At the gateway, each of
the 6 API routes wraps calls in a `CircuitBreaker` outside a `GET` `Retry` (`2` retries on `IOException`
and `PrematureCloseException`, verified by `RouteRetryConfigTest`) falling back to `/fallback/{service}`
(`503` + `Retry-After: 10`). Inter-service `@LoadBalanced RestTemplate` calls also use `spring-retry`
across Eureka replicas (`lb-test.sh` proves live `:18082` kill failover 20/20 + 6/6), and degrade cleanly
(`SensorClient` returns empty collections; `ClimateServiceClient` / `RecommendationServiceClient` return
explicit `503`).

**Why can the first request after startup fail?** Eureka clients fetch the registry every 30 seconds, so
for up to ~30 seconds a freshly started gateway may have no cached instances. `stack.ps1` health-gates startup
to minimize this.

**Why does the gateway poll auth-service instead of sharing its database?** Because sharing a database
across services would break the data-ownership boundary. A read-only HMAC-signed endpoint keeps the schema
boundary intact at the cost of a 15-second staleness window; shared Redis removes the window without breaking
service ownership.

**What is `skipIfMoist` and why does it need two services?** It is the water-saving rule: do not irrigate
a field already at the optimal ceiling. Optimal ceilings and current health belong to `crop-service`;
authority to open a valve belongs to `irrigation-service`. Separating knowledge from actuation is why the
boundary exists.

## Appendix — file inventory for the report

Cite these verified paths directly in your write-up:

| Claim | File |
| --- | --- |
| PRD, FR-1..FR-12, NFR-1..NFR-8, traceability (§14), scope (§15) | `docs/AGRITECH_PRD.md`, `docs/survey/farmer-survey.md` |
| 9 Maven modules, Spring Boot 3.3.4 / Spring Cloud 2023.0.3 | `pom.xml` |
| Single JWT verification point, header stripping, public paths | `api-gateway/src/main/java/com/agritech/gateway/JwtAuthFilter.java` |
| Route table (6 API + 6 docs), Resilience4j, Retry, CORS, Swagger, actuator | `api-gateway/src/main/resources/application.yml` |
| Correlation ID, `no-store`, `ACCESS` log; 3-tier rate limit; circuit fallback; retry config | `api-gateway/.../RequestIdFilter.java`, `RateLimitFilter.java`, `FallbackController.java`, `RouteRetryConfigTest.java` |
| Fail-fast signing secret validation (no repo defaults) | `common/src/main/java/com/agritech/common/Secrets.java`, `api-gateway/.../GatewaySecrets.java` |
| Zero-trust gateway-to-service HMAC & `SERVICE` interceptor | `common/src/main/java/com/agritech/common/InternalAuth.java`, `api-gateway/.../GatewaySigner.java` |
| Token claims, HS256, 15-min TTL, DB-backed refresh rotation, Google OAuth | `auth-service/.../JwtService.java`, `AuthService.java`, `TokenStore.java`, `AuthController.java`, `SupabaseVerifier.java` |
| Role enforcement (`requireAdmin`), multi-tenancy (`requireAccess`, `scopeListFilter`) | `common/src/main/java/com/agritech/common/CallerContext.java` |
| Uniform error contract & aggregated OpenAPI config | `common/.../ApiExceptionHandler.java`, `OpenApiConfig.java` |
| Device registry, health thresholds, pagination, tenant checks | `sensor-service/.../SensorController.java`, `SensorDevice.java`, `TelemetryController.java`, `DeviceSimulator.java`, `FarmSimulation.java` |
| Health scoring, properties (`/api/farm/**`), daily reports, Flyway `V1`–`V4` | `crop-service/.../HealthScore.java`, `CropController.java`, `FarmController.java`, `FarmService.java`, `ReportBuilder.java` |
| Climate analytics & crop recommendations (`:8086`, `:8087`) | `climate-service/.../ClimateController.java`, `recommendation-service/.../RecommendationController.java` |
| Cross-service Eureka clients (`@LoadBalanced`) | `crop-service/.../SensorClient.java`, `ClimateServiceClient.java`, `RecommendationServiceClient.java`, `irrigation-service/.../FarmClient.java` |
| Valve bounds, cut-out, emergency stop, schedules | `irrigation-service/.../ValveController.java`, `IrrigationController.java`, `IrrigationScheduler.java` |
| Startup order, secret generation, replica orchestration, PostgreSQL setup | `scripts/stack.ps1`, `scripts/db-setup.ps1`, `.env.example` |
| Automated verification (95 tests/17 classes, 33 smoke, 18 CRUD, 14 LB, 37 probes, 84 Postman reqs) | `scripts/smoke-test.sh`, `scripts/crud-demo.sh`, `scripts/lb-test.sh`, `scripts/security-probes.py`, `AgriTech_Fast_Test.postman_collection.json` |
| Architecture, complete API tables, frontends (`frontend/` & `web/`), simplifications | `README.md` |
