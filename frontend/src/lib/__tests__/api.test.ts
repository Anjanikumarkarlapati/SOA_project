import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  authApi,
  climateApi,
  cropApi,
  farmApi,
  fromBackendProperty,
  irrigationApi,
  isBackendUnreachableError,
  isPropertyEndpointUnavailableError,
  propertyApi,
  recommendationApi,
  sensorApi,
  telemetryApi,
  toBackendCropId,
  toBackendCropIntent,
  toSetupRequest,
  valveApi,
} from "@/lib/api";
import { escapeHtml } from "@/components/FarmMap";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api.ts :8080 contracts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sensorApi sends list query, register payload with lat/lon, update, and delete", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          content: [
            {
              deviceId: "SENSOR-01",
              farmId: "FARM-1",
              sensorType: "soil-moisture",
              fieldId: "FIELD-01",
              status: "ACTIVE",
              health: "ONLINE",
              batteryPercent: 88,
              lastReadingAt: "2026-11-23T10:00:00Z",
              registered: "2026-11-20T08:00:00Z",
              location: { latitude: 30.9, longitude: 75.85 },
            },
          ],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 20,
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            deviceId: "SENSOR-02",
            farmId: "FARM-1",
            sensorType: "soil-temperature",
            fieldId: "FIELD-01",
            status: "ACTIVE",
            health: "ONLINE",
            batteryPercent: 100,
            lastReadingAt: "",
            location: { latitude: 30.91, longitude: 75.86 },
          },
          201
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          deviceId: "SENSOR-02",
          farmId: "FARM-1",
          sensorType: "soil-temperature",
          fieldId: "FIELD-02",
          status: "ACTIVE",
          health: "LOW_BATTERY",
          batteryPercent: 15,
          lastReadingAt: "2026-11-23T11:00:00Z",
        })
      )
      .mockResolvedValueOnce(jsonResponse({ deviceId: "SENSOR-02", status: "deregistered" }));

    const list = await sensorApi.list("jwt-1", "health=OFFLINE");
    expect(list.content[0].health).toBe("ONLINE");
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/sensors?health=OFFLINE");
    expect((fetchSpy.mock.calls[0][1]?.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer jwt-1"
    );

    const created = await sensorApi.register(
      {
        deviceId: "SENSOR-02",
        farmId: "FARM-1",
        sensorType: "soil-temperature",
        fieldId: "FIELD-01",
        latitude: 30.91,
        longitude: 75.86,
      },
      "jwt-1"
    );
    expect(created.deviceId).toBe("SENSOR-02");
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/sensors/register");
    expect(fetchSpy.mock.calls[1][1]?.method).toBe("POST");
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toMatchObject({
      deviceId: "SENSOR-02",
      latitude: 30.91,
      longitude: 75.86,
    });

    await sensorApi.update("SENSOR-02", { fieldId: "FIELD-02", status: "ACTIVE" }, "jwt-1");
    expect(fetchSpy.mock.calls[2][0]).toContain("/api/sensors/SENSOR-02");
    expect(fetchSpy.mock.calls[2][1]?.method).toBe("PUT");

    await sensorApi.remove("SENSOR-02", "jwt-1");
    expect(fetchSpy.mock.calls[3][0]).toContain("/api/sensors/SENSOR-02");
    expect(fetchSpy.mock.calls[3][1]?.method).toBe("DELETE");
  });

  it("irrigationApi supports schedules, getSchedule, events, create, update, toggle, and delete", async () => {
    const sampleSchedule = {
      scheduleId: "SCH-1",
      farmId: "FARM-1",
      cropId: "wheat",
      valveId: "VALVE-1",
      zoneName: "Main Zone",
      recurrence: "DAILY",
      daysOfWeek: [],
      startTime: "06:00",
      durationMinutes: 25,
      active: true,
      skipIfMoist: true,
      lastRunAt: null,
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([sampleSchedule]))
      .mockResolvedValueOnce(jsonResponse(sampleSchedule))
      .mockResolvedValueOnce(
        jsonResponse([
          {
            id: "irrigation-1",
            severity: "INFO",
            source: "VALVE-1",
            cropId: "wheat",
            message: "Opened valve",
            timestamp: "2026-11-23T06:00:00Z",
          },
        ])
      )
      .mockResolvedValueOnce(jsonResponse(sampleSchedule, 201))
      .mockResolvedValueOnce(jsonResponse({ ...sampleSchedule, durationMinutes: 30 }))
      .mockResolvedValueOnce(jsonResponse({ ...sampleSchedule, active: false }))
      .mockResolvedValueOnce(jsonResponse({ status: "deleted", scheduleId: "SCH-1" }));

    const schedules = await irrigationApi.schedules("jwt-1");
    expect(schedules).toHaveLength(1);
    expect(schedules[0].scheduleId).toBe("SCH-1");

    const single = await irrigationApi.getSchedule("SCH-1", "jwt-1");
    expect(single.valveId).toBe("VALVE-1");
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/irrigation/schedules/SCH-1");

    const events = await irrigationApi.events("jwt-1");
    expect(events[0].id).toBe("irrigation-1");

    await irrigationApi.createSchedule(
      {
        cropId: "wheat",
        valveId: "VALVE-1",
        recurrence: "DAILY",
        startTime: "06:00",
        durationMinutes: 25,
      },
      "jwt-1"
    );
    expect(fetchSpy.mock.calls[3][1]?.method).toBe("POST");

    await irrigationApi.updateSchedule("SCH-1", { durationMinutes: 30 }, "jwt-1");
    expect(fetchSpy.mock.calls[4][1]?.method).toBe("PUT");

    const toggled = await irrigationApi.toggleSchedule("SCH-1", false, "jwt-1");
    expect(toggled.active).toBe(false);
    expect(fetchSpy.mock.calls[5][0]).toContain("/api/irrigation/schedules/SCH-1/active");
    expect(fetchSpy.mock.calls[5][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchSpy.mock.calls[5][1]?.body))).toEqual({ active: false });

    const deleted = await irrigationApi.deleteSchedule("SCH-1", "jwt-1");
    expect(deleted.status).toBe("deleted");
    expect(fetchSpy.mock.calls[6][1]?.method).toBe("DELETE");
  });

  it("valveApi supports list, status, summary, open (with default duration & 409 surface), close, and emergencyStop", async () => {
    const sampleValve = {
      valveId: "VALVE-1",
      farmId: "FARM-1",
      cropId: "wheat",
      zoneName: "Main Zone",
      state: "OPEN",
      flowRateLpm: 120,
      ratedFlowLpm: 120,
      lastChangedAt: "2026-11-23T10:00:00Z",
      openUntil: "2026-11-23T10:20:00Z",
      secondsRemaining: 1200,
      runningScheduleId: null,
    };

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse([sampleValve]))
      .mockResolvedValueOnce(jsonResponse(sampleValve))
      .mockResolvedValueOnce(jsonResponse({ totalZones: 1, running: 1 }))
      .mockResolvedValueOnce(jsonResponse(sampleValve))
      .mockResolvedValueOnce(jsonResponse(sampleValve))
      .mockResolvedValueOnce(jsonResponse({ message: "irrigation_blocked: soil saturated" }, 409))
      .mockResolvedValueOnce(jsonResponse({ ...sampleValve, state: "CLOSED", flowRateLpm: 0 }))
      .mockResolvedValueOnce(jsonResponse({ closed: 1, reason: "heavy rain" }));

    const list = await valveApi.list("jwt-1");
    expect(list[0].valveId).toBe("VALVE-1");

    await valveApi.status("VALVE-1", "jwt-1");
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/valves/VALVE-1/status");

    const summary = await valveApi.summary("jwt-1");
    expect(summary).toEqual({ totalZones: 1, running: 1 });

    await valveApi.open("VALVE-1", "jwt-1");
    expect(fetchSpy.mock.calls[3][0]).toContain("/api/valves/VALVE-1/open?durationMinutes=15");
    expect(fetchSpy.mock.calls[3][1]?.method).toBe("POST");

    await valveApi.open("VALVE-1", "jwt-1", 20);
    expect(fetchSpy.mock.calls[4][0]).toContain("/api/valves/VALVE-1/open?durationMinutes=20");

    await expect(valveApi.open("VALVE-1", "jwt-1", 10)).rejects.toMatchObject({
      status: 409,
      message: "irrigation_blocked: soil saturated",
    });

    const closed = await valveApi.close("VALVE-1", "jwt-1");
    expect(closed.state).toBe("CLOSED");
    expect(fetchSpy.mock.calls[6][0]).toContain("/api/valves/VALVE-1/close");

    const stop = await valveApi.emergencyStop("jwt-1", "heavy rain");
    expect(stop.closed).toBe(1);
    expect(fetchSpy.mock.calls[7][0]).toContain("/api/valves/emergency-stop?reason=heavy%20rain");
    expect(fetchSpy.mock.calls[7][1]?.method).toBe("POST");
  });

  it("handles 204 No Content cleanly and classifies unreachable vs 404 property endpoints", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await irrigationApi.deleteSchedule("SCH-204", "jwt-1");
    expect(result).toBeUndefined();

    const err404 = new ApiError(404, "Not Found");
    const err401 = new ApiError(401, "Unauthorized");
    const err503 = new ApiError(503, "Service Unavailable");
    const netErr = new TypeError("Failed to fetch");
    const abortErr = new DOMException("Aborted", "AbortError");

    expect(isBackendUnreachableError(netErr)).toBe(true);
    expect(isBackendUnreachableError(abortErr)).toBe(true);
    expect(isBackendUnreachableError(err503)).toBe(true);
    expect(isBackendUnreachableError(err404)).toBe(false);
    expect(isBackendUnreachableError(err401)).toBe(false);

    expect(isPropertyEndpointUnavailableError(err404)).toBe(true);
    expect(isPropertyEndpointUnavailableError(netErr)).toBe(true);
    expect(isPropertyEndpointUnavailableError(err503)).toBe(true);
    expect(isPropertyEndpointUnavailableError(err401)).toBe(false);
  });

  it("encodes path parameters against path traversal and escapes HTML in Leaflet popup helper", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ cropId: "c1" }))
      .mockResolvedValueOnce(jsonResponse({ soilMoisture: 50 }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: "p1" }))
      .mockResolvedValueOnce(jsonResponse({ id: "p1" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await cropApi.get("../valves/open", "jwt-1");
    expect(fetchSpy.mock.calls[0][0]).toContain("/api/crops/..%2Fvalves%2Fopen");

    await telemetryApi.latest("../admin", "jwt-1");
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/telemetry/..%2Fadmin/latest");

    await telemetryApi.history("DEV/1", "24h&admin=1", "jwt-1");
    expect(fetchSpy.mock.calls[2][0]).toContain("/api/telemetry/DEV%2F1?range=24h%26admin%3D1");

    await propertyApi.get("../secret", "jwt-1");
    expect(fetchSpy.mock.calls[3][0]).toContain("/api/farm/properties/..%2Fsecret");

    await propertyApi.update("../secret", { name: "Safe" }, "jwt-1");
    expect(fetchSpy.mock.calls[4][0]).toContain("/api/farm/properties/..%2Fsecret");

    await propertyApi.remove("../secret", "jwt-1");
    expect(fetchSpy.mock.calls[5][0]).toContain("/api/farm/properties/..%2Fsecret");

    const xssPayload = `<img src=x onerror="alert('xss')"> & 'quote'`;
    expect(escapeHtml(xssPayload)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt; &amp; &#39;quote&#39;"
    );
  });

  it("maps Auth register/logout, Farm SetupRequest, Climate, and Recommendation :8080 contracts", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          token: "jwt-reg",
          refreshToken: "ref-reg",
          email: "new@agritech.io",
          role: "FARMER",
          farmId: "FARM-NEW",
          displayName: "Asha Devi",
          expiresIn: 900,
        })
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse({
          provider: "Open-Meteo",
          startDate: "2016-01-01",
          endDate: "2026-01-01",
          fallback: false,
          dataAvailable: true,
          dailyObservations: 3650,
          statistics: {
            temperatureC: { count: 3650, mean: 24.5, median: 24.1, standardDeviation: 5.2, p05: 14, p25: 20, p75: 29, p95: 36 },
            rainfallMm: { count: 3650, mean: 2.1, median: 0, standardDeviation: 6.4, p05: 0, p25: 0, p75: 1.5, p95: 12 },
            temperatureTrendCPerDecade: 0.25,
            rainfallTrendMmPerDecade: -10,
            growingDegreeDays: 4200,
            referenceEvapotranspirationMm: 1400,
            waterBalanceMm: -350,
            droughtRiskPercent: 22,
            heatStressRiskPercent: 18,
            extremeEventProbabilityPercent: 12,
          },
          annualSeries: [],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          weights: { temperature: 0.3, water: 0.25, soil: 0.15, season: 0.15, trendRisk: 0.15 },
          recommendations: [],
          adaptations: [],
        })
      )
      .mockResolvedValueOnce(jsonResponse({ dataAvailable: true, annualSeries: [] }))
      .mockResolvedValueOnce(jsonResponse({ recommendations: [], adaptations: [] }));

    await authApi.register({
      email: "new@agritech.io",
      password: "secret",
      role: "FARMER",
      name: "Asha Devi",
    });
    const regBody = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(regBody.displayName).toBe("Asha Devi");
    expect(regBody.name).toBeUndefined();

    await authApi.logout("jwt-reg", "ref-reg");
    expect(fetchSpy.mock.calls[1][0]).toContain("/api/auth/logout");
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
      refreshToken: "ref-reg",
    });

    expect(toBackendCropIntent("PLAN_SEASON")).toBe("PLAN_DATES");
    expect(toBackendCropId("chickpea")).toBe("chana");

    const setup = toSetupRequest({
      name: "Kaveri Plot",
      areaHa: 4.5,
      selectedCropId: "chickpea",
      cropIntent: "PLAN_SEASON",
      plannedSeason: "Rabi",
      plannedDateStart: "2026-11-01",
      plannedDateEnd: "2027-03-15",
      sensors: ["soil-moisture", "humidity", "npk"],
      lat: 12.52,
      lon: 76.89,
    });
    expect(setup).toMatchObject({
      farmName: "Kaveri Plot",
      landSize: 4.5,
      landUnit: "HECTARES",
      cropId: "chana",
      sensors: ["humidity", "npk"],
      profile: {
        cropIntent: "PLAN_DATES",
        intendedSeason: "Rabi",
        intentStartDate: "2026-11-01",
        intentEndDate: "2027-03-15",
      },
    });

    const mapped = fromBackendProperty({
      propertyId: "PROP-001",
      ownerEmail: "farmer@agritech.io",
      farmName: "North Orchard",
      landHectares: 6.2,
      latitude: 30.9,
      longitude: 75.85,
      cropId: "wheat",
      fieldId: "CROP-FIELD-01",
      deviceId: "SENSOR-FARM01-001",
      water: { waterSource: "canal", irrigationType: "drip", availability: "year-round" },
      cropIntent: { intent: "PLAN_DATES", season: "Rabi" },
    });
    expect(mapped).toMatchObject({
      id: "PROP-001",
      name: "North Orchard",
      areaHa: 6.2,
      selectedCropId: "wheat",
      fieldId: "CROP-FIELD-01",
      deviceId: "SENSOR-FARM01-001",
      cropIntent: "PLAN_SEASON",
      plannedSeason: "Rabi",
    });

    const hist = await climateApi.history(30.9, 75.85, "2016-01-01", "2026-01-01", "jwt-reg");
    expect(fetchSpy.mock.calls[2][0]).toContain("/api/climate/history?lat=30.9&lon=75.85");

    await recommendationApi.score(
      { climate: hist.statistics, soilType: "loam", intent: "RECOMMEND_BEST", limit: 5 },
      "jwt-reg"
    );
    expect(fetchSpy.mock.calls[3][0]).toContain("/api/recommendations/score");

    await farmApi.propertyClimate("PROP-001", "jwt-reg");
    expect(fetchSpy.mock.calls[4][0]).toContain("/api/farm/properties/PROP-001/climate");

    await farmApi.propertyRecommendations("PROP-001", "jwt-reg");
    expect(fetchSpy.mock.calls[5][0]).toContain("/api/farm/properties/PROP-001/recommendations");
  });

  it("blocks synthetic offline tokens inside request() before fetch is called", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(cropApi.list("offline-field-123")).rejects.toMatchObject({
      status: 401,
      message: "Offline session cannot call live API",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
