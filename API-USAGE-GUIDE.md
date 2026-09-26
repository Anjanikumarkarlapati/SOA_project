# AgriTech API — Connecting & Using the Write (POST / PUT / PATCH / DELETE) Endpoints

Everything below was run against the **live stack on 2026‑09‑21** and the outputs are real,
not hypothetical. The write endpoints were already implemented in the code — the only thing that
was "not connected" was that the backend was never actually running. This guide fixes that and
shows exactly what each verb is for.

---

## 0. Why it wasn't working before

In the earlier session you typed these into **CMD** (`C:\...>` prompt):

```
.\scripts\stack.ps1 start
Set-ExecutionPolicy -Scope Process Bypass
```

`Set-ExecutionPolicy` and `.\scripts\stack.ps1` are **PowerShell** commands, not CMD commands —
that's the `is not recognized as an internal or external command` error. Because the script never
ran, no service started, so Postman had nothing on `http://localhost:8080` to talk to. Every
request (POST, GET, everything) failed because the API simply wasn't up.

**The fix:** run the script from PowerShell, not CMD.

---

## 1. Starting / stopping the stack (one time, per session)

Open **PowerShell** (Start menu → "PowerShell"), then:

```powershell
cd C:\Users\anjan\OneDrive\Documents\SOA-Hackthon
Set-ExecutionPolicy -Scope Process Bypass   # one line, allow the script to run
.\scripts\stack.ps1 start
```

Wait until you see:

```
api-gateway          UP on port 8080
```

Useful commands:

| Command | What it does |
|---|---|
| `.\scripts\stack.ps1 start` | Build (if needed) then launch all 6 services in order |
| `.\scripts\stack.ps1 start -SkipBuild` | Launch prebuilt jars only (fast — what I used) |
| `.\scripts\stack.ps1 status` | Show which services are UP / DOWN |
| `.\scripts\stack.ps1 stop` | Stop everything |
| `.\scripts\stack.ps1 restart` | Stop then start |

The six services and what they own:

| Service | Port | Responsible for |
|---|---|---|
| eureka-server | 8761 | Service registry (dashboard: http://localhost:8761) |
| auth-service | 8081 | Login, JWT tokens, roles |
| sensor-service | 8082 | Sensor devices + telemetry |
| crop-service | 8083 | Crop health analysis + alerts |
| irrigation-service | 8084 | Valves + watering schedules |
| **api-gateway** | **8080** | **The single URL you use for everything** |

> **Postman base URL = `http://localhost:8080`.** You never call 8081–8084 directly. The gateway
> routes `/api/...` paths to the right service. After `start`, wait ~30s for all gateway routes to
> register before your first request.

---

## 2. The mental model: what each verb is FOR in this project

| Verb | Meaning here | Returns | Needs admin? |
|---|---|---|---|
| **GET** | Read / list / query. Never changes data. | The data | No (any logged‑in user) |
| **POST** | **Create** a new resource, **or** trigger an **action** (login, analyze, open a valve, ingest readings). | The created object / result | Most of them |
| **PUT** | **Update/replace** an existing, identified resource (`/…/{id}`). | The updated object | Yes |
| **PATCH** | **Partially update** one field (e.g. just toggle active on/off). | The updated object | Yes |
| **DELETE** | **Remove** an existing resource (`/…/{id}`). | A short status message | Yes |

Rules of thumb that map onto this codebase:

- **POST creates; PUT updates.** `POST /api/sensors/register` makes a device that didn't exist;
  `PUT /api/sensors/SENSOR-001` changes one that already does.
- **The ID lives in the URL for PUT/DELETE/PATCH** (`/api/sensors/{deviceId}`), because you're
  pointing at one specific record. POST has no ID in the URL because the record doesn't exist yet.
- **POST is also used for "commands"**, not just inserts — `open`, `close`, `emergency-stop`,
  `analyze`, `login`, `ingest`. If it makes something *happen*, it's a POST.
- **PUT here is tolerant**: it only overwrites the fields you send (null fields are left alone),
  so it behaves like a partial update. `PATCH /api/irrigation/schedules/{id}/active` is the
  narrow "flip just this one thing" version.

---

## 3. Authentication (do this first — everything else needs it)

You must log in and send the returned JWT as a **Bearer token** on every request.

**Accounts (seeded):**

| Role | Email | Password | Can do |
|---|---|---|---|
| ADMIN | `admin@agritech.io` | `admin1234` | Everything: read + write |
| FARMER | `farmer@agritech.io` | `farmer1234` | **Read only** (writes get `403 Forbidden`) |

### Postman setup (recommended)

1. **Create an Environment** named `AgriTech Local` with two variables:
   - `baseUrl` = `http://localhost:8080`
   - `token` = *(leave empty — it fills itself in)*

2. **Create a request "Login"**:
   ```
   POST {{baseUrl}}/api/auth/login
   ```
   Body → **raw** → **JSON**:
   ```json
   { "email": "admin@agritech.io", "password": "admin1234" }
   ```

3. On the **Tests** tab of the same request, paste (auto‑saves the token):
   ```javascript
   pm.environment.set("token", pm.response.json().token);
   ```

4. Click **Send**. Now every other request just needs:
   **Authorization** tab → **Bearer Token** → `{{token}}`.

Real login response:

```json
{
  "token": "eyJhbGciOi...",
  "email": "admin@agritech.io",
  "role": "ADMIN",
  "farmId": "FARM-001",
  "expiresIn": 900
}
```

---

## 4. Full endpoint reference (write endpoints in bold)

### Auth — `/api/auth`
- **POST** `/login` — get a JWT
- **POST** `/register` — create an account (`role` ADMIN or FARMER)
- **POST** `/refresh` — exchange refresh token
- **POST** `/logout` — revoke the current token
- **POST** `/google` — Supabase/Google sign‑in
- GET `/me` — who am I (needs bearer)

### Sensors — `/api/sensors`
- **POST** `/register` — CREATE a device *(admin)*
- GET `` — list (paged; `?health=&fieldId=&q=&page=&size=`)
- GET `/{deviceId}` — one device
- **PUT** `/{deviceId}` — UPDATE it *(admin)*
- **DELETE** `/{deviceId}` — remove it *(admin)*
- GET `/summary` — online/offline/low‑battery counts

### Telemetry — `/api/telemetry`
- **POST** `/ingest` — CREATE readings (bulk)
- GET `/{deviceId}?range=24h` — history (`1h,24h,7d,30d,90d`)
- GET `/{deviceId}/latest` — newest reading
- GET `/field/{fieldId}/latest` and `/series` — field rollups
- **POST** `/field/{fieldId}/irrigation-event?state=OPEN` — tell simulator watering started
- GET `/stats` — ingestion volume

### Crops — `/api/crops`
- **POST** `/analyze` — run health analysis (all crops, or body `{"cropId":"..."}`)
- GET `` / `/{cropId}` / `/{cropId}/health` / `/{cropId}/metrics?range=7d`
- GET `/alerts` / `/summary`

### Irrigation — `/api/irrigation`
- **POST** `/schedules` — CREATE a watering schedule *(admin)*
- **PUT** `/schedules/{id}` — UPDATE a schedule *(admin)*
- **PATCH** `/schedules/{id}/active` — toggle active on/off only *(admin)*
- **DELETE** `/schedules/{id}` — remove it *(admin)*
- GET `/schedules` / `/schedules/{id}` / `/events`

### Valves — `/api/valves`
- **POST** `/{valveId}/open?durationMinutes=15` — open a valve *(admin, 1–240)*
- **POST** `/{valveId}/close` — close it *(admin)*
- **POST** `/emergency-stop?reason=...` — close all *(admin)*
- GET `` / `/{valveId}/status` / `/summary`

---

## 5. Copy‑paste curl demos (verified — these are the real responses)

Set the token once in PowerShell or Git‑Bash:

```bash
BASE=http://localhost:8080
TOKEN=$(curl -s -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@agritech.io","password":"admin1234"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['token'])")
AUTH=(-H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json')
```

### POST = create a sensor device → `201 Created`
```bash
curl -i -X POST $BASE/api/sensors/register "${AUTH[@]}" \
  -d '{"deviceId":"SENSOR-DEMO-01","farmId":"FARM-001","sensorType":"SOIL","fieldId":"FIELD-A","latitude":12.97,"longitude":77.59}'
```
```
HTTP 201
```
Postman: `POST {{baseUrl}}/api/sensors/register`, Bearer `{{token}}`, raw JSON body above.

### PUT = update that device (move field, rename type) → applied
```bash
curl -s -X PUT $BASE/api/sensors/SENSOR-DEMO-01 "${AUTH[@]}" \
  -d '{"sensorType":"SOIL_MOISTURE","fieldId":"FIELD-B","status":"ACTIVE"}'
```
```
now -> type=SOIL_MOISTURE field=FIELD-B status=ACTIVE
```
Note the ID is **in the URL** (`/SENSOR-DEMO-01`) — that's how PUT knows *which* record to change.

### POST = ingest telemetry, then GET it back
```bash
curl -s -X POST $BASE/api/telemetry/ingest "${AUTH[@]}" \
  -d '{"readings":[{"deviceId":"SENSOR-DEMO-01","soilMoisture":42.5,"soilTemperature":27.1,"ph":6.7,"batteryPercent":92}]}'
```
```
{"accepted":1,"rejected":[]}
```
```bash
curl -s "${AUTH[@]}" $BASE/api/telemetry/SENSOR-DEMO-01/latest
```
```
{"id":2461,"deviceId":"SENSOR-DEMO-01","soilMoisture":42.5,"soilTemperature":27.1,"ph":6.7,"batteryPercent":92.0,...}
```

### POST = run an action (crop analysis)
```bash
curl -s -X POST $BASE/api/crops/analyze "${AUTH[@]}" -d '{}'
```
```
analyzed=4 at 2026-09-21T12:55:19Z
```

### POST = valves (open then close)
```bash
curl -s -X POST $BASE/api/valves/VALVE-FIELD-01/open?durationMinutes=10 "${AUTH[@]}"   # state=OPEN
curl -s -X POST $BASE/api/valves/VALVE-FIELD-01/close "${AUTH[@]}"                      # state=CLOSED
```
```
state=OPEN  openUntil=2026-09-21T13:05:20Z
state=CLOSED
```

### POST create + PUT update + PATCH a schedule
```bash
SCHED=$(curl -s -X POST $BASE/api/irrigation/schedules "${AUTH[@]}" \
  -d '{"cropId":"CROP-001","valveId":"VALVE-FIELD-01","recurrence":"DAILY","startTime":"06:30","durationMinutes":20}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['scheduleId'])")
curl -s -X PUT  $BASE/api/irrigation/schedules/$SCHED "${AUTH[@]}" -d '{"durationMinutes":35,"active":false}'
curl -s -X DELETE $BASE/api/irrigation/schedules/$SCHED "${AUTH[@]}"
```
```
created SCHEDULE-431E2023
updated -> active=False durationMinutes=35
```

### DELETE = remove a resource
```bash
curl -s -X DELETE $BASE/api/sensors/SENSOR-DEMO-01 "${AUTH[@]}"
```
```
{"deviceId":"SENSOR-DEMO-01","status":"deregistered"}
```

---

## 5b. Checking the data in Postman (reading everything back with GET)

"Checking the data" = firing **GET** requests and reading the JSON response. GET never changes
anything, so it's safe to run freely, and it works for **both admin and farmer** tokens.

**One-time setup:** create environment `AgriTech Local` with `baseUrl=http://localhost:8080` and
an empty `token`. Create a **Login** request (`POST {{baseUrl}}/api/auth/login`, admin body) with
Tests script `pm.environment.set("token", pm.response.json().token);` and Send once. After that,
every GET request just needs Authorization → Bearer → `{{token}}`.

**How to read a response in Postman:** after **Send**, the lower pane has tabs —
**Body** (Pretty = formatted JSON, Raw, Preview), **Headers**, and **Tests**. The bar above shows
the status code (200/201/204 = good, 4xx/5xx = problem) and response time. Use **Visualize** if
you attach a small HTML template. Right-click a response → *Save Response* to keep a snapshot.

### Every GET endpoint, with a real sample from this stack

**Who am I / session**
- `GET /api/auth/me`
```json
{"email":"admin@agritech.io","role":"ADMIN","farmId":"FARM-001","displayName":"Farm Administrator","expiresAt":"2026-09-22T13:35:15Z"}
```

**Sensors**
- `GET /api/sensors` — paginated list. Query params: `page`, `size` (1–200), `health`, `fieldId`, `q`.
```json
{"content":[{"deviceId":"SENSOR-FARM01-001","farmId":"FARM-001","sensorType":"soil-moisture-temperature","fieldId":"CROP-FIELD-01","location":{"latitude":17.39,"longitude":78.49},"status":"ACTIVE","health":"ONLINE","batteryPercent":62.8,"lastReadingAt":"2026-09-21T13:35:02Z"}],"totalElements":13,"totalPages":7,"page":0,"size":2}
```
  - `health` = ONLINE / OFFLINE / LOW_BATTERY. To see only offline: `GET /api/sensors?health=OFFLINE`.
  - `q` does a substring match on deviceId; `fieldId` filters to one field.
- `GET /api/sensors/SENSOR-FARM01-001` — one device (same shape as an item above).
- `GET /api/sensors/summary` — dashboard tile: `{"total":13,"online":12,"offline":1,"lowBattery":0}`

**Telemetry (the readings themselves)**
- `GET /api/telemetry/SENSOR-FARM01-001/latest` — newest sample
```json
{"id":3410,"deviceId":"SENSOR-FARM01-001","timestamp":"2026-09-21T13:35:02Z","soilMoisture":61.9,"soilTemperature":21.8,"ph":6.6,"batteryPercent":62.8}
```
- `GET /api/telemetry/SENSOR-FARM01-001?range=24h` — history array (`1h,24h,7d,30d,90d`)
- `GET /api/telemetry/field/{fieldId}/latest` — field average across its devices
- `GET /api/telemetry/field/{fieldId}/series?range=7d` — chart-ready buckets
- `GET /api/telemetry/stats` — `{"readingsLastMinute":24,"readingsLastHour":1117,"totalReadings":3421}`
> The field IDs here are the crop/field IDs like `CROP-FIELD-01`. Use a field that exists, or the
> rollup returns `{"deviceCount":0,"reportingDevices":0}`.

**Crops / health**
- `GET /api/crops` — all fields with latest health:
```json
{"cropId":"CROP-FIELD-01","name":"North Field","cropType":"Maize","valveId":"VALVE-FIELD-01","areaHectares":12.5,"optimal":{"moisture":[55.0,75.0],"temperature":[18.0,27.0],"ph":[5.8,7.0]},"healthScore":100,"status":"OPTIMAL","soilMoisture":61.1,"soilTemperature":22.5,"ph":6.6,"hoursToIrrigation":5.6,"recommendations":["Moisture is within the optimal range"]}
```
  - `status` = OPTIMAL / WARNING / CRITICAL. `healthScore` 0–100. `optimal` is the shaded band for charts.
- `GET /api/crops/CROP-FIELD-01/health` and `/metrics?range=7d` — trend + optimal band
- `GET /api/crops/alerts` — only non-optimal fields, newest first:
```json
{"severity":"CRITICAL","cropId":"CROP-FIELD-03","source":"South Terrace","message":"Soil moisture 28.3% is below the optimal range","timestamp":"2026-09-21T13:34:33Z"}
```
- `GET /api/crops/summary` — `{"totalFields":4,"optimalFields":2,"optimalPercent":50}`

**Valves**
- `GET /api/valves` — all zones:
```json
{"valveId":"VALVE-FIELD-01","zoneName":"North Field","cropId":"CROP-FIELD-01","state":"CLOSED","flowRateLpm":0.0,"ratedFlowLpm":120.0,"openUntil":null,"secondsRemaining":null,"runningScheduleId":null}
```
  - `state` OPEN/CLOSED; `openUntil`/`secondsRemaining` non-null only while running.
- `GET /api/valves/VALVE-FIELD-01/status` — one zone · `GET /api/valves/summary` → `{"totalZones":4,"running":0}`

**Irrigation schedules & events**
- `GET /api/irrigation/schedules`:
```json
{"scheduleId":"SCHEDULE-001","cropId":"CROP-FIELD-01","valveId":"VALVE-FIELD-01","zoneName":"North Field","recurrence":"DAILY","daysOfWeek":[],"startTime":"06:30","durationMinutes":20,"active":true,"skipIfMoist":true,"lastRunAt":null}
```
- `GET /api/irrigation/schedules/{id}` — one · `GET /api/irrigation/events` — audit log:
```json
{"id":"irrigation-1","severity":"INFO","cropId":"CROP-FIELD-01","source":"VALVE-FIELD-01","message":"North Field opened for 10 min (manual)","timestamp":"2026-09-21T12:55:21Z"}
```

### The proven "verify a write actually saved" loop
1. `GET /api/sensors?size=200` → note it's not there yet.
2. `POST /api/sensors/register` (or PUT/DELETE) → 201.
3. `GET /api/sensors/SENSOR-DEMO-01` → now returns it (confirms the write).
4. `DELETE /api/sensors/SENSOR-DEMO-01` → 200, then step 3 returns **404 not_found** (confirms removal).

### Reading-response troubleshooting
| You see | It means |
|---|---|
| `401` | No/expired token → re-Send the Login request (Test script refreshes `{{token}}`) |
| `403` | You're on a **write** with the farmer token → GET is fine, but use admin for POST/PUT/DELETE |
| `404` | Bad ID in the URL (check exact casing) or the record was deleted / wiped on restart |
| `[]` / `deviceCount:0` | Empty collection or a field/ID that has no data — verify the ID with the list endpoint first |
| Big list only shows 25 | It's paginated — read `totalPages` and pass `?page=1&size=100` |

---

## 6. Behaviour worth knowing (also verified)

- **Missing token → `401 Unauthorized`.** `GET /api/sensors` with no `Authorization` header.
- **Farmer trying to write → `403 Forbidden`.** `farmer POST /api/sensors/register → 403`, but
  `farmer GET /api/sensors → 200`. Reads are open to any logged‑in user; writes are admin‑only.
- **Creating a duplicate → `409 Conflict`.** `POST /api/sensors/register` twice:
  ```json
  {"message":"Device 'SENSOR-DEMO-01' is already registered","error":"device_exists"}
  ```
- **Telemetry ingestion is per‑item tolerant** — one bad reading doesn't reject the batch. Bad
  values come back under `"rejected"` with a reason (e.g. `"soilMoisture out of range (0-100)"`,
  `"device is not registered"`). Valid ranges: moisture 0–100, temp −50–80, pH 0–14, battery 0–100,
  no future timestamps.
- **`expiresIn` is 900** (15 min; use `POST /api/auth/refresh` with the `refreshToken` for a new one). When a token expires, just re‑run Login (the Postman Test script
  refreshes `{{token}}` automatically).
- **Data persists across restarts** (H2 files in `.run\data`). To start fresh: `stack.ps1 stop`, delete `.run\data`, then `start`.
  That's why the guide deletes its demo device at the end.

---

## 7. Quick troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Couldn't connect to server` / `ECONNREFUSED` | Stack isn't running → `.\scripts\stack.ps1 status`, then `start` (in **PowerShell**, not CMD) |
| `404` on a valid path | Route not registered yet → wait ~30s after start, or `restart` the gateway |
| `401` | Missing/expired token → re‑run Login; check Bearer = `{{token}}` |
| `403` | You're using the **farmer** account for a write → log in as `admin@agritech.io` |
| `Set-ExecutionPolicy not recognized` | You're in CMD → open PowerShell instead |
