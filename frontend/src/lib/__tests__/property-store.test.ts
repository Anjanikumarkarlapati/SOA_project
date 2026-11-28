import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getActiveProperty,
  normalizeIrrigationType,
  normalizeSoilType,
  useFarmStore,
  usePropertyWizard,
} from "@/lib/property-store";
import { useAuthStore } from "@/lib/auth";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("property-store wizard compatibility & normalizers", () => {
  beforeEach(() => {
    usePropertyWizard.getState().reset();
  });

  it("normalizes soilType and irrigationType variants cleanly", () => {
    expect(normalizeSoilType("black cotton")).toBe("black");
    expect(normalizeSoilType("Black-Cotton")).toBe("black");
    expect(normalizeSoilType("LOAM")).toBe("loam");
    expect(normalizeSoilType("unknown")).toBe("");

    expect(normalizeIrrigationType("none")).toBe("rainfed");
    expect(normalizeIrrigationType("Rain-Fed")).toBe("rainfed");
    expect(normalizeIrrigationType("DRIP")).toBe("drip");
    expect(normalizeIrrigationType("other")).toBe("");
  });

  it("normalizes soilType inside usePropertyWizard.setWater without breaking wizard flow", () => {
    usePropertyWizard.getState().setWater({ soilType: "black cotton" as never, irrigationType: "drip" });
    expect(usePropertyWizard.getState().water.soilType).toBe("black");
    expect(usePropertyWizard.getState().water.irrigationType).toBe("drip");
  });
});

describe("useFarmStore persistence, outbox & field operations", () => {
  const originalLocalStorageDesc = Object.getOwnPropertyDescriptor(window, "localStorage");

  beforeEach(() => {
    localStorage.clear();
    useFarmStore.setState({
      properties: [],
      activePropertyId: null,
      sensorsByFarm: {},
      valvesByFarm: {},
      schedulesByFarm: {},
      eventsByFarm: {},
      checklistByFarm: {},
      waterSavedLitres: 0,
      syncOutbox: [],
      preferences: { areaUnit: "ha", theme: "light", pumpFlowLpm: 120 },
      _hasHydrated: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLocalStorageDesc) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDesc);
    }
    vi.resetModules();
  });

  it("persists to agritech-farms-v1 while excluding _hasHydrated and actions", () => {
    const rawBefore = localStorage.getItem("agritech-farms-v1");
    expect(rawBefore === null || typeof rawBefore === "string").toBe(true);

    useFarmStore.getState().setPreferences({ areaUnit: "acres" });
    const raw = localStorage.getItem("agritech-farms-v1");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as {
      state?: Record<string, unknown>;
    };
    expect(parsed.state?._hasHydrated).toBeUndefined();
    expect(parsed.state?.addProperty).toBeUndefined();
    expect((parsed.state?.preferences as { areaUnit: string })?.areaUnit).toBe("acres");
  });

  it("survives corrupt JSON, undefined localStorage, and SecurityError on fresh load", async () => {
    window.localStorage.setItem("agritech-farms-v1", "{corrupt-json");
    vi.resetModules();
    const { useFarmStore: corruptStore } = await import("@/lib/property-store");
    expect(corruptStore.getState()._hasHydrated).toBe(true);
    expect(corruptStore.getState().properties).toEqual([]);

    Object.defineProperty(window, "localStorage", { configurable: true, value: undefined });
    vi.resetModules();
    const { useFarmStore: undefStore } = await import("@/lib/property-store");
    expect(undefStore.getState()._hasHydrated).toBe(true);
    await expect(
      undefStore.getState().addProperty({ name: "NoStorage Farm", lat: 20.2, lon: 85.8 })
    ).resolves.toBeTruthy();

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    vi.resetModules();
    const { useFarmStore: secStore } = await import("@/lib/property-store");
    expect(secStore.getState()._hasHydrated).toBe(true);
  });

  it("addProperty saves offline-first, seeds sensors/valves/schedules, and queues PROPERTY_CREATE on offline or 404", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, 404));

    const offlineFarm = await useFarmStore.getState().addProperty(
      {
        name: "Kaveri Plot",
        lat: 10.78,
        lon: 79.13,
        areaHa: 2,
        waterSource: "canal",
        irrigationType: "none",
        soilType: "black cotton",
        cropIntent: "RECOMMEND_BEST",
      },
      "offline-field-1"
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(offlineFarm.soilType).toBe("black");
    expect(offlineFarm.irrigationType).toBe("rainfed");
    expect(offlineFarm.syncedToBackend).toBe(false);

    const s1 = useFarmStore.getState();
    expect(s1.activePropertyId).toBe(offlineFarm.id);
    expect(s1.sensorsByFarm[offlineFarm.id].length).toBeGreaterThan(0);
    expect(s1.valvesByFarm[offlineFarm.id]).toHaveLength(1);
    expect(s1.schedulesByFarm[offlineFarm.id]).toHaveLength(1);
    expect(s1.syncOutbox.some((item) => item.kind === "PROPERTY_CREATE" && item.farmId === offlineFarm.id)).toBe(true);

    // Online JWT when :8080 returns 404 -> still succeeds locally and queues
    const online404Farm = await useFarmStore.getState().addProperty(
      { name: "Cuttack Farm", lat: 20.46, lon: 85.88, areaHa: 1.5 },
      "jwt-live-token"
    );
    expect(online404Farm.syncedToBackend).toBe(false);
    expect(
      useFarmStore.getState().syncOutbox.some((i) => i.kind === "PROPERTY_CREATE" && i.farmId === online404Farm.id)
    ).toBe(true);

    // Online JWT when :8080 returns 201 -> marks synced and does not queue
    fetchSpy.mockResolvedValueOnce(jsonResponse({ id: "backend-prop-9" }, 201));
    const syncedFarm = await useFarmStore.getState().addProperty(
      { name: "Synced Farm", lat: 30.9, lon: 75.85, areaHa: 3 },
      "jwt-live-token"
    );
    expect(syncedFarm.syncedToBackend).toBe(true);
    expect(
      useFarmStore.getState().syncOutbox.some((i) => i.kind === "PROPERTY_CREATE" && i.farmId === syncedFarm.id)
    ).toBe(false);
  });

  it("supports updateProperty, deleteProperty cleanup, and getActiveProperty fallback", async () => {
    const f1 = await useFarmStore.getState().addProperty({ name: "Farm A", lat: 11, lon: 77 });
    const f2 = await useFarmStore.getState().addProperty({ name: "Farm B", lat: 12, lon: 78 });

    expect(getActiveProperty(useFarmStore.getState())?.id).toBe(f2.id);

    const updated = await useFarmStore
      .getState()
      .updateProperty(f1.id, { soilType: "black cotton", areaHa: 4.5 });
    expect(updated?.soilType).toBe("black");
    expect(updated?.areaHa).toBe(4.5);

    await useFarmStore.getState().deleteProperty(f2.id);
    const state = useFarmStore.getState();
    expect(state.properties.map((p) => p.id)).toEqual([f1.id]);
    expect(state.sensorsByFarm[f2.id]).toBeUndefined();
    expect(state.valvesByFarm[f2.id]).toBeUndefined();
    expect(getActiveProperty(state)?.id).toBe(f1.id);

    await useFarmStore.getState().deleteProperty(f1.id);
    expect(getActiveProperty(useFarmStore.getState())).toBeNull();
  });

  it("seedSampleFarmIfEmpty only seeds when properties are empty and never hijacks user farms", async () => {
    const seeded = await useFarmStore.getState().seedSampleFarmIfEmpty();
    expect(seeded).not.toBeNull();
    expect(useFarmStore.getState().properties).toHaveLength(1);

    const userFarm = await useFarmStore.getState().addProperty({ name: "My Own Farm", lat: 21, lon: 84 });
    const secondSeed = await useFarmStore.getState().seedSampleFarmIfEmpty();
    expect(secondSeed).toBeNull();
    expect(useFarmStore.getState().activePropertyId).toBe(userFarm.id);
  });

  it("manages sensors, valve open/close/toggle/emergencyStop, schedules, rain-hold defer, checklist, and shift dispatch", async () => {
    const farm = await useFarmStore.getState().addProperty({ name: "Ops Farm", lat: 30.9, lon: 75.85 });
    const valve = useFarmStore.getState().valvesByFarm[farm.id][0];
    const schedule = useFarmStore.getState().schedulesByFarm[farm.id][0];

    const sensor = await useFarmStore.getState().addSensor(farm.id, {
      sensorType: "Soil Moisture",
      fieldId: "FIELD-02",
    });
    expect(useFarmStore.getState().sensorsByFarm[farm.id].some((s) => s.deviceId === sensor.deviceId)).toBe(true);
    await useFarmStore.getState().removeSensor(farm.id, sensor.deviceId);
    expect(useFarmStore.getState().sensorsByFarm[farm.id].some((s) => s.deviceId === sensor.deviceId)).toBe(false);

    await useFarmStore
      .getState()
      .openValveWithAudit(farm.id, valve.valveId, 999, "Fertigation cycle", "offline-1");
    let currentValve = useFarmStore.getState().valvesByFarm[farm.id][0];
    expect(currentValve.state).toBe("OPEN");
    expect(currentValve.secondsRemaining).toBe(240 * 60);
    expect(currentValve.lastInterlockOverrideReason).toBe("Fertigation cycle");

    await useFarmStore.getState().toggleValve(farm.id, valve.valveId, { token: "offline-1" });
    currentValve = useFarmStore.getState().valvesByFarm[farm.id][0];
    expect(currentValve.state).toBe("CLOSED");

    await useFarmStore.getState().openValveWithAudit(farm.id, valve.valveId, 15, undefined, "offline-1");
    await useFarmStore.getState().emergencyStopValves(farm.id, "Storm alert", "offline-1");
    expect(useFarmStore.getState().valvesByFarm[farm.id][0].state).toBe("CLOSED");
    expect(
      useFarmStore.getState().eventsByFarm[farm.id].some((e) => e.eventType === "EMERGENCY_STOP")
    ).toBe(true);

    const newSch = await useFarmStore.getState().createSchedule(farm.id, {
      cropId: "wheat",
      valveId: valve.valveId,
      startTime: "18:00",
      durationMinutes: 20,
    });
    expect(useFarmStore.getState().schedulesByFarm[farm.id]).toHaveLength(2);
    await useFarmStore.getState().toggleSchedule(farm.id, newSch.scheduleId);
    expect(
      useFarmStore.getState().schedulesByFarm[farm.id].find((s) => s.scheduleId === newSch.scheduleId)?.active
    ).toBe(false);
    await useFarmStore.getState().deleteSchedule(farm.id, newSch.scheduleId);
    expect(useFarmStore.getState().schedulesByFarm[farm.id]).toHaveLength(1);

    useFarmStore.getState().deferScheduleRainHold(farm.id, schedule.scheduleId, 12500);
    const deferred = useFarmStore.getState().schedulesByFarm[farm.id][0];
    expect(deferred.status).toBe("DEFERRED_RAIN_HOLD");
    expect(deferred.active).toBe(false);
    expect(useFarmStore.getState().waterSavedLitres).toBe(12500);

    useFarmStore.getState().toggleChecklistTask(farm.id, "task-1");
    expect(useFarmStore.getState().checklistByFarm[farm.id]["task-1"]).toBe(true);
    useFarmStore.getState().toggleChecklistTask(farm.id, "task-1");
    expect(useFarmStore.getState().checklistByFarm[farm.id]["task-1"]).toBe(false);

    useFarmStore.getState().logShiftDispatch(farm.id, "Morning brief sent");
    expect(
      useFarmStore.getState().eventsByFarm[farm.id].some((e) => e.eventType === "SHIFT_DISPATCH")
    ).toBe(true);
  });

  it("flushOutbox skips offline tokens, replays online items using exact valveApi signatures, and retains failed items", async () => {
    const farm = await useFarmStore.getState().addProperty({ name: "Outbox Farm", lat: 30.9, lon: 75.85 });
    const valve = useFarmStore.getState().valvesByFarm[farm.id][0];
    await useFarmStore.getState().openValveWithAudit(farm.id, valve.valveId, 30, undefined, "offline-1");
    await useFarmStore.getState().emergencyStopValves(farm.id, "Power cut", "offline-1");

    const skipped = await useFarmStore.getState().flushOutbox("offline-1");
    expect(skipped.skipped).toBe(true);
    expect(skipped.flushed).toBe(0);

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      // 1st item: PROPERTY_CREATE -> 404 (retains failed item)
      .mockResolvedValueOnce(jsonResponse({ message: "Not Found" }, 404))
      // 2nd item: VALVE_OPEN -> 200
      .mockResolvedValueOnce(jsonResponse({ ...valve, state: "OPEN" }))
      // 3rd item: VALVE_EMERGENCY_STOP -> 200
      .mockResolvedValueOnce(jsonResponse({ closed: 1, reason: "Power cut" }));

    const result = await useFarmStore.getState().flushOutbox("jwt-live");
    expect(result.skipped).toBe(false);
    expect(result.flushed).toBe(2);
    expect(result.remaining).toBe(1);
    expect(useFarmStore.getState().syncOutbox[0].attempts).toBe(1);

    // Verify exact valveApi URL parameter placement (not token in query string!)
    expect(fetchSpy.mock.calls[1][0]).toContain(`/api/valves/${valve.valveId}/open?durationMinutes=30`);
    expect(fetchSpy.mock.calls[2][0]).toContain("/api/valves/emergency-stop?reason=Power%20cut");
  });

  it("clears properties and syncOutbox when the authenticated user changes or logs out", async () => {
    useAuthStore.setState({
      user: {
        token: "jwt-farmer",
        email: "farmer@agritech.io",
        role: "FARMER",
        farmId: "FARM-A",
        expiresAt: Date.now() + 60_000,
      },
      _hasHydrated: true,
    });

    const farm = await useFarmStore.getState().addProperty({ name: "Farmer A Plot", lat: 30.9, lon: 75.85 });
    expect(useFarmStore.getState().properties).toHaveLength(1);
    expect(useFarmStore.getState().syncOutbox).toHaveLength(1);

    useAuthStore.getState().setUser({
      token: "jwt-admin",
      email: "admin@agritech.io",
      role: "ADMIN",
      farmId: "FARM-001",
      expiresAt: Date.now() + 60_000,
    });
    expect(useFarmStore.getState().properties).toHaveLength(0);
    expect(useFarmStore.getState().syncOutbox).toHaveLength(0);

    await useFarmStore.getState().addProperty({ name: "Admin Plot", lat: 16.3, lon: 80.4 });
    expect(useFarmStore.getState().properties).toHaveLength(1);
    expect(farm.id).not.toBe(useFarmStore.getState().properties[0].id);

    useAuthStore.getState().clearUser();
    expect(useFarmStore.getState().properties).toHaveLength(0);
    expect(useFarmStore.getState().syncOutbox).toHaveLength(0);
  });
});
