#!/usr/bin/env python3
"""
AgriTech SOA - security and rubric probe harness.

Hits the RUNNING stack (default http://localhost:8080) and reports, for each check,
whether the behaviour is SECURE or VULNERABLE / MISSING. Safe to re-run: every probe that
creates data uses a unique id and cleans up after itself where the API allows it.

    python scripts/security-probes.py            # all groups
    python scripts/security-probes.py --group auth
    python scripts/security-probes.py --json report.json

Exit code is 0 when nothing is VULNERABLE/MISSING, 1 otherwise, so CI can gate on it.

Groups:
  auth    authentication / authorization / token handling
  idor    cross-tenant object access
  harden  rate limiting, actuator, registry, direct-port trust
  crud    CRUD completeness per aggregate (rubric row 3)
  lb      load balancing across Eureka replicas (rubric row 3)
"""

import argparse
import base64
import hashlib
import hmac
import json
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections import Counter

GATEWAY = "http://localhost:8080"
SERVICES = {  # direct ports, bypassing the gateway (host firewall is the only thing stopping this)
    "auth-service": "http://localhost:8081",
    "sensor-service": "http://localhost:8082",
    "crop-service": "http://localhost:8083",
    "irrigation-service": "http://localhost:8084",
    "climate-service": "http://localhost:8086",
    "recommendation-service": "http://localhost:8087",
}
EUREKA = "http://localhost:8761"

# The values committed in auth-service/application.yml, api-gateway/application.yml,
# InternalAuth.java and GatewaySigner.java. Used here only to prove they are guessable.
DEFAULT_JWT_SECRET = "agritech-dev-secret-key-change-me-in-production-0123456789"
DEFAULT_INTERNAL_SECRET = "agritech-internal-dev-secret-change-me-0123456789"

RESULTS = []


# ---------------------------------------------------------------- helpers ----
def call(base, method, path, body=None, token=None, headers=None, timeout=25):
    """Return (status, parsed_json_or_text, error_string_or_None)."""
    url = base + path
    data = None
    hdrs = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode()
        hdrs["Content-Type"] = "application/json"
    if token:
        hdrs["Authorization"] = "Bearer " + token
    hdrs.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        return e.code, _maybe_json(raw), None
    except Exception as e:  # connection refused, timeout, ...
        return 0, None, f"{type(e).__name__}: {e}"
    return resp.status, _maybe_json(raw), None


def _maybe_json(raw):
    try:
        return json.loads(raw)
    except Exception:
        return raw


def b64url(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def forge_jwt(secret, email, role, farm_id, ttl=3600):
    """Mint an HS256 access token with a chosen identity."""
    now = int(time.time())
    header = b64url(json.dumps({"alg": "HS256"}).encode())
    payload = b64url(json.dumps({
        "jti": str(uuid.uuid4()), "sub": email, "role": role, "farmId": farm_id,
        "name": "Probe", "iat": now, "exp": now + ttl,
    }).encode())
    signing_input = f"{header}.{payload}".encode()
    sig = b64url(hmac.new(secret.encode(), signing_input, hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


def sign_internal(secret, email, role, farm_id):
    """Reproduce the gateway's X-Gateway-Signature so we can talk to a service directly."""
    ts = str(int(time.time() * 1000))
    payload = f"{email}|{role}|{farm_id}|{ts}".encode()
    sig = base64.b64encode(hmac.new(secret.encode(), payload, hashlib.sha256).digest()).decode()
    return {"X-User-Email": email, "X-User-Role": role, "X-Farm-Id": farm_id,
            "X-Gateway-Timestamp": ts, "X-Gateway-Signature": sig}


def record(check_id, group, title, verdict, evidence):
    RESULTS.append({"id": check_id, "group": group, "title": title,
                    "verdict": verdict, "evidence": evidence})
    colour = {"SECURE": "PASS", "VULNERABLE": "FAIL", "MISSING": "FAIL",
              "INFO": "info", "PRESENT": "PASS"}[verdict]
    print(f"  [{colour:>4}] {check_id:<6} {title}\n         {verdict}: {evidence}")


def uniq():
    return uuid.uuid4().hex[:8]


def register(email, password, role="FARMER"):
    return call(GATEWAY, "POST", "/api/auth/register",
                {"email": email, "password": password, "role": role, "displayName": "Probe User"})


def login(email, password):
    return call(GATEWAY, "POST", "/api/auth/login", {"email": email, "password": password})


def token_of(status, body):
    return body.get("token") if status in (200, 201) and isinstance(body, dict) else None


# ------------------------------------------------------------------- auth ----
def group_auth():
    print("\n== authentication / authorization ==")

    # A01 anonymous access must be refused
    st, body, err = call(GATEWAY, "GET", "/api/sensors")
    record("A01", "auth", "Unauthenticated request to a protected API is refused",
           "SECURE" if st == 401 else "VULNERABLE", f"GET /api/sensors -> {st} {str(body)[:120]}")

    # A02 self-registration cannot grant ADMIN
    email = f"probe-esc-{uniq()}@example.test"
    st, body, err = register(email, "ProbePass123", role="ADMIN")
    tok = token_of(st, body)
    if tok:
        claims = json.loads(base64.urlsafe_b64decode(tok.split(".")[1] + "=="))
        granted = claims.get("role")
        record("A02", "auth", "Public registration cannot mint an ADMIN account",
               "VULNERABLE" if granted == "ADMIN" else "SECURE",
               f"registered with role=ADMIN -> issued token role={granted}")
    else:
        record("A02", "auth", "Public registration cannot mint an ADMIN account",
               "SECURE", f"registration refused: {st} {str(body)[:120]}")

    # A03 token forged with the committed default secret
    forged = forge_jwt(DEFAULT_JWT_SECRET, "attacker@example.test", "ADMIN", "FARM-001")
    st, body, err = call(GATEWAY, "GET", "/api/sensors", token=forged)
    record("A03", "auth", "Access tokens are not forgeable with a committed default secret",
           "VULNERABLE" if st == 200 else "SECURE",
           f"HS256 token signed with the default dev secret -> GET /api/sensors {st}")

    # A04 alg=none rejection
    hdr = b64url(json.dumps({"alg": "none"}).encode())
    pl = b64url(json.dumps({"sub": "x@example.test", "role": "ADMIN", "farmId": "FARM-001",
                            "exp": int(time.time()) + 600}).encode())
    st, body, err = call(GATEWAY, "GET", "/api/sensors", token=f"{hdr}.{pl}.")
    record("A04", "auth", 'Unsigned tokens ("alg":"none") are rejected',
           "SECURE" if st == 401 else "VULNERABLE", f"-> {st}")

    # A05 expired token rejected
    expired = forge_jwt(DEFAULT_JWT_SECRET, "x@example.test", "FARMER", "FARM-001", ttl=-60)
    st, body, err = call(GATEWAY, "GET", "/api/sensors", token=expired)
    record("A05", "auth", "Expired tokens are rejected",
           "SECURE" if st == 401 else "VULNERABLE", f"-> {st}")

    # A06 logout revokes the access token
    email = f"probe-logout-{uniq()}@example.test"
    st, body, _ = register(email, "ProbePass123")
    tok = token_of(st, body)
    if tok:
        st1, _, _ = call(GATEWAY, "GET", "/api/auth/me", token=tok)
        call(GATEWAY, "POST", "/api/auth/logout", {"refreshToken": body.get("refreshToken")}, token=tok)
        time.sleep(20)  # gateway polls /api/auth/revoked every 15 s
        st2, _, _ = call(GATEWAY, "GET", "/api/auth/me", token=tok)
        record("A06", "auth", "Logged-out access token stops working (revocation propagates)",
               "SECURE" if st2 == 401 else "VULNERABLE",
               f"before logout {st1}, 20 s after logout {st2}")
    else:
        record("A06", "auth", "Logged-out access token stops working", "INFO", "could not register")

    # A07 refresh token cannot be replayed
    email = f"probe-refresh-{uniq()}@example.test"
    st, body, _ = register(email, "ProbePass123")
    if st in (200, 201):
        rt = body["refreshToken"]
        s1, b1, _ = call(GATEWAY, "POST", "/api/auth/refresh", {"refreshToken": rt})
        s2, b2, _ = call(GATEWAY, "POST", "/api/auth/refresh", {"refreshToken": rt})
        record("A07", "auth", "Refresh token is single-use (rotation + reuse detection)",
               "SECURE" if s1 in (200, 201) and s2 == 401 else "VULNERABLE",
               f"first refresh {s1}, replay {s2}")
    else:
        record("A07", "auth", "Refresh token is single-use", "INFO", f"register {st}")

    # A08 login user enumeration
    good = f"probe-timing-{uniq()}@example.test"
    register(good, "ProbePass123")
    t_missing = []
    t_exists = []
    for _ in range(12):
        el_m, _r = _timed(login, "no-such-user-zz@example.test", "ProbePass123")
        t_missing.append(el_m)
        el_e, _r = _timed(login, good, "WrongPassword999")
        t_exists.append(el_e)
    am, ae = sum(t_missing) / len(t_missing), sum(t_exists) / len(t_exists)
    record("A08", "auth", "Login timing does not reveal whether an account exists",
           "VULNERABLE" if abs(ae - am) > 0.030 else "SECURE",
           f"avg unknown-user {am*1000:.0f} ms vs existing-user {ae*1000:.0f} ms (delta {abs(ae-am)*1000:.0f} ms)")

    # A09 gateway strips client-supplied identity headers
    st, body, _ = call(GATEWAY, "GET", "/api/auth/me", token=None,
                       headers={"X-User-Email": "spoof@example.test", "X-User-Role": "ADMIN"})
    record("A09", "auth", "Client-supplied X-User-Role is not trusted by the gateway",
           "SECURE" if st == 401 else "VULNERABLE", f"-> {st} {str(body)[:80]}")


_TIMED_CACHE = {}


def _timed(fn, *a, **kw):
    t0 = time.perf_counter()
    r = fn(*a, **kw)
    return time.perf_counter() - t0, r


# ------------------------------------------------------------------- idor ----
def group_idor():
    print("\n== cross-tenant object access ==")

    a_email = f"probe-alice-{uniq()}@example.test"
    b_email = f"probe-bob-{uniq()}@example.test"
    sa, ba, _ = register(a_email, "ProbePass123")
    sb, bb, _ = register(b_email, "ProbePass123")
    ta, tb = token_of(sa, ba), token_of(sb, bb)
    if not ta or not tb:
        record("B00", "idor", "Two tenants provisioned for isolation probes", "INFO",
               f"alice {sa}, bob {sb}")
        return
    farmA = ba.get("farmId")
    farmB = bb.get("farmId")
    record("B01", "idor", "Each new account gets its own tenant (farm) scope",
           "SECURE" if farmA and farmA != farmB else "VULNERABLE", f"alice={farmA} bob={farmB}")

    # Bob creates a crop field; Alice must not be able to see or change it.
    st, crop, _ = call(GATEWAY, "POST", "/api/crops",
                       {"name": "Bob Secret Field", "cropType": "Wheat", "areaHectares": 1.5}, token=tb)
    crop_id = crop.get("cropId") if st in (200, 201) and isinstance(crop, dict) else None
    if not crop_id:
        record("B02", "idor", "Tenant B can create a crop field", "INFO", f"create -> {st} {str(crop)[:120]}")
        return

    st, body, _ = call(GATEWAY, "GET", f"/api/crops/{crop_id}", token=ta)
    record("B02", "idor", "Tenant A cannot read tenant B's field by id",
           "SECURE" if st in (403, 404) else "VULNERABLE", f"GET /api/crops/{crop_id} as alice -> {st}")

    st, body, _ = call(GATEWAY, "GET", "/api/crops", token=ta)
    leaked = isinstance(body, list) and any(c.get("cropId") == crop_id for c in body)
    record("B03", "idor", "Tenant A's crop list does not contain tenant B's field",
           "VULNERABLE" if leaked else "SECURE",
           f"GET /api/crops as alice -> {st}, {len(body) if isinstance(body, list) else '?'} rows, bob's field present={leaked}")

    st, body, _ = call(GATEWAY, "GET", f"/api/crops?farmId={farmB}", token=ta)
    record("B04", "idor", "farmId query parameter cannot be used to read another tenant",
           "SECURE" if st in (403, 404) or (isinstance(body, list) and not body) else "VULNERABLE",
           f"GET /api/crops?farmId={farmB} as alice -> {st}, {len(body) if isinstance(body, list) else '?'} rows")

    st, body, _ = call(GATEWAY, "PUT", f"/api/crops/{crop_id}", {"name": "hijacked"}, token=ta)
    record("B05", "idor", "Tenant A cannot update tenant B's field",
           "SECURE" if st in (401, 403, 404, 405) else "VULNERABLE", f"PUT -> {st}")

    st, body, _ = call(GATEWAY, "DELETE", f"/api/crops/{crop_id}", token=ta)
    record("B06", "idor", "Tenant A cannot delete tenant B's field",
           "SECURE" if st in (401, 403, 404, 405) else "VULNERABLE", f"DELETE -> {st}")

    # Sensors: Bob's field auto-provisions a sensor; Alice must not read it or its telemetry.
    device_id = None
    st, body, _ = call(GATEWAY, "GET", "/api/sensors", token=tb)
    if st == 200 and isinstance(body, dict):
        rows = body.get("content", [])
        mine = [r for r in rows if r.get("farmId") == farmB]
        if mine:
            device_id = mine[0].get("deviceId")
    if device_id:
        st, _, _ = call(GATEWAY, "GET", f"/api/sensors/{device_id}", token=ta)
        record("B07", "idor", "Tenant A cannot read tenant B's sensor device",
               "SECURE" if st in (403, 404) else "VULNERABLE", f"GET /api/sensors/{device_id} as alice -> {st}")

        st, body, _ = call(GATEWAY, "GET", "/api/sensors", token=ta)
        rows = body.get("content", []) if isinstance(body, dict) else []
        record("B08", "idor", "Tenant A's sensor list is limited to its own farm",
               "VULNERABLE" if any(r.get("farmId") == farmB for r in rows) else "SECURE",
               f"{len(rows)} rows visible to alice, bob's device visible={any(r.get('deviceId')==device_id for r in rows)}")

        st, _, _ = call(GATEWAY, "GET", f"/api/telemetry/{device_id}", token=ta)
        record("B09", "idor", "Tenant A cannot read tenant B's telemetry history",
               "SECURE" if st in (403, 404) else "VULNERABLE", f"GET /api/telemetry/{device_id} as alice -> {st}")

        st, body, _ = call(GATEWAY, "POST", "/api/telemetry/ingest",
                           {"readings": [{"deviceId": device_id, "soilMoisture": 99.0,
                                          "soilTemperature": 99.0, "ph": 9.0}]}, token=ta)
        # Ingest is a bulk API: it answers 200 and reports each reading's fate, so the accepted
        # count is the security signal here, not the HTTP status.
        accepted = body.get("accepted") if isinstance(body, dict) else None
        rejected = body.get("rejected") if isinstance(body, dict) else None
        record("B10", "idor", "Tenant A cannot inject readings into tenant B's device",
               "SECURE" if accepted == 0 else "VULNERABLE",
               f"POST /api/telemetry/ingest as alice -> {st}, accepted={accepted}, rejected={rejected}")
    else:
        record("B07", "idor", "Sensor auto-provisioned for a new crop field", "INFO",
               "no device found for bob's farm")

    # Irrigation schedules and valves are admin-gated; check tenancy of the gate.
    st, body, _ = call(GATEWAY, "GET", "/api/valves", token=ta)
    rows = body if isinstance(body, list) else []
    record("B11", "idor", "Tenant A's valve list is limited to its own farm",
           "VULNERABLE" if len(rows) > 0 and not all(v.get("farmId") == farmA for v in rows) else "SECURE",
           f"GET /api/valves as alice -> {st}, {len(rows)} valves visible")

    st, body, _ = call(GATEWAY, "GET", "/api/irrigation/schedules", token=ta)
    rows = body if isinstance(body, list) else []
    record("B12", "idor", "Tenant A's schedule list is limited to its own farm",
           "VULNERABLE" if any(r.get("farmId") == farmB for r in rows) else "SECURE",
           f"GET /api/irrigation/schedules as alice -> {st}, {len(rows)} rows, bob's visible={any(r.get('farmId')==farmB for r in rows)}")

    # cleanup bob's field when the API supports it
    call(GATEWAY, "DELETE", f"/api/crops/{crop_id}", token=tb)


# ----------------------------------------------------------------- harden ----
def group_harden():
    print("\n== hardening: gateway, registry, direct ports ==")

    # H01 direct service port with a signature forged from the committed default secret
    hdrs = sign_internal(DEFAULT_INTERNAL_SECRET, "attacker@example.test", "ADMIN", "FARM-001")
    st, body, err = call(SERVICES["sensor-service"], "GET", "/api/sensors", headers=hdrs)
    record("H01", "harden", "A forged gateway signature using the committed default secret is refused",
           "VULNERABLE" if st == 200 else "SECURE",
           f"direct :8082/api/sensors with default-secret HMAC -> {st} {str(body)[:80] if body else err}")

    # H02 direct port without any signature
    st, body, err = call(SERVICES["sensor-service"], "GET", "/api/sensors")
    record("H02", "harden", "Direct service port rejects unsigned identity headers",
           "SECURE" if st == 401 else "VULNERABLE", f"-> {st}")

    # H03 gateway actuator must not leak the routing table
    st, body, err = call(GATEWAY, "GET", "/actuator/gateway/routes")
    leaks = st == 200 and isinstance(body, list) and len(str(body)) > 50
    record("H03", "harden", "Gateway actuator does not expose the routing table unauthenticated",
           "VULNERABLE" if leaks else "SECURE", f"GET /actuator/gateway/routes -> {st}")

    # H04 service actuator detail
    st, body, _ = call(SERVICES["crop-service"], "GET", "/actuator/env")
    record("H04", "harden", "Service /actuator/env is not readable",
           "SECURE" if st in (401, 403, 404) else "VULNERABLE", f"-> {st}")

    # H05 Eureka registry authentication
    st, body, err = call(EUREKA, "GET", "/")
    st2, _, _ = call(EUREKA, "GET", "/eureka/apps")
    record("H05", "harden", "Eureka registry requires authentication",
           "VULNERABLE" if st2 in (200, 404) and st == 200 else "SECURE",
           f"GET :8761/ -> {st}, GET /eureka/apps -> {st2}")

    # H06 rate limit cannot be dodged by rotating X-Device-Id
    email = f"probe-rl-{uniq()}@example.test"
    st, body, _ = register(email, "ProbePass123")
    tok = token_of(st, body)
    blocked = 0
    for i in range(130):
        s, _, _ = call(GATEWAY, "GET", "/api/auth/me", token=tok,
                       headers={"X-Device-Id": f"rotating-{i}"})
        if s == 429:
            blocked += 1
    record("H06", "harden", "Rate limit cannot be bypassed by rotating the X-Device-Id header",
           "SECURE" if blocked > 0 else "VULNERABLE",
           f"130 authenticated GETs, each with a fresh X-Device-Id -> {blocked} rate-limited")

    # H07 rate limit actually engages for a plain client
    blocked = 0
    for i in range(130):
        s, _, _ = call(GATEWAY, "POST", "/api/auth/login", {"email": "nobody@example.test",
                                                            "password": "x"})
        if s == 429:
            blocked += 1
    record("H07", "harden", "Public endpoint rate limiting engages",
           "SECURE" if blocked > 0 else "VULNERABLE", f"130 unauthenticated POSTs -> {blocked} rate-limited")
    time.sleep(61)  # let the fixed window reset before any later probe

    # H08 CORS must not pair wildcard origins with credentials
    req = urllib.request.Request(GATEWAY + "/api/sensors", method="OPTIONS", headers={
        "Origin": "http://evil.example.com", "Access-Control-Request-Method": "GET"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            acao = resp.headers.get("Access-Control-Allow-Origin", "")
            acac = resp.headers.get("Access-Control-Allow-Credentials", "")
            code = resp.status
    except urllib.error.HTTPError as e:
        acao = e.headers.get("Access-Control-Allow-Origin", "")
        acac = e.headers.get("Access-Control-Allow-Credentials", "")
        code = e.code
    except Exception as e:
        acao = acac = ""
        code = 0
    granted = acao in ("http://evil.example.com", "*") and acac.lower() == "true"
    record("H08", "harden", "A foreign origin is not granted credentialed CORS",
           "VULNERABLE" if granted else "SECURE",
           f"OPTIONS from evil.example.com -> {code}, allow-origin={acao!r}, allow-credentials={acac!r}")

    # H09 demo accounts
    st, body, _ = login("admin@agritech.io", "admin1234")
    record("H09", "harden", "Seed demo accounts are gated by agritech.seed-demo-accounts",
           "INFO", f"login as seeded admin@agritech.io/admin1234 -> {st}; known credentials by "
                   f"design for the demo - set agritech.seed-demo-accounts=false before deploying")


# ------------------------------------------------------------------- crud ----
def group_crud():
    print("\n== CRUD completeness (rubric: CRUD operations) ==")
    email = f"probe-crud-{uniq()}@example.test"
    st, body, _ = register(email, "ProbePass123")
    tok = token_of(st, body)
    if not tok:
        record("C00", "crud", "Probe account", "INFO", f"register {st}")
        return
    admin_email = "admin@agritech.io"
    sa, ba, _ = login(admin_email, "admin1234")
    atok = token_of(sa, ba)

    def probe(label, create, read_one, read_list, update, delete, use_admin=False):
        t = atok if use_admin else tok
        missing = []
        if create is None:
            missing.append("Create")
        else:
            s, b, _ = call(GATEWAY, create[0], create[1], create[2] if len(create) > 2 else None, token=t)
            if s not in (200, 201, 204):
                missing.append(f"Create({s})")
            else:
                cid = None
                if isinstance(b, dict):
                    cid = b.get("cropId") or b.get("deviceId") or b.get("scheduleId") or b.get("propertyId") or b.get("valveId")
                if read_one and cid:
                    s2, _, _ = call(GATEWAY, "GET", read_one.format(id=cid), token=t)
                    if s2 != 200:
                        missing.append(f"Read-one({s2})")
                if update and cid:
                    s3, _, _ = call(GATEWAY, update[0], update[1].format(id=cid), update[2], token=t)
                    if s3 not in (200, 204):
                        missing.append(f"Update({s3})")
                if delete and cid:
                    s4, _, _ = call(GATEWAY, delete[0], delete[1].format(id=cid), token=t)
                    if s4 not in (200, 204):
                        missing.append(f"Delete({s4})")
        if read_list:
            s5, _, _ = call(GATEWAY, "GET", read_list, token=t)
            if s5 != 200:
                missing.append(f"Read-list({s5})")
        record("CRUD", "crud", label, "PRESENT" if not missing else "MISSING",
               "complete" if not missing else "missing/blocked: " + ", ".join(missing))

    # crop field: farmer-owned
    probe("Crop field /api/crops",
          ("POST", "/api/crops", {"name": "CRUD Probe Field", "cropType": "Maize", "areaHectares": 2.0}),
          "/api/crops/{id}", "/api/crops",
          ("PUT", "/api/crops/{id}", {"name": "CRUD Probe Field Renamed"}),
          ("DELETE", "/api/crops/{id}"))

    # sensor device: admin-owned
    did = f"PROBE-{uniq().upper()}"
    probe("Sensor device /api/sensors",
          ("POST", "/api/sensors/register", {"deviceId": did, "farmId": "FARM-001",
                                             "sensorType": "SOIL_MOISTURE"}),
          f"/api/sensors/{did}".replace(did, "{id}"), "/api/sensors",
          ("PUT", "/api/sensors/{id}", {"status": "OFFLINE"}),
          ("DELETE", "/api/sensors/{id}"), use_admin=True)

    # irrigation schedule: admin-owned
    sid = None
    s, b, _ = call(GATEWAY, "POST", "/api/irrigation/schedules",
                  {"cropId": "CROP-001", "valveId": "VALVE-001", "startTime": "06:00",
                   "durationMinutes": 20, "days": ["MON"], "farmId": "FARM-001"}, token=atok)
    if s in (200, 201) and isinstance(b, dict):
        sid = b.get("scheduleId")
    if sid:
        probe("Irrigation schedule /api/irrigation/schedules", None, None,
              "/api/irrigation/schedules",
              ("PUT", "/api/irrigation/schedules/{id}", {"startTime": "07:00", "durationMinutes": 25,
                                                         "days": ["TUE"], "valveId": "VALVE-001",
                                                         "cropId": "CROP-001", "farmId": "FARM-001"}),
              ("DELETE", "/api/irrigation/schedules/{id}"), use_admin=True)
        RESULTS[-1]["id"] = "CRUD"
        RESULTS[-1]["evidence"] = "create verified separately (" + str(s) + "); " + RESULTS[-1]["evidence"]

    # valve
    vid = f"PROBE-VALVE-{uniq().upper()}"
    s, b, _ = call(GATEWAY, "POST", "/api/valves",
                  {"valveId": vid, "farmId": "FARM-001", "cropId": "CROP-001",
                   "zoneName": "Probe Zone", "flowRateLpm": 42.0}, token=atok)
    record("CRUD", "crud", "Valve /api/valves supports Create",
           "PRESENT" if s in (200, 201) else "MISSING",
           f"POST /api/valves -> {s} {str(b)[:100]}")
    if s in (200, 201):
        call(GATEWAY, "DELETE", f"/api/valves/{vid}", token=atok)

    # account lifecycle
    s, b, _ = call(GATEWAY, "PUT", "/api/auth/me", {"currentPassword": "ProbePass123",
                                                    "newPassword": "ProbePass456"}, token=tok)
    record("CRUD", "crud", "Account password can be changed (Update)",
           "PRESENT" if s in (200, 204) else "MISSING", f"PUT /api/auth/me -> {s} {str(b)[:100]}")
    s, b, _ = call(GATEWAY, "DELETE", "/api/auth/me", token=tok)
    record("CRUD", "crud", "Account can be deleted (Delete)",
           "PRESENT" if s in (200, 204) else "MISSING", f"DELETE /api/auth/me -> {s} {str(b)[:100]}")


# --------------------------------------------------------------------- lb ----
def group_lb():
    print("\n== load balancing across Eureka replicas (rubric: CRUD with load balancing) ==")
    st, body, _ = call(GATEWAY, "POST", "/api/auth/login",
                       {"email": "farmer@agritech.io", "password": "farmer1234"})
    tok = token_of(st, body)
    if not tok:
        record("L00", "lb", "Demo login for LB probe", "INFO", f"login {st}")
        return
    N = 40
    for _ in range(N):
        call(GATEWAY, "GET", "/api/sensors", token=tok)
    counts = {}
    for port in (8082, 18082):
        s, b, _ = call(f"http://localhost:{port}", "GET", "/actuator/metrics/http.server.requests")
        if s == 200 and isinstance(b, dict):
            try:
                counts[port] = b["measurements"][0]["value"]
            except Exception:
                counts[port] = None
    if len(counts) == 2 and all(v is not None for v in counts.values()):
        spread = min(counts.values()) / max(counts.values()) if max(counts.values()) else 0
        record("L01", "lb", "Requests are distributed across sensor-service replicas",
               "SECURE" if min(counts.values()) > 0 else "VULNERABLE",
               f"{N} gateway calls -> per-instance counters {counts}")
    else:
        record("L01", "lb", "Requests are distributed across sensor-service replicas", "INFO",
               f"could not read replica metrics: {counts} (is the stack started with -Replicas?)")
    s, b, _ = call(EUREKA, "GET", "/eureka/apps", headers={"Accept": "application/json"})
    if s == 200 and isinstance(b, dict):
        apps = {a["name"]: len(a.get("instance", [])) for a in
                (b.get("applications", {}).get("application") or [])}
        record("L02", "lb", "All services registered with Eureka",
               "SECURE" if len(apps) >= 7 else "VULNERABLE", f"registry: {apps}")
    else:
        record("L02", "lb", "All services registered with Eureka", "INFO", f"/eureka/apps -> {s}")


# ------------------------------------------------------------------ main ----
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--group", default="all",
                    choices=["all", "auth", "idor", "harden", "crud", "lb"])
    ap.add_argument("--json", help="write machine-readable results to this path")
    args = ap.parse_args()

    groups = {"auth": group_auth, "idor": group_idor, "harden": group_harden,
              "crud": group_crud, "lb": group_lb}
    todo = list(groups) if args.group == "all" else [args.group]
    print(f"AgriTech security probes -> {GATEWAY}   groups: {', '.join(todo)}")
    for g in todo:
        groups[g]()

    bad = [r for r in RESULTS if r["verdict"] in ("VULNERABLE", "MISSING")]
    print("\n" + "=" * 78)
    print(f"{len(RESULTS)} checks, {len(bad)} failing")
    for r in bad:
        print(f"  {r['id']:<6} {r['verdict']:<10} {r['title']}")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(RESULTS, fh, indent=2)
        print(f"\nwrote {args.json}")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
