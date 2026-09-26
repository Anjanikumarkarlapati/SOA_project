#!/usr/bin/env bash
# End-to-end check of the running stack (PRD 9.3 scenarios 1 and 2).
# Usage: bash scripts/smoke-test.sh [gateway-url]
set -uo pipefail

GATEWAY="${1:-http://localhost:8080}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() { # check <name> <condition-result>
  if [ "$2" = "0" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  else printf '  FAIL  %s\n' "$1"; fail=$((fail + 1)); fi
}

json() { python -c "import json,sys;print($1)" < "$2" 2>/dev/null; }

echo "== Scenario 2: authentication, routing, authorization =="

curl -s -o "$TMP/anon.json" -w '%{http_code}' "$GATEWAY/api/sensors" > "$TMP/code"
[ "$(cat "$TMP/code")" = "401" ]; check "unauthenticated request is rejected at the gateway" $?

curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@agritech.io","password":"admin1234"}' > "$TMP/admin.json"
ADMIN=$(json "json.load(sys.stdin)['token']" "$TMP/admin.json")
[ -n "$ADMIN" ]; check "admin login returns a JWT" $?

curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"farmer@agritech.io","password":"farmer1234"}' > "$TMP/farmer.json"
FARMER=$(json "json.load(sys.stdin)['token']" "$TMP/farmer.json")
[ "$(json "json.load(sys.stdin)['role']" "$TMP/farmer.json")" = "FARMER" ]; check "farmer login carries the FARMER role" $?

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"admin@agritech.io","password":"wrong"}' > "$TMP/code"
[ "$(cat "$TMP/code")" = "401" ]; check "wrong password is rejected" $?

curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer tampered.token.here" \
  "$GATEWAY/api/sensors" > "$TMP/code"
[ "$(cat "$TMP/code")" = "401" ]; check "forged token is rejected" $?

# FR-2: a farmer may read, but must not register devices.
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $FARMER" "$GATEWAY/api/sensors" > "$TMP/code"
[ "$(cat "$TMP/code")" = "200" ]; check "farmer can read sensor data" $?

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/sensors/register" \
  -H "Authorization: Bearer $FARMER" -H 'Content-Type: application/json' \
  -d '{"deviceId":"SENSOR-TEST-999","farmId":"FARM-001","sensorType":"soil-moisture-temperature"}' > "$TMP/code"
[ "$(cat "$TMP/code")" = "403" ]; check "farmer cannot register a device (FR-2)" $?

echo
echo "== Scenario 1: ingestion -> crop health -> irrigation =="

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/sensors/register" \
  -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"deviceId":"SENSOR-TEST-999","farmId":"FARM-001","sensorType":"soil-moisture-temperature","fieldId":"CROP-FIELD-01","latitude":17.38,"longitude":78.48}' > "$TMP/code"
[ "$(cat "$TMP/code")" = "201" ]; check "admin registers a device" $?

curl -s -X POST "$GATEWAY/api/telemetry/ingest" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"readings":[{"deviceId":"SENSOR-TEST-999","soilMoisture":64.2,"soilTemperature":22.1,"ph":6.5,"batteryPercent":88}]}' > "$TMP/ingest.json"
[ "$(json "json.load(sys.stdin)['accepted']" "$TMP/ingest.json")" = "1" ]; check "valid telemetry is accepted" $?

curl -s -X POST "$GATEWAY/api/telemetry/ingest" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"readings":[{"deviceId":"SENSOR-TEST-999","soilMoisture":812,"soilTemperature":22.1,"ph":6.5}]}' > "$TMP/bad.json"
[ "$(json "json.load(sys.stdin)['accepted']" "$TMP/bad.json")" = "0" ]; check "out-of-range telemetry is rejected (FR-4)" $?

curl -s -X POST "$GATEWAY/api/crops/analyze" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"cropId":"CROP-FIELD-01"}' > "$TMP/analyze.json"
SCORE=$(json "json.load(sys.stdin)['results'][0]['healthScore']" "$TMP/analyze.json")
[ -n "$SCORE" ] && [ "$SCORE" -ge 0 ] && [ "$SCORE" -le 100 ]
check "crop health score computed from live telemetry: ${SCORE:-none}/100 (FR-5)" $?

curl -s -H "Authorization: Bearer $ADMIN" "$GATEWAY/api/crops/CROP-FIELD-01/metrics?range=24h" > "$TMP/metrics.json"
[ "$(json "len(json.load(sys.stdin)['environment']) > 0" "$TMP/metrics.json")" = "True" ]
check "crop-service reaches sensor-service through Eureka for trends (FR-9)" $?

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/valves/VALVE-FIELD-01/open?durationMinutes=2" \
  -H "Authorization: Bearer $ADMIN" > "$TMP/code"
OPEN_CODE=$(cat "$TMP/code")
[ "$OPEN_CODE" = "200" ] || [ "$OPEN_CODE" = "409" ]
check "manual valve open returns 200, or 409 when the field is already saturated (got $OPEN_CODE)" $?

curl -s -H "Authorization: Bearer $ADMIN" "$GATEWAY/api/valves/VALVE-FIELD-01/status" > "$TMP/valve.json"
[ -n "$(json "json.load(sys.stdin)['state']" "$TMP/valve.json")" ]; check "valve status is readable (FR-8)" $?

curl -s -X POST "$GATEWAY/api/valves/emergency-stop?reason=smoke-test" \
  -H "Authorization: Bearer $ADMIN" > "$TMP/stop.json"
[ -n "$(json "json.load(sys.stdin)['closed']" "$TMP/stop.json")" ]; check "emergency stop closes all valves (FR-8)" $?

curl -s -X POST "$GATEWAY/api/irrigation/schedules" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' \
  -d '{"cropId":"CROP-FIELD-01","valveId":"VALVE-FIELD-01","startTime":"06:00","durationMinutes":20,"recurrence":"DAILY"}' > "$TMP/sched.json"
SCHEDULE=$(json "json.load(sys.stdin)['scheduleId']" "$TMP/sched.json")
[ -n "$SCHEDULE" ]; check "schedule created (FR-7)" $?

curl -s -o /dev/null -w '%{http_code}' -X DELETE "$GATEWAY/api/irrigation/schedules/$SCHEDULE" \
  -H "Authorization: Bearer $ADMIN" > "$TMP/code"
[ "$(cat "$TMP/code")" = "200" ]; check "schedule deleted (FR-7)" $?

echo
echo "== Scenario 3: service discovery, token lifecycle, gateway hardening =="

EUREKA="${EUREKA:-http://localhost:8761}"
curl -s -H 'Accept: application/json' "$EUREKA/eureka/apps" > "$TMP/apps.json"
[ "$(json "sorted(a['name'] for a in json.load(sys.stdin)['applications']['application'])" "$TMP/apps.json")" \
  = "['API-GATEWAY', 'AUTH-SERVICE', 'CROP-SERVICE', 'IRRIGATION-SERVICE', 'SENSOR-SERVICE']" ]
check "all five services are registered in Eureka" $?

[ "$(json "json.load(sys.stdin)['expiresIn']" "$TMP/admin.json")" = "900" ]
check "access tokens are short-lived (15 min)" $?

REFRESH=$(json "json.load(sys.stdin)['refreshToken']" "$TMP/admin.json")
curl -s -X POST "$GATEWAY/api/auth/refresh" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" > "$TMP/refreshed.json"
ADMIN=$(json "json.load(sys.stdin)['token']" "$TMP/refreshed.json")
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $ADMIN" "$GATEWAY/api/sensors" > "$TMP/code"
[ -n "$ADMIN" ] && [ "$(cat "$TMP/code")" = "200" ]; check "refresh token yields a working new access token" $?

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/auth/refresh" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}" > "$TMP/code"
[ "$(cat "$TMP/code")" = "401" ]; check "a used refresh token cannot be replayed (rotation)" $?

curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/api/auth/loginX" > "$TMP/code"
[ "$(cat "$TMP/code")" = "401" ]; check "public paths are exact matches, not prefixes" $?

curl -s -o /dev/null -w '%{http_code}' -H 'X-User-Role: ADMIN' -H 'X-User-Email: evil@x.io' \
  "http://localhost:8082/api/sensors" > "$TMP/code"
[ "$(cat "$TMP/code")" = "401" ]; check "direct call to a service with forged ADMIN headers is rejected" $?

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/sensors/register" \
  -H "Authorization: Bearer $FARMER" -H 'X-User-Role: ADMIN' -H 'Content-Type: application/json' \
  -d '{"deviceId":"SENSOR-TEST-998","farmId":"FARM-001","sensorType":"soil-moisture-temperature"}' > "$TMP/code"
[ "$(cat "$TMP/code")" = "403" ]; check "farmer cannot escalate by sending X-User-Role: ADMIN" $?

curl -s -D "$TMP/headers" -o /dev/null -H "Authorization: Bearer $ADMIN" "$GATEWAY/api/crops"
hdr() { grep -i "^$1:" "$TMP/headers" > /dev/null; }
hdr X-Content-Type-Options && hdr X-Frame-Options && hdr Strict-Transport-Security && hdr Content-Security-Policy
check "OWASP security headers on every routed response" $?
hdr X-Request-Id; check "correlation id (X-Request-Id) is assigned" $?
hdr X-RateLimit-Remaining; check "rate-limit headers are returned" $?
grep -i "^Cache-Control:.*no-store" "$TMP/headers" > /dev/null; check "API responses are marked no-store" $?

head -c 1100000 /dev/zero | tr '\0' 'a' > "$TMP/big.txt"
curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/telemetry/ingest" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' --data-binary "@$TMP/big.txt" > "$TMP/code"
[ "$(cat "$TMP/code")" = "413" ]; check "request bodies over 1 MB are refused (413)" $?

curl -s -H "Authorization: Bearer $ADMIN" "$GATEWAY/actuator/circuitbreakers" > "$TMP/cb.json"
[ "$(json "len(json.load(sys.stdin)['circuitBreakers'])" "$TMP/cb.json")" = "4" ]
check "a circuit breaker guards each of the four routes" $?

echo
echo "== Cleanup and logout =="

curl -s -o /dev/null -X DELETE "$GATEWAY/api/sensors/SENSOR-TEST-999" -H "Authorization: Bearer $ADMIN"

curl -s -o /dev/null -X POST "$GATEWAY/api/auth/logout" -H "Authorization: Bearer $FARMER" \
  -H 'Content-Type: application/json' -d '{}'
echo "  ..waiting for the gateway to pick up the revocation list"
revoked=1
for _ in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $FARMER" "$GATEWAY/api/sensors")
  if [ "$code" = "401" ]; then revoked=0; break; fi
  sleep 3
done
check "logged-out token stops working at the gateway (FR-1)" $revoked

echo
echo "-------------------------------------"
printf 'passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
