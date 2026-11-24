import { expect, type Page, type Route } from "@playwright/test";

const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

export interface OpenMeteoOverrides {
  rainProbMax?: number;
  todayRainMm?: number;
  soilMoistureRatio?: number;
  soilTempC?: number;
  todayEt0?: number;
  windSpeedKmh?: number;
  temperatureC?: number;
}

function buildOpenMeteoPayload(
  mode: "normal" | "rain-hold",
  overrides: OpenMeteoOverrides = {}
): Record<string, unknown> {
  const isRainHold = mode === "rain-hold";
  const todayRainProb = overrides.rainProbMax ?? (isRainHold ? 85 : 10);
  const todayRainMm = overrides.todayRainMm ?? (isRainHold ? 18.5 : 0.0);
  const soilMoistureRatio = overrides.soilMoistureRatio ?? (isRainHold ? 0.88 : 0.28);
  const soilTempC = overrides.soilTempC ?? (isRainHold ? 21.0 : 23.5);
  const todayEt0 = overrides.todayEt0 ?? (isRainHold ? 2.1 : 4.5);
  const windSpeed = overrides.windSpeedKmh ?? (isRainHold ? 28.0 : 8.2);
  const tempNow = overrides.temperatureC ?? (isRainHold ? 22.0 : 26.5);

  const days = Array.from({ length: 14 }, (_, idx) => {
    const day = 10 + idx;
    return `2026-11-${String(day).padStart(2, "0")}`;
  });

  const hours = Array.from({ length: 24 }, (_, idx) => {
    return `2026-11-10T${String(idx).padStart(2, "0")}:00`;
  });

  return {
    latitude: 30.901,
    longitude: 75.857,
    elevation: 247,
    timezone: "Asia/Kolkata",
    current: {
      time: "2026-11-10T12:00",
      temperature_2m: tempNow,
      relative_humidity_2m: isRainHold ? 88 : 56,
      apparent_temperature: tempNow + 0.8,
      precipitation: isRainHold ? 4.2 : 0.0,
      rain: isRainHold ? 4.2 : 0.0,
      weather_code: isRainHold ? 63 : 1,
      surface_pressure: 1012.4,
      wind_speed_10m: windSpeed,
      wind_direction_10m: 265,
      wind_gusts_10m: windSpeed + 6,
      uv_index: isRainHold ? 2.1 : 6.2,
    },
    daily: {
      time: days,
      weather_code: days.map((_, i) => (i === 0 && isRainHold ? 63 : 1)),
      temperature_2m_max: days.map((_, i) => (i === 0 && isRainHold ? 24.5 : 29.0)),
      temperature_2m_min: days.map(() => 15.0),
      apparent_temperature_max: days.map(() => 29.5),
      apparent_temperature_min: days.map(() => 14.5),
      precipitation_sum: days.map((_, i) => (i === 0 ? todayRainMm : i === 3 && isRainHold ? 12.0 : 0.0)),
      rain_sum: days.map((_, i) => (i === 0 ? todayRainMm : 0.0)),
      precipitation_hours: days.map((_, i) => (i === 0 && isRainHold ? 6 : 0)),
      precipitation_probability_max: days.map((_, i) => (i === 0 ? todayRainProb : 15)),
      wind_speed_10m_max: days.map(() => windSpeed + 3),
      wind_gusts_10m_max: days.map(() => windSpeed + 10),
      wind_direction_10m_dominant: days.map(() => 270),
      shortwave_radiation_sum: days.map(() => 17.4),
      et0_fao_evapotranspiration: days.map((_, i) => (i === 0 ? todayEt0 : 4.2)),
      uv_index_max: days.map(() => 6.0),
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => tempNow - 2),
      relative_humidity_2m: hours.map(() => (isRainHold ? 86 : 60)),
      dew_point_2m: hours.map(() => 13.0),
      precipitation_probability: hours.map(() => todayRainProb),
      precipitation: hours.map((_, i) => (i === 0 && isRainHold ? 2.5 : 0.0)),
      weather_code: hours.map(() => (isRainHold ? 63 : 1)),
      surface_pressure: hours.map(() => 1012.0),
      soil_temperature_0cm: hours.map(() => soilTempC),
      soil_temperature_6cm: hours.map(() => soilTempC - 0.8),
      soil_temperature_18cm: hours.map(() => soilTempC - 1.5),
      soil_moisture_0_to_1cm: hours.map(() => soilMoistureRatio),
      soil_moisture_1_to_3cm: hours.map(() => Math.min(0.95, soilMoistureRatio + 0.02)),
      soil_moisture_3_to_9cm: hours.map(() => Math.min(0.95, soilMoistureRatio + 0.04)),
      vapour_pressure_deficit: hours.map(() => (isRainHold ? 0.35 : 1.1)),
      et0_fao_evapotranspiration: hours.map(() => Number((todayEt0 / 24).toFixed(2))),
    },
  };
}

export async function mockOpenMeteo(
  page: Page,
  mode: "normal" | "rain-hold" | "error" = "normal",
  overrides?: OpenMeteoOverrides
): Promise<void> {
  await page.route("https://api.open-meteo.com/v1/forecast**", async (route: Route) => {
    if (mode === "error") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: true, reason: "Simulated Open-Meteo outage" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(buildOpenMeteoPayload(mode, overrides)),
    });
  });
}

export async function mockExternalMapAndFonts(page: Page): Promise<void> {
  await page.route("https://nominatim.openstreetmap.org/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/search")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            lat: "30.9010",
            lon: "75.8570",
            display_name: "Ludhiana, Punjab, India",
          },
        ]),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        place_id: 1001,
        display_name: "Raikot, Ludhiana, Punjab, India",
        address: {
          village: "Raikot",
          town: "Ludhiana",
          state: "Punjab",
          country: "India",
        },
      }),
    });
  });

  const pngBytes = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
  const fulfillTile = async (route: Route): Promise<void> => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: pngBytes,
    });
  };

  await page.route("**/*arcgisonline.com/**", fulfillTile);
  await page.route("**/*tile.openstreetmap.org/**", fulfillTile);
  await page.route("**/*tile.opentopomap.org/**", fulfillTile);

  await page.route("**/*fonts.googleapis.com/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/css",
      body: "/* mocked google fonts */",
    });
  });

  await page.route("**/*fonts.gstatic.com/**", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "font/woff2",
      body: Buffer.alloc(0),
    });
  });
}

const offlineGatewayPages = new WeakSet<Page>();

export async function mockBackendOffline(page: Page): Promise<void> {
  offlineGatewayPages.add(page);
  await page.route("http://localhost:8080/api/**", async (route: Route) => {
    await route.abort("connectionrefused");
  });
}

export interface RecordedBackendCall {
  method: string;
  path: string;
  body: unknown;
}

export interface BackendOnlineOptions {
  rejectLogin?: boolean;
  email?: string;
  name?: string;
  role?: string;
  farmId?: string;
  properties?: Record<string, unknown>[];
  recordedCalls?: RecordedBackendCall[];
}

export async function mockBackendOnline(
  page: Page,
  options: BackendOnlineOptions = {}
): Promise<void> {
  offlineGatewayPages.delete(page);
  const email = options.email ?? "farmer@agritech.test";
  const name = options.name ?? "Ravi Kumar";
  const role = options.role ?? "FARMER";
  const farmId = options.farmId ?? "farm-online-1";
  const properties = [...(options.properties ?? [])];
  const sensors: Record<string, unknown>[] = [];
  const schedules: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const valves: Record<string, unknown>[] = [
    {
      valveId: "VALVE-FIELD-01",
      farmId,
      cropId: "CROP-FIELD-01",
      zoneName: "North Furrow",
      state: "CLOSED",
      flowRateLpm: 0,
      ratedFlowLpm: 120,
      lastChangedAt: new Date().toISOString(),
      openUntil: null,
      secondsRemaining: null,
      runningScheduleId: null,
    },
  ];

  await page.route("http://localhost:8080/api/**", async (route: Route) => {
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const path = url.pathname;

    let parsedBody: unknown = null;
    const postData = req.postData();
    if (postData) {
      try {
        parsedBody = JSON.parse(postData) as unknown;
      } catch {
        parsedBody = postData;
      }
    }

    if (options.recordedCalls) {
      options.recordedCalls.push({ method, path, body: parsedBody });
    }

    if (path === "/api/auth/login" && method === "POST") {
      if (options.rejectLogin) {
        await route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({ message: "Invalid email or password" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: "jwt-online-valid-token",
          refreshToken: "refresh-online-token",
          email,
          role,
          farmId,
          name,
          expiresIn: 3600,
        }),
      });
      return;
    }

    if (path === "/api/auth/register" && method === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          token: "jwt-online-valid-token",
          refreshToken: "refresh-online-token",
          email,
          role,
          farmId,
          name,
          expiresIn: 3600,
        }),
      });
      return;
    }

    if (path === "/api/auth/me" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ email, role, farmId, displayName: name }),
      });
      return;
    }

    if (path === "/api/auth/logout" && method === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if ((path === "/api/farm/properties" || path === "/api/properties") && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(properties),
      });
      return;
    }

    if ((path === "/api/farm/properties" || path === "/api/properties") && method === "POST") {
      const payload = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>;
      const profile = (payload.profile && typeof payload.profile === "object" ? payload.profile : {}) as Record<string, unknown>;
      const propertyId = `prop-${properties.length + 1}`;
      const created = {
        propertyId,
        id: propertyId,
        ownerEmail: email,
        farmName: payload.farmName ?? payload.name ?? "Online Farm",
        landSize: payload.landSize ?? 2,
        landUnit: payload.landUnit ?? "HECTARES",
        cropId: payload.cropId ?? "wheat",
        latitude: profile.lat ?? payload.lat ?? 30.9,
        longitude: profile.lon ?? payload.lon ?? 75.85,
        fieldId: `CROP-FIELD-${properties.length + 1}`,
        deviceId: `SENSOR-FARM01-00${properties.length + 1}`,
        ...payload,
        createdAt: new Date().toISOString(),
      };
      properties.push(created);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    if (
      (path.startsWith("/api/farm/properties/") && path.endsWith("/climate")) ||
      path === "/api/climate/history"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          provider: "Open-Meteo",
          startDate: "2016-01-01",
          endDate: "2026-01-01",
          fallback: false,
          dataAvailable: true,
          dailyObservations: 3650,
          statistics: {
            temperatureC: { count: 3650, mean: 24.4, median: 24.1, standardDeviation: 5.1, p05: 13.8, p25: 19.6, p75: 29.2, p95: 35.8 },
            rainfallMm: { count: 3650, mean: 2.3, median: 0, standardDeviation: 6.2, p05: 0, p25: 0, p75: 1.8, p95: 13.4 },
            temperatureTrendCPerDecade: 0.24,
            rainfallTrendMmPerDecade: -8.5,
            growingDegreeDays: 4210,
            referenceEvapotranspirationMm: 1380,
            waterBalanceMm: -540,
            droughtRiskPercent: 18,
            heatStressRiskPercent: 22,
            extremeEventProbabilityPercent: 14,
          },
          annualSeries: [
            { year: 2024, meanTemperatureC: 24.6, rainfallTotalMm: 810, referenceEt0Mm: 1390, waterBalanceMm: -580, growingDegreeDays: 4240 },
            { year: 2025, meanTemperatureC: 24.9, rainfallTotalMm: 845, referenceEt0Mm: 1410, waterBalanceMm: -565, growingDegreeDays: 4290 },
          ],
        }),
      });
      return;
    }

    if (
      (path.startsWith("/api/farm/properties/") && path.endsWith("/recommendations")) ||
      path === "/api/recommendations/score"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          intent: "RECOMMEND_BEST",
          provider: "Open-Meteo",
          fallback: false,
          dataAvailable: true,
          weights: { temperature: 0.3, water: 0.25, soil: 0.15, season: 0.15, trendRisk: 0.15 },
          recommendations: [
            {
              cropId: "wheat",
              crop: "Wheat",
              score: 88.4,
              temperatureFit: 92,
              waterFit: 86,
              soilMatch: 90,
              seasonFit: 88,
              climateTrendFit: 82,
              expectedWaterNeedMm: 450,
              sowingWindow: "Nov – Dec",
              harvestWindow: "Mar – Apr",
              riskLevel: "LOW",
              explanation: "Well matched to local loam soil and cool Rabi temperatures.",
            },
          ],
          adaptations: ["Maintain supplemental drip irrigation during dry mid-season spells."],
        }),
      });
      return;
    }

    if (path.startsWith("/api/farm/properties/") || path.startsWith("/api/properties/")) {
      const targetId = decodeURIComponent(path.split("/").pop() ?? "");
      if (method === "PUT") {
        const payload = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>;
        const idx = properties.findIndex((p) => p.propertyId === targetId || p.id === targetId);
        const updated = {
          ...(idx >= 0 ? properties[idx] : {}),
          propertyId: targetId,
          id: targetId,
          ...payload,
        };
        if (idx >= 0) properties[idx] = updated;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(updated),
        });
        return;
      }
      if (method === "DELETE") {
        const idx = properties.findIndex((p) => p.propertyId === targetId || p.id === targetId);
        if (idx >= 0) properties.splice(idx, 1);
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      const found = properties.find((p) => p.propertyId === targetId || p.id === targetId) ??
        properties[0] ?? { propertyId: farmId, id: farmId, farmName: "Online Farm" };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(found),
      });
      return;
    }

    if (path === "/api/sensors/summary") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          total: sensors.length,
          online: sensors.length,
          offline: 0,
          lowBattery: 0,
        }),
      });
      return;
    }

    if (path === "/api/sensors/register" && method === "POST") {
      const payload = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>;
      const created = {
        deviceId: payload.deviceId ?? `sensor-${sensors.length + 1}`,
        farmId,
        sensorType: payload.sensorType ?? "SOIL_MOISTURE",
        fieldId: payload.fieldId ?? "zone-a",
        status: "ONLINE",
        health: "HEALTHY",
        batteryPercent: 98,
        lastReadingAt: new Date().toISOString(),
      };
      sensors.push(created);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    if (path.startsWith("/api/sensors")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ content: sensors, totalElements: sensors.length }),
      });
      return;
    }

    if (path === "/api/crops/summary") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalFields: properties.length, optimalFields: properties.length, optimalPercent: 100 }),
      });
      return;
    }

    if (path === "/api/crops/alerts") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    if (path === "/api/crops/analyze" && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ analyzed: properties.length || 1, results: [] }),
      });
      return;
    }

    if (path.startsWith("/api/crops")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    if (path === "/api/telemetry/stats") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ readingsLastMinute: 4, readingsLastHour: 120, totalReadings: 2400 }),
      });
      return;
    }

    if (path.startsWith("/api/telemetry/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          soilMoisture: 62,
          soilTemperature: 22.4,
          ph: 6.8,
          batteryPercent: 95,
          timestamp: new Date().toISOString(),
        }),
      });
      return;
    }

    if (path === "/api/valves/summary" && method === "GET") {
      const running = valves.filter((v) => String(v.state).toUpperCase() === "OPEN").length;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalZones: valves.length, running }),
      });
      return;
    }

    if (path === "/api/valves/emergency-stop" && method === "POST") {
      valves.forEach((v) => {
        v.state = "CLOSED";
        v.flowRateLpm = 0;
        v.openUntil = null;
        v.secondsRemaining = null;
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          closed: valves.length,
          reason: url.searchParams.get("reason") ?? "manual emergency stop",
        }),
      });
      return;
    }

    if (path.startsWith("/api/valves") || path.startsWith("/api/irrigation/valves")) {
      const parts = path.split("/").filter(Boolean);
      if (method === "POST" || method === "PUT") {
        const valveId = decodeURIComponent(parts[2] ?? String(valves[0]?.valveId ?? "VALVE-FIELD-01"));
        const action = parts[3] ?? "";
        const target = valves.find((v) => v.valveId === valveId) ?? valves[0];
        if (target) {
          if (action === "close") {
            target.state = "CLOSED";
            target.flowRateLpm = 0;
            target.openUntil = null;
            target.secondsRemaining = null;
          } else {
            target.state = "OPEN";
            target.flowRateLpm = target.ratedFlowLpm ?? 120;
            target.secondsRemaining = Number(url.searchParams.get("durationMinutes") ?? 15) * 60;
          }
          target.lastChangedAt = new Date().toISOString();
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(target ?? { valveId, state: "OPEN" }),
        });
        return;
      }
      if (parts.length >= 3 && parts[1] === "valves") {
        const valveId = decodeURIComponent(parts[2]);
        const target = valves.find((v) => v.valveId === valveId) ?? valves[0];
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(target ?? {}),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(valves),
      });
      return;
    }

    if (path.startsWith("/api/irrigation/schedules")) {
      if (method === "POST") {
        const payload = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>;
        const scheduleId = `SCH-${String(schedules.length + 1).padStart(3, "0")}`;
        const created = {
          scheduleId,
          farmId,
          cropId: payload.cropId ?? "CROP-FIELD-01",
          valveId: payload.valveId ?? "VALVE-FIELD-01",
          zoneName: "North Furrow",
          recurrence: payload.recurrence ?? "DAILY",
          daysOfWeek: payload.daysOfWeek ?? [],
          startTime: payload.startTime ?? "06:00",
          durationMinutes: payload.durationMinutes ?? 15,
          active: payload.active ?? true,
          skipIfMoist: payload.skipIfMoist ?? true,
          lastRunAt: null,
        };
        schedules.push(created);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(created),
        });
        return;
      }
      if (method === "PATCH") {
        const parts = path.split("/").filter(Boolean);
        const scheduleId = decodeURIComponent(parts[3] ?? "");
        const payload = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>;
        const target = schedules.find((s) => s.scheduleId === scheduleId);
        if (target && typeof payload.active === "boolean") target.active = payload.active;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(target ?? { scheduleId, active: Boolean(payload.active) }),
        });
        return;
      }
      if (method === "DELETE") {
        const scheduleId = decodeURIComponent(path.split("/").pop() ?? "");
        const idx = schedules.findIndex((s) => s.scheduleId === scheduleId);
        if (idx >= 0) schedules.splice(idx, 1);
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ status: "deleted", scheduleId }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(schedules),
      });
      return;
    }

    if (path.startsWith("/api/irrigation/events")) {
      if (method === "POST") {
        const payload = (parsedBody && typeof parsedBody === "object" ? parsedBody : {}) as Record<string, unknown>;
        events.push(payload);
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(payload),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(events),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

export interface SeedAuthOptions {
  token?: string;
  email?: string;
  name?: string;
  role?: string;
  farmId?: string;
  expiresAt?: number;
  guardId?: string;
}

export async function seedAuth(page: Page, options: SeedAuthOptions = {}): Promise<void> {
  const guardKey = `__e2e_auth_seeded_${options.guardId ?? "default"}`;
  const user = {
    token: options.token ?? "offline-field-e2e-token",
    email: options.email ?? "farmer@fieldshield.local",
    name: options.name ?? "Ravi Kumar",
    role: options.role ?? "FARMER",
    farmId: options.farmId ?? "farm-ludhiana-1",
    expiresAt: options.expiresAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  await page.addInitScript(
    ({ key, payload }: { key: string; payload: string }) => {
      if (!window.sessionStorage.getItem(key)) {
        window.localStorage.setItem("agritech-auth", payload);
        window.sessionStorage.setItem(key, "1");
      }
    },
    { key: guardKey, payload: JSON.stringify({ state: { user }, version: 0 }) }
  );
}

export async function seedExpiredAuth(page: Page, guardId = "expired"): Promise<void> {
  await seedAuth(page, {
    token: "expired-token-123",
    expiresAt: Date.now() - 60_000,
    guardId,
  });
}

export async function seedCorruptAuth(page: Page, guardId = "corrupt"): Promise<void> {
  const guardKey = `__e2e_auth_corrupt_${guardId}`;
  await page.addInitScript(
    ({ key }: { key: string }) => {
      if (!window.sessionStorage.getItem(key)) {
        window.localStorage.setItem("agritech-auth", "{corrupt-auth-json!!!");
        window.sessionStorage.setItem(key, "1");
      }
    },
    { key: guardKey }
  );
}

export interface FarmPropertySeed {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  areaHa: number;
  waterSource: "borewell" | "canal" | "rain-fed" | "river" | "";
  irrigationType: "drip" | "sprinkler" | "flood" | "rainfed" | "";
  soilType: "clay" | "loam" | "sandy" | "silt" | "black" | "";
  cropIntent: "GROW_NOW" | "PLAN_SEASON" | "RECOMMEND_BEST" | "";
  selectedCropId?: string;
  previousCrops: string[];
  sensorRecs: {
    type: string;
    quantity: number;
    placement: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
  }[];
  createdAt: string;
  updatedAt: string;
  syncedToBackend: boolean;
}

export interface FarmStoreSeedState {
  properties: FarmPropertySeed[];
  activePropertyId: string | null;
  sensorsByFarm: Record<string, Record<string, unknown>[]>;
  valvesByFarm: Record<string, Record<string, unknown>[]>;
  schedulesByFarm: Record<string, Record<string, unknown>[]>;
  eventsByFarm: Record<string, Record<string, unknown>[]>;
  checklistByFarm: Record<string, Record<string, boolean>>;
  waterSavedLitres: number;
  syncOutbox: Record<string, unknown>[];
  preferences: {
    areaUnit: "ha" | "acres";
    theme: "light" | "dark";
    pumpFlowLpm: number;
  };
}

export function makeDefaultFarm(overrides: Partial<FarmPropertySeed> = {}): FarmPropertySeed {
  const now = "2026-11-10T08:00:00.000Z";
  return {
    id: "farm-ludhiana-1",
    name: "Ludhiana Wheat Parcel",
    lat: 30.901,
    lon: 75.857,
    address: "Raikot, Ludhiana, Punjab",
    areaHa: 4.0,
    waterSource: "borewell",
    irrigationType: "drip",
    soilType: "loam",
    cropIntent: "GROW_NOW",
    selectedCropId: "wheat",
    previousCrops: ["Rice"],
    sensorRecs: [
      {
        type: "Soil Moisture",
        quantity: 2,
        placement: "15 cm & 30 cm root zone",
        priority: "HIGH",
        reason: "Continuous volumetric soil moisture monitoring for wheat irrigation scheduling.",
      },
    ],
    createdAt: now,
    updatedAt: now,
    syncedToBackend: false,
    ...overrides,
  };
}

export async function seedFarmStore(
  page: Page,
  partial: Partial<FarmStoreSeedState> = {},
  guardId = "default"
): Promise<void> {
  const defaultFarm = makeDefaultFarm();
  const properties = partial.properties ?? [defaultFarm];
  const activePropertyId =
    partial.activePropertyId !== undefined
      ? partial.activePropertyId
      : (properties[0]?.id ?? null);

  const state: FarmStoreSeedState = {
    properties,
    activePropertyId,
    sensorsByFarm: partial.sensorsByFarm ?? {},
    valvesByFarm: partial.valvesByFarm ?? {},
    schedulesByFarm: partial.schedulesByFarm ?? {},
    eventsByFarm: partial.eventsByFarm ?? {},
    checklistByFarm: partial.checklistByFarm ?? {},
    waterSavedLitres: partial.waterSavedLitres ?? 0,
    syncOutbox: partial.syncOutbox ?? [],
    preferences: partial.preferences ?? {
      areaUnit: "ha",
      theme: "light",
      pumpFlowLpm: 120,
    },
  };

  const guardKey = `__e2e_farms_seeded_${guardId}`;
  await page.addInitScript(
    ({ key, payload }: { key: string; payload: string }) => {
      if (!window.sessionStorage.getItem(key)) {
        window.localStorage.setItem("agritech-farms-v1", payload);
        window.sessionStorage.setItem(key, "1");
      }
    },
    { key: guardKey, payload: JSON.stringify({ state, version: 0 }) }
  );
}

export async function seedCorruptFarmStore(page: Page, guardId = "corrupt-farm"): Promise<void> {
  const guardKey = `__e2e_farms_corrupt_${guardId}`;
  await page.addInitScript(
    ({ key }: { key: string }) => {
      if (!window.sessionStorage.getItem(key)) {
        window.localStorage.setItem("agritech-farms-v1", "{corrupt-farms-json!!!");
        window.sessionStorage.setItem(key, "1");
      }
    },
    { key: guardKey }
  );
}

export interface ErrorCollector {
  consoleErrors: string[];
  pageErrors: string[];
  assertNoErrors: () => void;
}

export function attachErrorListeners(page: Page): ErrorCollector {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const locUrl = msg.location().url ?? "";
      if (
        text.includes("ERR_CONNECTION_REFUSED") &&
        (offlineGatewayPages.has(page) ||
          locUrl === "" ||
          locUrl.startsWith("http://localhost:8080/"))
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  return {
    consoleErrors,
    pageErrors,
    assertNoErrors: () => {
      expect(pageErrors, `Uncaught page errors: ${pageErrors.join(" | ")}`).toEqual([]);
      expect(consoleErrors, `Console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
    },
  };
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
}

export async function openNavIfMobile(page: Page): Promise<void> {
  const menuBtn = page.getByRole("button", { name: /open menu/i });
  if (await menuBtn.isVisible()) {
    await menuBtn.click();
  }
}
