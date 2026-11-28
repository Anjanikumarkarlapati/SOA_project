import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, authApi, cropApi, sensorApi } from "@/lib/api";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("Microservices Contract, Postman Collection & Telemetry Dataset", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("provides a valid Postman v2.1 collection covering JWT roles, Gateway routing, Eureka discovery, and Monitoring -> Sensor -> Irrigation flow", () => {
    const colPath = path.join(REPO_ROOT, "postman/AgriTech_Microservices.postman_collection.json");
    const envPath = path.join(REPO_ROOT, "postman/AgriTech_Local.postman_environment.json");

    expect(fs.existsSync(colPath), "Postman collection must exist").toBe(true);
    expect(fs.existsSync(envPath), "Postman environment must exist").toBe(true);

    const collection = JSON.parse(fs.readFileSync(colPath, "utf-8"));
    const serialized = JSON.stringify(collection);

    expect(collection.info?.schema).toContain("collection/v2.1.0");
    expect(serialized).toContain("admin@agritech.io");
    expect(serialized).toContain("farmer@agritech.io");
    expect(serialized).toContain("/api/auth/login");
    expect(serialized).toContain("/api/sensors");
    expect(serialized).toContain("/api/crops/analyze");
    expect(serialized).toContain("/api/valves");
    expect(serialized).toContain("/eureka/apps");
  });

  it("provides a valid Postman local dataset manifest and CSV with >= 6 regional Indian telemetry rows and no literal secrets", () => {
    const yamlPath = path.join(REPO_ROOT, "postman/datasets/agritech-telemetry.dataset.yaml");
    const csvPath = path.join(REPO_ROOT, "postman/datasets/agritech-telemetry.csv");

    expect(fs.existsSync(yamlPath), "Dataset YAML manifest must exist").toBe(true);
    expect(fs.existsSync(csvPath), "Dataset CSV source must exist").toBe(true);

    const yamlText = fs.readFileSync(yamlPath, "utf-8");
    expect(yamlText).toContain("type: dataset");
    expect(yamlText).toContain("source_type: static");
    expect(yamlText).toContain("agritech_telemetry");
    expect(yamlText).toContain("irrigation_triggers");
    expect(yamlText).not.toMatch(/password\s*:/i);

    const csvLines = fs
      .readFileSync(csvPath, "utf-8")
      .trim()
      .split(/\r?\n/);
    expect(csvLines.length).toBeGreaterThanOrEqual(7); // header + >= 6 data rows
    expect(csvLines[0]).toContain("soil_moisture");
    expect(csvLines[0]).toContain("valve_id");
  });

  it("attaches JWT Bearer tokens for Farmer and Admin roles across Gateway calls and propagates 401/403 ApiError", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "jwt-farmer-token",
            email: "farmer@agritech.io",
            role: "FARMER",
            farmId: "farm-odisha-01",
            expiresIn: 3600,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 4, online: 4, offline: 0, lowBattery: 0 }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Admin scope required" }), { status: 403 })
      );

    const auth = await authApi.login({ email: "farmer@agritech.io", password: "farmer1234" });
    expect(auth.token).toBe("jwt-farmer-token");
    expect(auth.role).toBe("FARMER");

    const sensors = await sensorApi.summary(auth.token);
    expect(sensors.online).toBe(4);
    expect(fetchSpy.mock.calls[1]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer jwt-farmer-token",
    });

    await expect(cropApi.analyze("expired-token")).rejects.toBeInstanceOf(ApiError);
  });

  it("executes Monitoring -> Sensor -> Irrigation inter-service pipeline via runInterServicePipeline and falls back cleanly when Gateway is offline", async () => {
    const { runInterServicePipeline } = await import("@/lib/microservices");

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ analyzed: 3, at: "2026-11-24T07:00:00Z" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 5, online: 5, offline: 0, lowBattery: 0 }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ totalZones: 4, running: 1 }), { status: 200 })
      );

    const liveResult = await runInterServicePipeline("jwt-admin-token");
    expect(liveResult.mode).toBe("LIVE");
    expect(liveResult.steps.map((s) => s.service)).toEqual([
      "crop-service",
      "sensor-service",
      "irrigation-service",
    ]);
    expect(liveResult.steps.every((s) => s.status === "OK")).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Verify order: Monitoring (/api/crops/analyze) -> Sensor (/api/sensors/summary) -> Irrigation (/api/valves/summary)
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/api/crops/analyze");
    expect(String(fetchSpy.mock.calls[1]?.[0])).toContain("/api/sensors/summary");
    expect(String(fetchSpy.mock.calls[2]?.[0])).toContain("/api/valves/summary");

    // Offline / Gateway unreachable fallback
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const offlineResult = await runInterServicePipeline("offline-field-123");
    expect(offlineResult.mode).toBe("OFFLINE_SIMULATED");
    expect(offlineResult.steps).toHaveLength(3);
  });
});
