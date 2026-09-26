#!/usr/bin/env bash
# Service discovery + load balancing check. Needs the stack started with replicas:
#   .\scripts\stack.ps1 start -Replicas      then      bash scripts/lb-test.sh
set -uo pipefail

GATEWAY="${1:-http://localhost:8080}"
EUREKA="${2:-http://localhost:8761}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() { # check <name> <condition-result>
  if [ "$2" = "0" ]; then printf '  PASS  %s\n' "$1"; pass=$((pass + 1))
  else printf '  FAIL  %s\n' "$1"; fail=$((fail + 1)); fi
}

json() { python -c "import json,sys;print($1)" < "$2" 2>/dev/null; }

# Requests an instance has served for one URI template, from its own actuator metrics.
hits() { # hits <port> <uri>
  local uri="${2//\{/%7B}"; uri="${uri//\}/%7D}"   # Tomcat rejects raw braces in a query
  curl -s "http://localhost:$1/actuator/metrics/http.server.requests?tag=uri:$uri" > "$TMP/m.json"
  json "int(sum(m['value'] for m in json.load(sys.stdin)['measurements'] if m['statistic']=='COUNT'))" "$TMP/m.json" || echo 0
}

code() { cat "$TMP/code"; }

curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@agritech.io","password":"admin1234"}' > "$TMP/admin.json"
ADMIN=$(json "json.load(sys.stdin)['token']" "$TMP/admin.json")
AUTH=(-H "Authorization: Bearer $ADMIN")

echo "== Service identification (Eureka registry) =="

curl -s -H 'Accept: application/json' "$EUREKA/eureka/apps" > "$TMP/apps.json"
python - "$TMP/apps.json" <<'EOF'
import json, sys
for app in json.load(open(sys.argv[1]))['applications']['application']:
    for i in app['instance']:
        print(f"        {app['name']:<20} {i['instanceId']:<48} {i['status']}")
EOF
for svc in SENSOR-SERVICE CROP-SERVICE IRRIGATION-SERVICE; do
  n=$(json "len([i for a in json.load(sys.stdin)['applications']['application'] if a['name']=='$svc' for i in a['instance'] if i['status']=='UP'])" "$TMP/apps.json")
  [ "${n:-0}" -ge 2 ]; check "$svc has 2+ UP instances registered" $?
done
ids=$(json "len({i['instanceId'] for a in json.load(sys.stdin)['applications']['application'] for i in a['instance']})" "$TMP/apps.json")
all=$(json "sum(len(a['instance']) for a in json.load(sys.stdin)['applications']['application'])" "$TMP/apps.json")
[ "$ids" = "$all" ]; check "every instance has a unique instance id ($all instances)" $?

echo
echo "== Gateway load balancing (lb://) =="

lb_check() { # lb_check <label> <uri-template> <gateway-path> <port1> <port2>
  local a0 b0 a1 b1
  a0=$(hits "$4" "$2"); b0=$(hits "$5" "$2")
  for _ in $(seq 20); do curl -s -o /dev/null "${AUTH[@]}" "$GATEWAY$3"; done
  a1=$(hits "$4" "$2"); b1=$(hits "$5" "$2")
  [ $((a1 - a0)) -ge 5 ] && [ $((b1 - b0)) -ge 5 ]
  check "$1: 20 requests split $((a1 - a0)) / $((b1 - b0)) across :$4 and :$5" $?
}
lb_check "sensor-service"     /api/sensors/summary      /api/sensors/summary      8082 18082
lb_check "crop-service"       /api/crops/summary        /api/crops/summary        8083 18083
lb_check "irrigation-service" /api/valves/summary       /api/valves/summary       8084 18084

echo
echo "== Replicas share state =="

curl -s -o /dev/null -X DELETE "${AUTH[@]}" "$GATEWAY/api/sensors/SENSOR-LB-TEST"
curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/sensors/register" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"SENSOR-LB-TEST","farmId":"FARM-001","sensorType":"soil-ph","fieldId":"CROP-FIELD-01"}' > "$TMP/code"
[ "$(code)" = "201" ]; check "device registered through the gateway" $?
ok=0; for _ in $(seq 8); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/sensors/SENSOR-LB-TEST")" = "200" ] && ok=$((ok + 1))
done
[ "$ok" = "8" ]; check "new device is readable from every sensor instance ($ok/8)" $?
curl -s -o /dev/null -X DELETE "${AUTH[@]}" "$GATEWAY/api/sensors/SENSOR-LB-TEST"

curl -s -X POST "$GATEWAY/api/irrigation/schedules" "${AUTH[@]}" -H 'Content-Type: application/json' \
  -d '{"cropId":"CROP-FIELD-01","valveId":"VALVE-FIELD-01","startTime":"05:00","durationMinutes":10}' > "$TMP/sched.json"
SCHEDULE=$(json "json.load(sys.stdin)['scheduleId']" "$TMP/sched.json")
ok=0; for _ in $(seq 8); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/irrigation/schedules/$SCHEDULE")" = "200" ] && ok=$((ok + 1))
done
[ "$ok" = "8" ]; check "new schedule is readable from every irrigation instance ($ok/8)" $?
curl -s -o /dev/null -X DELETE "${AUTH[@]}" "$GATEWAY/api/irrigation/schedules/$SCHEDULE"

echo
echo "== Inter-service calls are load balanced through Eureka =="

# crop-service -> sensor-service (@LoadBalanced RestTemplate, http://sensor-service/...)
URI=/api/telemetry/field/{fieldId}/series
a0=$(hits 8082 "$URI"); b0=$(hits 18082 "$URI")
for _ in $(seq 10); do curl -s -o /dev/null "${AUTH[@]}" "$GATEWAY/api/crops/CROP-FIELD-01/metrics?range=7d"; done
a1=$(hits 8082 "$URI"); b1=$(hits 18082 "$URI")
[ $((a1 - a0)) -ge 1 ] && [ $((b1 - b0)) -ge 1 ]
check "crop -> sensor calls reach both sensor instances ($((a1 - a0)) / $((b1 - b0)))" $?

# irrigation-service -> crop-service (valve open checks the field's health first)
URI=/api/crops/{cropId}/health
a0=$(hits 8083 "$URI"); b0=$(hits 18083 "$URI")
for _ in $(seq 6); do
  curl -s -o /dev/null -X POST "${AUTH[@]}" "$GATEWAY/api/valves/VALVE-FIELD-01/open?durationMinutes=1"
  curl -s -o /dev/null -X POST "${AUTH[@]}" "$GATEWAY/api/valves/VALVE-FIELD-01/close"
done
a1=$(hits 8083 "$URI"); b1=$(hits 18083 "$URI")
[ $((a1 - a0)) -ge 1 ] && [ $((b1 - b0)) -ge 1 ]
check "irrigation -> crop calls reach both crop instances ($((a1 - a0)) / $((b1 - b0)))" $?

echo
echo "== Failover: one sensor instance dies =="

# Hard kill, so it is still listed in Eureka for up to 90 s: callers must route around it.
powershell -NoProfile -Command \
  "Stop-Process -Force -Id (Get-NetTCPConnection -LocalPort 18082 -State Listen).OwningProcess"
ok=0; for _ in $(seq 20); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/sensors/summary")" = "200" ] && ok=$((ok + 1))
done
[ "$ok" = "20" ]; check "gateway retries on the live instance: $ok/20 requests OK" $?

ok=0; for _ in $(seq 6); do
  curl -s "${AUTH[@]}" "$GATEWAY/api/crops/CROP-FIELD-01/metrics?range=24h" > "$TMP/metrics.json"
  [ "$(json "len(json.load(sys.stdin)['environment'])" "$TMP/metrics.json")" -gt 0 ] 2>/dev/null && ok=$((ok + 1))
done
[ "$ok" = "6" ]; check "crop -> sensor retries on the live instance: $ok/6 got sensor data" $?

echo "  ..restarting sensor-service#2"
powershell -NoProfile -ExecutionPolicy Bypass -File "$(dirname "$0")/stack.ps1" start -Replicas -SkipBuild > /dev/null

echo
echo "-------------------------------------"
echo "passed: $pass   failed: $fail"
[ "$fail" = "0" ]
