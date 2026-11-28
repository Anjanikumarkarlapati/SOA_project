import type { FarmProperty, FarmSchedule, FarmSensor, FarmValve } from "./property-store";

export interface FarmExportSnapshot {
  exportedAt: string;
  activeFarm: FarmProperty | null;
  farms: FarmProperty[];
  sensors: FarmSensor[];
  schedules: FarmSchedule[];
  valves: FarmValve[];
}

function selectByFarm<T>(byFarm: Record<string, T[]>, activeFarmId?: string): T[] {
  if (activeFarmId) {
    return byFarm[activeFarmId] ?? [];
  }
  return Object.values(byFarm).flat();
}

/** Builds a portable JSON snapshot of the farmer's active farm, sensors, valves, and schedules. */
export function buildFarmReportPayload(input: {
  activeFarm: FarmProperty | null;
  properties: FarmProperty[];
  sensorsByFarm: Record<string, FarmSensor[]>;
  schedulesByFarm: Record<string, FarmSchedule[]>;
  valvesByFarm: Record<string, FarmValve[]>;
}): FarmExportSnapshot {
  const activeId = input.activeFarm?.id;
  return {
    exportedAt: new Date().toISOString(),
    activeFarm: input.activeFarm,
    farms: input.properties,
    sensors: selectByFarm(input.sensorsByFarm, activeId),
    schedules: selectByFarm(input.schedulesByFarm, activeId),
    valves: selectByFarm(input.valvesByFarm, activeId),
  };
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? "");
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Formats farms, sensors, valves, and irrigation schedules into a single portable CSV file. */
export function buildFieldDataCsv(snapshot: FarmExportSnapshot): string {
  const rows: string[] = [
    ["RecordType", "ID", "NameOrTarget", "StatusOrType", "MetricOrDetails", "UpdatedAt"].join(","),
  ];

  for (const farm of snapshot.farms) {
    rows.push(
      [
        "FARM",
        farm.id,
        farm.name,
        `${farm.soilType || "loam"} / ${farm.irrigationType || "drip"}`,
        `${farm.areaHa} ha (${farm.lat.toFixed(4)}, ${farm.lon.toFixed(4)})`,
        farm.createdAt,
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  for (const sensor of snapshot.sensors) {
    rows.push(
      [
        "SENSOR",
        sensor.deviceId,
        `${sensor.sensorType} (${sensor.fieldId})`,
        `${sensor.health} / ${sensor.status}`,
        `battery=${sensor.batteryPercent}%`,
        sensor.lastReadingAt ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  for (const valve of snapshot.valves) {
    rows.push(
      [
        "VALVE",
        valve.valveId,
        `${valve.zoneName} (${valve.cropId})`,
        valve.state,
        `flow=${valve.flowRateLpm}/${valve.ratedFlowLpm} LPM`,
        valve.lastChangedAt ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  for (const sched of snapshot.schedules) {
    rows.push(
      [
        "SCHEDULE",
        sched.scheduleId,
        `${sched.zoneName || sched.cropId} (${sched.valveId})`,
        sched.status,
        `${sched.startTime} · ${sched.durationMinutes}m · ${sched.recurrence}`,
        sched.lastRunAt ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    );
  }

  return rows.join("\n");
}

/** Triggers a browser file download for generated text/JSON/CSV snapshots. */
export function triggerTextDownload(
  filename: string,
  content: string,
  mimeType: string
): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
