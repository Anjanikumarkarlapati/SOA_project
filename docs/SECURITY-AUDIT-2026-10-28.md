# AgriTech Sensing Solutions — Security & Rubric Audit

**Date:** 28 October 2026
**Audited:** `SOA-Hackthon` @ `cd6b1cc` + uncommitted working tree
**Method:** static review of all 95 Java sources, then **live exploitation against the running
stack** (11 instances, Eureka + gateway + 6 services + 3 replicas), then fixes, then re-exploitation.
**Harness:** `scripts/security-probes.py` — 37 executable checks, re-runnable by anyone.
**Evidence:** `docs/audit-evidence/probes-before.txt`, `docs/audit-evidence/probes-after.txt`,
`docs/audit-evidence/probes-after.json` (the before-run text is complete; its JSON was never written
because that first run stopped on a harness bug part-way through).

---

## 1. Bottom line

The architecture was genuinely good. The security layer underneath it was not: **three of the four
things an evaluator will test on the "JWT Authentication" row were broken, and one of them handed
administrator control of every farm's irrigation valves to any anonymous visitor.** All of it was
exploitable over HTTP on the running stack — not theoretical.

Every Critical and High finding is now fixed and re-verified live. **17 failing checks → 1 failing
check**, and that one is a documented, accepted risk for a single-machine demo.

| | Before | After |
|---|---|---|
| Probe checks passing | 15 / 32 (run crashed early) | **36 / 37** |
| Automated tests passing | 72 (12 could not start at all) | **92** |
| Anonymous ADMIN escalation | Exploitable | Blocked |
| Token forgery with repo secret | Exploitable | Blocked |
| Cross-tenant data access | 10 endpoints | Blocked |
| Fresh-database startup | **Failed** | Works |

### Rubric scorecard (my assessment, with blockers named)

Review 1:

| Rubric row | Before | Now | What was blocking 10 |
|---|---|---|---|
| Problem analysis & requirements | not assessed | not assessed | `docs/AGRITECH_PRD.md` exists; document depth was out of scope for this audit |
| Microservice identification & service discovery | 9 | 9 | `CropCatalog` / `ClimateStatistics` / `PublicWeatherClient` are forked across services — a shared-kernel module would close it |
| JWT authentication | **3** | **9** | SPA keeps tokens in `localStorage`; revocation is a ~15 s poll, not instant |
| API gateway configuration | 9 | 9.5 | rate limiter is per-instance in memory; no distributed tracing |
| LinkedIn article with DTI concepts | not assessed | not assessed | draft present at `linkedin-article/AgriTech_LinkedIn_Article_final.md`; publishing is a human step |

Second rubric table:

| Rubric row | Before | Now | What was blocking 10 |
|---|---|---|---|
| Microservice service implementation | 8 | **9** | same shared-kernel duplication; telemetry is append-only by design |
| JWT authentication | **3** | **9** | as above |
| CRUD operations with load balancing | 7 | **9** | load balancing is proven; Crop/Valve/Account CRUD now complete — remaining gap is untested HTTP slices |
| MooC completion | — | — | not a code artefact; cannot be verified from this repository |

---

## 2. Critical findings (all fixed and re-verified)

### C1 — Any anonymous visitor could become administrator  ✅ fixed

`POST /api/auth/register` accepted a caller-supplied `role`. It validated only that the value was
`ADMIN` or `FARMER` (`AuthController.java:52-59`), then persisted it. The endpoint is on the
gateway's public path list, so no token was needed.

```
POST /api/auth/register {"email":"...","password":"...","role":"ADMIN"}  → 201, token role=ADMIN
```

That session reaches `POST /api/valves/{id}/open`, `/close`, `/emergency-stop`,
`DELETE /api/sensors/{id}` and all schedule CRUD — i.e. **physical control of every farm's
irrigation**. Live-confirmed before the fix (probe `A02`).

**Fix:** `role` is no longer a parameter of `AuthService.register` — the escalation is now
unrepresentable in the type system, not merely filtered. `CallerContext.FARMER_ROLE` is pinned. The
SPA's "Administrator" signup button was removed so the UI no longer promises something the API
won't do. Regression test: `AuthControllerWebTest.registeringWithRoleAdminStillYieldsFarmer…`.

**Verified:** `A02 → SECURE: registered with role=ADMIN → issued token role=FARMER`.

### C2 — Tokens were forgeable with a secret published in the repository  ✅ fixed

Both signing secrets had committed fallbacks, and neither was set in `.env`, so **the running stack
was using them**:

| Secret | Where the default lived |
|---|---|
| `agritech-dev-secret-key-change-me-in-production-0123456789` | `auth-service/application.yml:34`, `api-gateway/application.yml:183` |
| `agritech-internal-dev-secret-change-me-0123456789` | `InternalAuth.java:37`, `GatewaySigner.java:25` |

The first lets anyone mint `{"role":"ADMIN","sub":"anyone@agritech.io"}` and walk in through the
gateway. The second defeats the zero-trust layer entirely: the gateway signs the identity headers it
forwards and every service verifies that signature, but an attacker who knows the key can produce
the signature themselves and talk to `:8082` directly, impersonating `SERVICE`.

Both were live-confirmed (`A03`: forged token → `200`; `H01`: forged HMAC straight to port 8082 →
`200` with another farm's devices).

**Fix:** the defaults are gone. `common/Secrets.java` and `api-gateway/GatewaySecrets.java` reject a
missing, sub-32-character, or previously-published value at startup — a service refuses to boot
rather than run on a known key. `scripts/stack.ps1` now generates two strong random secrets into
`.env` on first run (never printed), so the demo still needs zero manual setup. `.env` remains
git-ignored and untracked.

**Verified:** `A03 → 401`, `H01 → 401 untrusted_caller`, plus three new tests asserting the service
refuses to start with no/short/published-default secret.

### C3 — No tenant isolation: every farmer could read and write every farm  ✅ fixed

`farmId` was present in every JWT but almost nowhere in the queries. Ten endpoints returned or
mutated other tenants' data. Representative evidence:

```
GET  /api/crops                          as alice → bob's field in the list      (200)
GET  /api/crops?farmId=FARM-<bob>        attacker-controlled parameter, no check (200)
GET  /api/sensors/{bobDevice}            no CallerContext reference at all       (200)
GET  /api/telemetry/{bobDevice}          full reading history                    (200)
POST /api/telemetry/ingest  {bobDevice}  poisoned another farm's health score    (200)
GET  /api/valves                         every farm's zone states                (200)
```

The worst consequence is the ingest one: injecting a fake 99 % moisture reading into another farm's
probe changes that farm's health score and its irrigation decisions.

`FarmController` already did this correctly (owner-scoped by email) — the rule just hadn't reached
the other services.

**Fix:** one rule in `CallerContext` — `canAccess` / `requireAccess` / `scopeListFilter` /
`isPrivileged` — applied across sensor, telemetry, crop, irrigation and valve. Only `ADMIN` and
`SERVICE` cross the tenant boundary. A foreign object answers **404, not 403**, because 403 confirms
the id exists and invites enumeration.

**Verified:** all twelve `B01`–`B12` checks pass; `SensorControllerTenantTest` (7 tests) and
`CallerContextTest` (8 tests) lock the rule in. The demo is unaffected — `farmer@agritech.io` still
sees its 13 FARM-001 sensors and 4 fields, while an unrelated account now sees 0.

### C4 — The stack could not start on a fresh database  ✅ fixed

This one is not a rubric row, it is a reproducibility killer, and I found it while chasing what
looked like a broken test.

Flyway's `V1` writes unquoted `CREATE TABLE users`. **H2 folds unquoted identifiers to `USERS`;
PostgreSQL folds them to `users`.** Hibernate validates `auth_service.users`, so on H2 the table is
"missing" and the service dies at boot:

```
Flyway: Successfully applied 1 migration to schema "auth_service"
Hibernate: Schema-validation: missing table [stored_tokens]   → auth-service exits 1
```

The stack only worked because `.run/data/*.mv.db` predates this configuration. **A fresh clone on
an evaluator's machine would have failed to start `auth-service` and `recommendation-service`** —
both of which use Flyway + `ddl-auto: validate`. The `.env`-provided PostgreSQL URL masked it.

**Fix:** `;DATABASE_TO_LOWER=TRUE` on every H2 fallback URL, which makes the dev database fold
identifiers the way production PostgreSQL does. Confirmed by starting `auth-service` against a
brand-new H2 file: it now boots and the tables land as `auth_service.users` / `.stored_tokens`.

---

## 3. High findings

**H1 — Rate limiting did not work at all** ✅ fixed. Two independent bugs, found by probing rather
than reading: the gateway forwards an empty-but-present `X-User-Email` for anonymous calls, and
`RateLimitFilter` tested `!= null`, so **every unauthenticated visitor on Earth shared one
`user:` bucket at the 1000/min authenticated quota** — the 100/min public limit never fired, and one
client could exhaust the shared bucket for everyone. Separately, buckets were chosen by
if/else-if precedence, so adding a fresh `X-Device-Id` header bought a new 100/min allowance.
Now every applicable bucket (IP, user, device) is charged and the strictest wins, `X-Forwarded-For`
is ignored unless `agritech.rate-limit.trust-forwarded-for=true`, and device buckets are keyed to
the caller. Verified: `H06` (130 rotating-header requests → 79 rate-limited, was 0), `H07`
(130 anonymous POSTs → 130 rate-limited, was 0).

**H2 — Login answered differently for unknown emails** ✅ fixed. `AuthService.login` short-circuited
before the BCrypt comparison when the user was absent, so account enumeration worked over timing:
**54 ms for a non-existent user vs 259 ms for a real one**. Now exactly one BCrypt runs per attempt
against a per-startup dummy hash. Verified: 204 ms vs 192 ms, a 13 ms delta.

**H3 — Telemetry ingestion had no device binding** ✅ fixed with C3 (per-reading ownership check).

**H4 — Eureka registry is unauthenticated** ⚠️ **open, accepted.** `GET :8761/eureka/apps` answers
`200` with no credentials, so anyone who can reach that port can register a rogue `sensor-service`
instance and the gateway's `lb://` routing will deliver real users' signed identity headers to it.
I deliberately did **not** change this: it needs a security dependency plus credentials threaded
through eight config files and every client URL, and a half-applied registry-auth change takes the
whole demo down. For a single-machine hackathon where port 8761 is not exposed, that trade is
correct — but it must be done before anything is network-reachable. The fix is basic auth on
`eureka-server` plus `defaultZone: http://user:pass@…` in the eight client configs.

---

## 4. Medium and Low

| ID | Finding | Status |
|---|---|---|
| M1 | Crop aggregate had Create+Read only; Valve and User had no Update/Delete — the rubric needs full CRUD | ✅ fixed: `PUT`/`DELETE /api/crops/{id}` (replants or relabels, removes snapshots and the provisioned sensor), `POST`/`PUT`/`DELETE /api/valves/{id}`, `PUT`/`DELETE /api/auth/me` (revokes the session and drops every refresh token) |
| M2 | `stack.ps1` could not find its own jars: `agritech.build.root` defaulted to `${project.basedir}`, which Maven re-interpolates per module, so `mvnw install` wrote to `sensor-service/sensor-service/target/` and the launcher threw `Missing JAR` | ✅ fixed to `${maven.multiModuleProjectDirectory}` |
| M3 | Two of the three auth-service test classes could never start their Spring context (the C4 schema bug), so the auth persistence layer had no live coverage | ✅ fixed; both now run and pass |
| M4 | No graceful shutdown anywhere — rolling restarts dropped in-flight requests, undercutting the failover story | ✅ fixed: `server.shutdown: graceful` + a 20 s phase timeout in all 8 configs |
| M5 | Circuit-breaker Retry filter was configured on 4 of 6 routes; climate and recommendation had no failover to the next Eureka instance | ✅ fixed |
| M6 | Emergency stop required ADMIN, so a farmer could not halt irrigation on their own land | ✅ fixed: privileged callers stop every farm, everyone else stops their own |
| M7 | README claimed real devices post to `/api/telemetry/ingest`, but that path is not public | ✅ corrected to state the bearer-token contract |
| M8 | Seeded `admin@agritech.io/admin1234` are public credentials | ⚠️ kept by design (the demo needs them) but now gated behind `agritech.seed-demo-accounts` and logged as a warning at startup |
| M9 | SPA stores access **and** refresh token in `localStorage`; XSS = account takeover, and the refresh token lives 30 days | ⚠️ open — move refresh to an httpOnly cookie |
| M10 | Public Swagger specs and `/v3/api-docs` are unauthenticated | ⚠️ open — fine for a demo, gate before exposing publicly |
| L1 | `eureka-server/application.yml` comments claim its `eureka.instance.*` lease settings apply to clients; they do not | ⚠️ open, cosmetic |
| L2 | Two error-envelope shapes (gateway adds `status`/`path`/`requestId`) | ⚠️ open, cosmetic |
| L3 | `auth-service` exposes fewer actuator endpoints than its peers | ⚠️ open, cosmetic |

### Two audit suspicions I tested and disproved

Worth recording, because both would have been pointless "fixes":

- **Gateway route-table leak** — `/actuator/gateway/routes` returns `404`. Spring Cloud Gateway
  4.x disables that endpoint by default, so the configured `include: gateway` does not expose it.
- **CORS wildcard with credentials** — a pre-flight from `http://evil.example.com` is refused with
  `403` and no `Access-Control-Allow-Origin`. The `localhost:*` patterns do not echo arbitrary
  origins.

---

## 5. What was already strong

So this reads as a fair assessment and not just a defect list:

- **The gateway↔service trust model is right**, and rare at this level: strip client identity
  headers, re-sign them with HMAC, and have every service fail closed on a missing or stale
  signature with a constant-time comparison. It was undermined only by C2's known key.
- **Refresh-token rotation with reuse detection** — pessimistic `findByIdForUpdate`, single-use,
  logout revokes the `jti` and drops the refresh. Verified live (`A07`: first `200`, replay `401`).
- **`alg:none` and key-family confusion are rejected**, not by hand-rolled checks but by
  `parseClaimsJws` with a `SecretKey`, and it is unit-tested.
- **Load balancing is measured, not asserted.** `scripts/lb-test.sh` counts per-instance
  `http.server.requests` and hard-kills a replica. My own run confirms it: 40 gateway calls served
  by both `:8082` (96) and `:18082` (63), with all 7 apps registered in Eureka.
- **Every route is `lb://SERVICE-NAME`** — zero hardcoded backend host:port anywhere, including
  inter-service clients.
- Token minted strictly after the DB commit; BCrypt; no stack traces; no H2 console; and an honest
  "Deliberate simplifications" table in the README.

---

## 6. Reproducing this

```bash
# 1. build + boot everything (generates .env signing secrets on first run)
./mvnw install -DskipTests
./scripts/stack.ps1 start -SkipBuild -Replicas

# 2. the 37 security & rubric checks  (exit 0 = nothing failing)
python scripts/security-probes.py --json .run/probes.json

# 3. the unit/integration suite (92 tests, 8 modules)
./mvnw test
```

`security-probes.py` is grouped (`--group auth|idor|harden|crud|lb`), creates its own throwaway
tenants, and cleans up after itself. It is safe to run against a live demo.

---

## 7. Recommended order from here

1. **Before anything is network-reachable:** authenticate Eureka (H4), then gate Swagger (M10).
2. **To finish the JWT row:** move the refresh token to an httpOnly cookie (M9) — that plus instant
   revocation is what stands between 9 and 10.
3. **To finish the modularity rows:** extract `CropCatalog`, `ClimateStatistics` and
   `PublicWeatherClient` into a shared non-servlet module; the duplication is the last real objection
   to "highly modular design".
4. **To finish the CRUD row:** add HTTP-layer tests for the sensor/crop/irrigation/valve controllers
   — the authorization logic is now covered, but only at the unit level.
5. Rotate the two signing secrets once more before submission, since the old defaults lived in the
   repository's history.

---

## Appendix — files changed in this pass

**New:** `common/…/Secrets.java`, `api-gateway/…/GatewaySecrets.java`,
`common/src/test/…/CallerContextTest.java`, `sensor-service/src/test/…/SensorControllerTenantTest.java`,
`scripts/security-probes.py`

**Authorization:** `common/…/CallerContext.java`, `sensor-service/…/SensorController.java`,
`…/TelemetryController.java`, `…/Repositories.java`, `crop-service/…/CropController.java`, `…/Crop.java`,
`…/Repositories.java`, `…/SensorClient.java`, `irrigation-service/…/IrrigationController.java`,
`…/ValveController.java`, `…/Valve.java`, `…/Repositories.java`

**Authentication & secrets:** `auth-service/…/AuthController.java`, `…/AuthService.java`,
`…/JwtService.java`, `…/SeedData.java`, `…/User.java`, `…/TokenStore.java`,
`…/StoredTokenRepository.java`, `common/…/InternalAuth.java`,
`api-gateway/…/JwtAuthFilter.java`, `…/GatewaySigner.java`

**Gateway hardening:** `api-gateway/…/RateLimitFilter.java`, `api-gateway/src/main/resources/application.yml`

**Build & ops:** `pom.xml`, `scripts/stack.ps1`, `.env.example`, all 8 `application.yml`
(graceful shutdown, H2 identifier folding, route retry symmetry), `README.md`

**Tests:** `common/…/InternalAuthTest.java`, `auth-service/src/test/resources/application.yml`,
`…/AuthServicePersistenceTest.java`, `…/AuthControllerWebTest.java`,
`api-gateway/src/test/…/JwtAuthFilterTest.java`

**Frontend:** `frontend/src/pages/Login.jsx`, `frontend/src/i18n/en.ts`
