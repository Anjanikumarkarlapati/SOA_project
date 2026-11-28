# AgriTech goal implementation plan

This plan tracks the requested auth, property, climate/recommendation, and React UI work against the current Maven/React workspace.

## Phase 1: Auth and persistence

1. Keep PostgreSQL schema ownership in Flyway and JPA validation in `auth-service`.
2. Preserve UUID users with unique email/provider identity, transactional registration/login upserts, `last_login_at` updates, and JWT issuance only after persistence succeeds.
3. Keep bean validation and the shared API exception handler; retain the user persistence and web tests for new users, existing users, duplicates, and database failures.
4. Keep login/sign-up, session context, loading/error feedback, and route guards in the React app.

Current implementation is in `auth-service/src/main/java/com/agritech/auth` and `auth-service/src/main/resources/db/migration`.

## Phase 2: Property registration

1. Add versioned property, water-detail, crop-intent, and crop-reference schema in the crop service's `crop_service` schema.
2. Scope property reads, writes, and deletes to the verified caller email. Keep create/list/get/update/delete routes under `/api/farm`.
3. Persist Google Maps coordinates, address, closed GeoJSON polygon, soil, water availability/source, irrigation, intent dates, and previous crops. Keep the Maps key in `VITE_GOOGLE_MAPS_API_KEY`.
4. Preserve step drafts in browser storage; validate each step, calculate boundary area, show sensor recommendations, and only navigate after the server confirms save.
5. Exercise GeoJSON and coordinate validation, property detail persistence, and the mapping from suggested hardware to supported telemetry capabilities.

Current routes: `GET /api/farm/properties`, `GET /api/farm/properties/{propertyId}`, `POST /api/farm/properties`, `PUT /api/farm/properties/{propertyId}`, `DELETE /api/farm/properties/{propertyId}`. First-property setup remains available at `PUT /api/farm/me` for compatibility.

Example request:

```json
{
  "farmName": "North Field",
  "landSize": 4.2,
  "landUnit": "ACRES",
  "cropId": "wheat",
  "state": "Maharashtra",
  "district": "Pune",
  "sensors": ["air-temperature", "humidity", "rainfall", "npk"],
  "profile": {
    "lat": 18.52,
    "lon": 73.85,
    "address": "Pune, Maharashtra",
    "boundaryGeoJson": "{\"type\":\"Polygon\",\"coordinates\":[[[73.84,18.52],[73.86,18.52],[73.86,18.53],[73.84,18.52]]]} ",
    "soilType": "black",
    "waterSource": "canal",
    "waterAvailability": "seasonal",
    "irrigationType": "drip",
    "cropIntent": "PLAN_DATES",
    "intendedSeason": "Rabi 2026",
    "intentStartDate": "2026-11-01",
    "intentEndDate": "2027-03-31",
    "previousCrops": ["rice", "chickpea"]
  }
}
```

## Phase 3: Climate and crop recommendations

1. Fetch 10-year default, up to 30-year historical daily data from Open-Meteo; cache successful responses and serve stale data if refresh fails.
2. Keep formula comments and known-input tests for summary distributions, OLS trends, GDD, ET₀, water balance, drought/heat risk, and extreme-event rates.
3. Store crop temperature, water, soil, season, and duration reference values; rank a maximum of five crops with weights controlled by environment settings.
4. Respect `GROW_NOW`, `PLAN_DATES`, and `RECOMMEND_BEST`; include water estimates, windows, risk, reasons, and climate adaptation flags.
5. Keep climate retrieval and statistics in the independently registered `climate-service`; keep the crop reference table and weighted scorer in `recommendation-service`. The owner-checked crop-service property endpoints call those services with signed service identity, and the gateway also exposes authenticated `/api/climate/**` and `/api/recommendations/**` routes.

Current property-scoped routes are `GET /api/farm/properties/{propertyId}/climate` and `GET /api/farm/properties/{propertyId}/recommendations`. The gateway also exposes `GET /api/climate/history?lat=...&lon=...&start=...&end=...` and `POST /api/recommendations/score`. Open-Meteo data is model/reanalysis output and is identified as such in the API response.

## Phase 4: React experience

1. Keep protected routes in the shared layout for Dashboard, Properties, Property detail, Climate, Recommendations, Sensors, Irrigation, and Profile/Settings. Login and sign-up remain public.
2. Use loading, empty, retry, and error states; keep navigation responsive and form labels and map controls keyboard accessible.
3. Use the gateway-backed property, climate, recommendation, sensor, crop, and irrigation APIs; show climate and recommendation results with Recharts.
4. Complete the manual screen-reader, keyboard, narrow-mobile, and real-property API QA after the service modules are extracted.

## Setup and verification

1. Configure PostgreSQL with `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD`, or use each service's local H2 defaults.
2. Set `AGRITECH_JWT_SECRET`; for Google login configure Supabase variables in the root `.env` and `frontend/.env`.
3. Enable Maps JavaScript API, Places API (New), and billing in Google Cloud, then set `VITE_GOOGLE_MAPS_API_KEY` in `frontend/.env`.
4. Start the service stack with the repository's `scripts/run-stack-daemon.ps1` helper and start the UI from `frontend` with `npm run dev`.
5. Run `npm test`, `npm run build`, and the Maven test suite from the repository root. Use `scripts/e2e/all-pages.js` for authenticated screen checks when the stack is available.
