#!/usr/bin/env bash
# CRUD + Load Balancing demonstration, driven entirely through the API gateway.
#
#   .\scripts\stack.ps1 start -Replicas      # bring the stack up with 2 replicas each
#   bash scripts/crud-demo.sh                # then run this
#
# It proves, in order: JWT is enforced, every CRUD verb works, the work is split
# round-robin across the two crop-service instances, and both instances see the
# same rows (shared database), so a write that lands on one is readable via the other.
#
# Optional: bash scripts/crud-demo.sh http://localhost:8080 8083 18083
set -uo pipefail

GATEWAY="${1:-http://localhost:8080}"
EUREKA="${EUREKA:-http://localhost:8761}"
PORT_A="${2:-8083}"       # crop-service primary
PORT_B="${3:-18083}"      # crop-service replica
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0
ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass + 1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail + 1)); }
say()  { printf '  %-46s %s\n' "$1" "$2"; }
sec()  { printf '\n\033[1m%s\033[0m\n' "$1"; }

j()    { python -c "import json,sys;print($1)" < "$2" 2>/dev/null; }
code() { cat "$TMP/code"; }

# Requests a given instance served for one uri template + method, from its own actuator metrics.
hits() { # hits <port> <uri-template> <METHOD>
  local uri="${2//\{/%7B}"; uri="${uri//\}/%7D}"   # Tomcat rejects raw braces in a query
  curl -s "http://localhost:$1/actuator/metrics/http.server.requests?tag=uri:$uri&tag=method:$3" \
    > "$TMP/m.json"
  json_count "$TMP/m.json"
}
json_count() {
  python -c "import json,sys;print(int(sum(m['value'] for m in json.load(open(sys.argv[1]))['measurements'] if m['statistic']=='COUNT')))" "$1" 2>/dev/null || echo 0
}

echo "AgriTech - CRUD + load balancing demo"
echo "  gateway : $GATEWAY"
echo "  eureka  : $EUREKA"

# ---------------------------------------------------------------- 1. JWT
sec "1. JWT authentication (rubric #2)"

curl -s -o /dev/null -w '%{http_code}' "$GATEWAY/api/crops" > "$TMP/code"
[ "$(code)" = "401" ] && ok "GET /api/crops with NO token        -> $(code) unauthorized" \
                     || bad "GET /api/crops with NO token        -> $(code), expected 401"

curl -s -X POST "$GATEWAY/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@agritech.io","password":"admin1234"}' > "$TMP/admin.json"
ADMIN=$(j "json.load(sys.stdin)['token']" "$TMP/admin.json")
[ -n "$ADMIN" ] && ok "POST /api/auth/login returns a JWT     (role=$(j "json.load(sys.stdin)['role']" "$TMP/admin.json"), ttl=$(j "json.load(sys.stdin)['expiresIn']" "$TMP/admin.json")s)" \
                || bad "POST /api/auth/login did not return a token"

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"admin@agritech.io","password":"wrong"}' > "$TMP/code"
[ "$(code)" = "401" ] && ok "wrong password                          -> $(code)" \
                     || bad "wrong password                          -> $(code), expected 401"

curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer tampered.token.here" \
  "$GATEWAY/api/crops" > "$TMP/code"
[ "$(code)" = "401" ] && ok "forged/tampered token                   -> $(code)" \
                     || bad "forged/tampered token                   -> $(code), expected 401"

AUTH=(-H "Authorization: Bearer $ADMIN")
curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/crops" > "$TMP/code"
[ "$(code)" = "200" ] && ok "GET /api/crops with valid Bearer token  -> $(code)" \
                     || bad "GET /api/crops with valid Bearer token  -> $(code)"

# ---------------------------------------------------------------- 2. CRUD
sec "2. CRUD operations through the gateway (crop-service)"

FIELD="Demo LB Field"

curl -s -o "$TMP/create.json" -w '%{http_code}' -X POST "$GATEWAY/api/crops" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"$FIELD\",\"cropType\":\"paddy\",\"areaHectares\":2.5}" > "$TMP/code"
CROP=$(j "json.load(sys.stdin)['cropId']" "$TMP/create.json")
if [ "$(code)" = "201" ] && [ -n "$CROP" ]; then
  ok "CREATE   POST   /api/crops              -> $(code)  id=$CROP"
else
  bad "CREATE   POST   /api/crops              -> $(code)  (no id)"
fi
say "" "        healthScore=$(j "json.load(sys.stdin).get('healthScore')" "$TMP/create.json")/100  cropType=$(j "json.load(sys.stdin).get('cropType')" "$TMP/create.json")"

curl -s -o "$TMP/read1.json" -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/crops/$CROP" > "$TMP/code"
[ "$(code)" = "200" ] && ok "READ     GET    /api/crops/$CROP -> $(code)  name=\"$(j "json.load(sys.stdin)['name']" "$TMP/read1.json")\"" \
                     || bad "READ     GET    /api/crops/{id}  -> $(code)"

RENAMED="$FIELD (renamed)"
curl -s -o "$TMP/update.json" -w '%{http_code}' -X PUT "$GATEWAY/api/crops/$CROP" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "{\"name\":\"$RENAMED\",\"areaHectares\":3.75}" > "$TMP/code"
[ "$(code)" = "200" ] && ok "UPDATE   PUT    /api/crops/{id}  -> $(code)  name=\"$(j "json.load(sys.stdin)['name']" "$TMP/update.json")\"" \
                     || bad "UPDATE   PUT    /api/crops/{id}  -> $(code)"

curl -s -o "$TMP/read2.json" -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/crops/$CROP" > "$TMP/code"
[ "$(j "json.load(sys.stdin)['name']" "$TMP/read2.json")" = "$RENAMED" ] \
  && ok "READ again returns the updated row     -> name=\"$(j "json.load(sys.stdin)['name']" "$TMP/read2.json")\"" \
  || bad "READ again still shows the old row"

curl -s -o "$TMP/list.json" -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/crops" > "$TMP/code"
say "READ     GET    /api/crops (collection)" "-> $(code)  $(j "len(json.load(sys.stdin))" "$TMP/list.json") fields, contains $CROP: $(j "any(c['cropId']=='$CROP' for c in json.load(sys.stdin))" "$TMP/list.json")"

curl -s -o "$TMP/delete.json" -w '%{http_code}' -X DELETE "${AUTH[@]}" "$GATEWAY/api/crops/$CROP" > "$TMP/code"
[ "$(code)" = "200" ] && ok "DELETE   DELETE /api/crops/{id}  -> $(code)" || bad "DELETE   DELETE /api/crops/{id}  -> $(code)"

curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/crops/$CROP" > "$TMP/code"
[ "$(code)" = "404" ] && ok "READ after delete is gone        -> $(code)" || bad "READ after delete              -> $(code), expected 404"

# ---------------------------------------------------------------- 3. Round robin
sec "3. Load balancing: 40 reads split across the two crop-service instances"

reps=$(curl -s -H 'Accept: application/json' "$EUREKA/eureka/apps" \
  | python -c "import json,sys;print(len([i for a in json.load(sys.stdin)['applications']['application'] if a['name']=='CROP-SERVICE' for i in a['instance'] if i['status']=='UP']))" 2>/dev/null)
say "CROP-SERVICE instances registered UP:" "${reps:-?}"
case "${reps:-0}" in (*[!0-9]*) reps=0;; esac; [ "$reps" -ge 2 ] && ok "service discovery reports 2+ healthy replicas" \
                      || bad "only ${reps:-0} replica(s) registered - start with: .\scripts\stack.ps1 start -Replicas"

a0=$(hits "$PORT_A" /api/crops GET); b0=$(hits "$PORT_B" /api/crops GET)
for _ in $(seq 40); do curl -s -o /dev/null "${AUTH[@]}" "$GATEWAY/api/crops"; done
a1=$(hits "$PORT_A" /api/crops GET); b1=$(hits "$PORT_B" /api/crops GET)
da=$((a1 - a0)); db=$((b1 - b0))

printf '\n  %-14s %-8s %-9s %-9s %s\n' "instance" "port" "before" "after" "served these 40"
printf '  %-14s %-8s %-9s %-9s %s\n' "crop-service" "$PORT_A" "$a0" "$a1" "$da"
printf '  %-14s %-8s %-9s %-9s %s\n' "crop-service" "$PORT_B" "$b0" "$b1" "$db"
echo
[ "$da" -ge 10 ] && [ "$db" -ge 10 ] \
  && ok "round-robin: $da / $db of 40 requests went to each replica" \
  || bad "traffic did not split evenly ($da / $db) - is the replica running?"

# ---------------------------------------------------------------- 4. Shared state
sec "4. Both replicas share one database (a write on one reads on the other)"

curl -s -o "$TMP/c2.json" -w '%{http_code}' -X POST "$GATEWAY/api/crops" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Shared State Field","cropType":"maize","areaHectares":1.2}' > "$TMP/code"
C2=$(j "json.load(sys.stdin)['cropId']" "$TMP/c2.json")
say "created via the gateway (lands on one replica):" "$C2"

found=0
for _ in $(seq 10); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/crops/$C2")" = "200" ] && found=$((found + 1))
done
[ "$found" = "10" ] && ok "readable on every one of 10 alternating requests ($found/10)" \
                   || bad "some instances could not see the new row ($found/10)"
curl -s -o /dev/null -X DELETE "${AUTH[@]}" "$GATEWAY/api/crops/$C2"

# ---------------------------------------------------------------- 5. Other services
sec "5. Same CRUD shape on the other load-balanced services"

curl -s -o /dev/null -w '%{http_code}' -X POST "$GATEWAY/api/sensors/register" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"SENSOR-DEMO-1","farmId":"FARM-001","sensorType":"soil-moisture-temperature"}' > "$TMP/code"
[ "$(code)" = "201" ] && ok "sensor-service  CREATE device          -> $(code)" || bad "sensor-service  CREATE device          -> $(code)"

curl -s -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$GATEWAY/api/sensors/SENSOR-DEMO-1" > "$TMP/code"
[ "$(code)" = "200" ] && ok "sensor-service  READ device            -> $(code)" || bad "sensor-service  READ device            -> $(code)"

curl -s -o "$TMP/sched.json" -w '%{http_code}' -X POST "$GATEWAY/api/irrigation/schedules" "${AUTH[@]}" \
  -H 'Content-Type: application/json' \
  -d '{"cropId":"CROP-FIELD-01","valveId":"VALVE-FIELD-01","startTime":"06:00","durationMinutes":15}' > "$TMP/code"
SCHED=$(j "json.load(sys.stdin)['scheduleId']" "$TMP/sched.json")
[ "$(code)" = "201" ] || [ "$(code)" = "200" ] \
  && ok "irrigation    CREATE schedule        -> $(code)  id=$SCHED" || bad "irrigation    CREATE schedule        -> $(code)"

curl -s -o /dev/null -w '%{http_code}' -X DELETE "${AUTH[@]}" "$GATEWAY/api/irrigation/schedules/$SCHED" > "$TMP/code"
[ "$(code)" = "200" ] && ok "irrigation    DELETE schedule          -> $(code)" || bad "irrigation    DELETE schedule          -> $(code)"

curl -s -o /dev/null -X DELETE "${AUTH[@]}" "$GATEWAY/api/sensors/SENSOR-DEMO-1"

echo
echo "  -------------------------------------"
printf '  passed: %d   failed: %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
