# AgriTech — Live Demo Runbook (SOA rubric: services, JWT, CRUD + load balancing)

Everything runs on **localhost**. No internet, no cloud account needed.

---

## 0. Bring the stack up (one command, ~5 minutes)

```powershell
cd C:\Users\anjan\OneDrive\Documents\SOA-Hackthon
.\scripts\stack.ps1 start -Replicas
npm run dev --prefix frontend
```

`-Replicas` is what makes load balancing demoable: it starts a **second** sensor, crop and
irrigation instance on ports 18082 / 18083 / 18084, registered under the *same* Eureka names.

Check anything with:

```powershell
.\scripts\stack.ps1 status          # 8 services + 3 replicas, each UP
```

### The four browser tabs to have open

| Tab | URL | What you point at |
|-----|-----|-------------------|
| Dashboard | http://localhost:5173 | The product itself — login, live telemetry, CRUD |
| Eureka registry | http://localhost:8761 | **Rubric #1** — service discovery, 2 instances per scaled service |
| API gateway | http://localhost:8080/actuator/health | Gateway alive + circuit breakers |
| Replica counters | http://localhost:8083/actuator/metrics/http.server.requests?tag=uri:/api/crops&tag=method:GET | **Rubric #3** — the number that climbs as load balances |

Dashboard logins (role comes from inside the JWT, the UI never asks):

| Email | Password | Sees |
|-------|----------|------|
| `admin@agritech.io` | `admin1234` | Everything, incl. device + schedule write controls |
| `farmer@agritech.io` | `farmer1234` | Read-only telemetry and crop health (write buttons gone) |

---

## 1. Rubric — Microservice implementation (target level 5)

**Say:** "Seven Spring Boot services, each with its own database and port, registered with Eureka.
Nothing talks to a hard-coded port — the gateway only knows logical names."

Open **http://localhost:8761**. You should see 7 applications, 10 instances:

```
API-GATEWAY              :8080    UP
AUTH-SERVICE             :8081    UP
SENSOR-SERVICE           :8082    UP     <- replica 1
SENSOR-SERVICE           :18082   UP     <- replica 2
CROP-SERVICE             :8083    UP     <- replica 1
CROP-SERVICE             :18083   UP     <- replica 2
IRRIGATION-SERVICE       :8084    UP     <- replica 1
IRRIGATION-SERVICE       :18084   UP     <- replica 2
CLIMATE-SERVICE          :8086    UP
RECOMMENDATION-SERVICE   :8087    UP
```

Then show a **cross-service call** in the dashboard: open a crop field. Its trend chart is
crop-service calling sensor-service *through Eureka* (`http://sensor-service/...`, never a port).

```powershell
# one-shot proof, all 31 checks
bash scripts/smoke-test.sh
```

---

## 2. Rubric — JWT authentication (target level 5, "robust and secure")

**Say:** "The gateway is the only thing that parses a JWT. Services refuse anything the gateway
hasn't signed, so you cannot bypass it by calling port 8082 directly."

```bash
# no token -> 401
curl -i http://localhost:8080/api/crops

# login -> access token (15 min) + rotating refresh token
curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@agritech.io","password":"admin1234"}'

# with token -> 200
curl -i -H "Authorization: Bearer <paste token>" http://localhost:8080/api/crops

# tampered token -> 401
curl -i -H "Authorization: Bearer tampered.token.here" http://localhost:8080/api/crops

# bypass attempt: forged admin header straight to a service port -> 401
curl -i -H "X-User-Role: ADMIN" -H "X-User-Email: evil@x.io" http://localhost:8082/api/sensors
```

The full list of 12 auth checks is in `smoke-test.sh` (scenario 2 + 3): wrong password, forged
token, refresh rotation, replay rejection, logout revocation, role escalation, 1 MB body cap,
OWASP headers, rate-limit headers, circuit breaker per route.

---

## 3. Rubric — CRUD operations with load balancing (target level 5)

This is the one command that demonstrates both halves together:

```bash
bash scripts/crud-demo.sh
```

It prints, live:

```
2. CRUD operations through the gateway (crop-service)
  PASS  CREATE   POST   /api/crops              -> 201  id=CROP-0C100E5C
  PASS  READ     GET    /api/crops/CROP-0C100E5C -> 200  name="Demo LB Field"
  PASS  UPDATE   PUT    /api/crops/{id}          -> 200  name="Demo LB Field (renamed)"
  PASS  READ again returns the updated row
  PASS  DELETE  DELETE  /api/crops/{id}          -> 200
  PASS  READ after delete is gone                -> 404

3. Load balancing: 40 reads split across the two crop-service instances
  instance       port     before    after     served these 40
  crop-service   8083     1         21        20
  crop-service   18083    2         22        20
  PASS  round-robin: 20 / 20 of 40 requests went to each replica
```

### The three things to explain while it runs

**a) Round-robin is real, not a claim.** The gateway resolves `lb://crop-service` from the Eureka
registry and alternates instances. Each replica counts its own served requests via Spring Boot
Actuator, so the split is measured at the instances, not guessed.

Watch it manually if you prefer: open the two counter URLs side by side and refresh while firing
requests — both climb together.

```powershell
for ($i=0; $i -lt 20; $i++) { Invoke-RestMethod http://localhost:8080/api/crops -Headers @{Authorization="Bearer $env:T"} | Out-Null }
```

```
http://localhost:8083/actuator/metrics/http.server.requests?tag=uri:/api/crops&tag=method:GET
http://localhost:18083/actuator/metrics/http.server.requests?tag=uri:/api/crops&tag=method:GET
```

**b) Replicas share one database.** `crud-demo.sh` section 4 creates a field (the write lands on
whichever replica the gateway picked) and then reads it back 10 times — every request alternates
instances and all 10 succeed, so both replicas see the same row.

**c) Failover.** Kill one instance mid-demo and the dashboard keeps working:

```bash
bash scripts/lb-test.sh
```

It hard-kills `sensor-service` on 18082, then shows the gateway still serving 20/20 requests
(retried on the live instance) and crop-service still getting sensor data 6/6 times — while Eureka
still lists the dead node, which is the hard part.

### CRUD in the UI instead of curl

Same operations, visible: **Crops → add a field** (Create), open it (Read), rename/resize it
(Update), delete it (Delete). Then reload http://localhost:5173 and point out the new field appears
even though the next page load was served by the *other* crop-service instance.

---

## 4. Final pre-judges checklist

```powershell
.\scripts\stack.ps1 status          # 11 x UP
bash scripts/smoke-test.sh          # 31 / 31
bash scripts/crud-demo.sh           # 18 / 18
bash scripts/lb-test.sh             # 12 / 12  (restarts the instance it kills)
python scripts/security-probes.py   # 37 checks
```

Last verified on this machine: **2026-10-29** — smoke 31/31, crud-demo 18/18, lb-test all passed,
`security-probes.py` 37 checks, dashboard login and live telemetry confirmed in the browser.

### Gotchas

- Wait ~30 s after startup before the first cross-service call — that is Eureka's registry fetch
  interval; until it completes the gateway has no route targets.
- If you edit backend code, rebuild before restarting, or you will demo a stale JAR.
- Changing `AGRITECH_JWT_SECRET` in `.env` invalidates every token already issued — restart the
  dashboard login afterwards.
- `stack.ps1 start` is idempotent: it skips ports already listening, so re-run it to recover a
  single service rather than restarting everything.
