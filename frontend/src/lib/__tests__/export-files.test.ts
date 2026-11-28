import { describe, expect, it } from "vitest";
import { buildFarmReportPayload, buildFieldDataCsv } from "../export-files";
import type { FarmProperty, FarmSchedule, FarmSensor, FarmValve } from "../property-store";

const sampleFarm: FarmProperty = {
  id: "FARM-1",
  name: "North Block, Plot A",
  areaHa: 4.5,
  lat: 20.4625,
  lon: 85.8829,
  address: "Cuttack, Odisha",
  soilType: "loam",
  waterSource: "borewell",
  irrigationType: "drip",
  cropIntent: "GROW_NOW",
  previousCrops: ["rice"],
  selectedCropId: "wheat",
  sensorRecs: [],
  createdAt: "2026-11-20T08:00:00Z",
  updatedAt: "2026-11-20T08:00:00Z",
  syncedToBackend: true,
};

const sampleSensors: FarmSensor[] = [
  {
    deviceId: "SENS-01",
    farmId: "FARM-1",
    sensorType: "SOIL_MOISTURE",
    fieldId: "FIELD-1",
    status: "ACTIVE",
    health: "ONLINE",
    batteryPercent: 92,
    lastReadingAt: "2026-11-28T13:00:00Z",
  },
];

const sampleSchedules: FarmSchedule[] = [
  {
    scheduleId: "SCH-1",
    farmId: "FARM-1",
    cropId: "wheat",
    valveId: "VALVE-1",
    zoneName: "North Drip Zone",
    recurrence: "DAILY",
    daysOfWeek: ["MON", "WED", "FRI"],
    startTime: "06:00",
    durationMinutes: 25,
    active: true,
    skipIfMoist: true,
    lastRunAt: null,
    status: "ACTIVE",
  },
];

const sampleValves: FarmValve[] = [
  {
    valveId: "VALVE-1",
    farmId: "FARM-1",
    cropId: "wheat",
    zoneName: "North Drip Zone",
    state: "CLOSED",
    flowRateLpm: 0,
    ratedFlowLpm: 45,
    lastChangedAt: "2026-11-28T12:00:00Z",
    openUntil: null,
    secondsRemaining: null,
    runningScheduleId: null,
  },
];

describe("export-files", () => {
  it("builds structured JSON report payload scoped to the active farm", () => {
    const payload = buildFarmReportPayload({
      activeFarm: sampleFarm,
      properties: [sampleFarm],
      sensorsByFarm: { "FARM-1": sampleSensors, "FARM-2": [] },
      schedulesByFarm: { "FARM-1": sampleSchedules },
      valvesByFarm: { "FARM-1": sampleValves },
    });

    expect(payload.activeFarm?.id).toBe("FARM-1");
    expect(payload.farms).toHaveLength(1);
    expect(payload.sensors).toHaveLength(1);
    expect(payload.schedules).toHaveLength(1);
    expect(payload.valves).toHaveLength(1);
  });

  it("formats farms, sensors, valves, and schedules into properly escaped CSV", () => {
    const payload = buildFarmReportPayload({
      activeFarm: sampleFarm,
      properties: [sampleFarm],
      sensorsByFarm: { "FARM-1": sampleSensors },
      schedulesByFarm: { "FARM-1": sampleSchedules },
      valvesByFarm: { "FARM-1": sampleValves },
    });

    const csv = buildFieldDataCsv(payload);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("RecordType,ID,NameOrTarget,StatusOrType,MetricOrDetails,UpdatedAt");
    expect(lines[1]).toContain('"North Block, Plot A"');
    expect(lines[2]).toContain("SENS-01");
    expect(lines[3]).toContain("VALVE-1");
    expect(lines[4]).toContain("SCH-1");
  });
});
