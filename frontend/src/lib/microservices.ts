import { cropApi, isBackendUnreachableError, sensorApi, valveApi } from "@/lib/api";
import { isOfflineToken } from "@/lib/auth";

export type PipelineServiceName =
  | "crop-service"
  | "sensor-service"
  | "irrigation-service";

export interface PipelineStepResult {
  stage: "Monitoring" | "Sensor" | "Irrigation";
  service: PipelineServiceName;
  endpoint: string;
  status: "OK" | "SIMULATED" | "ERROR";
  latencyMs: number;
  summary: string;
}

export interface PipelineRunResult {
  mode: "LIVE" | "OFFLINE_SIMULATED";
  gatewayUrl: string;
  eurekaDiscovery: "REGISTERED" | "LOCAL_FALLBACK";
  executedAt: string;
  steps: PipelineStepResult[];
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function buildSimulatedResult(executedAt: string): PipelineRunResult {
  return {
    mode: "OFFLINE_SIMULATED",
    gatewayUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080",
    eurekaDiscovery: "LOCAL_FALLBACK",
    executedAt,
    steps: [
      {
        stage: "Monitoring",
        service: "crop-service",
        endpoint: "POST /api/crops/analyze",
        status: "SIMULATED",
        latencyMs: 12,
        summary: "Evaluated Kharif/Rabi moisture thresholds from FieldShield ledger",
      },
      {
        stage: "Sensor",
        service: "sensor-service",
        endpoint: "GET /api/sensors/summary",
        status: "SIMULATED",
        latencyMs: 8,
        summary: "Aggregated regional root-zone probe telemetry across 15/30/60 cm horizons",
      },
      {
        stage: "Irrigation",
        service: "irrigation-service",
        endpoint: "GET /api/valves/summary",
        status: "SIMULATED",
        latencyMs: 9,
        summary: "Evaluated automated drip valve schedules for low-moisture parcels",
      },
    ],
  };
}

/**
 * Executes the Monitoring -> Sensor -> Irrigation inter-service pipeline through
 * the API Gateway (:8080) with Eureka load balancing, falling back cleanly when
 * running in offline FieldShield mode or when the gateway is unreachable.
 */
export async function runInterServicePipeline(token: string): Promise<PipelineRunResult> {
  const executedAt = new Date().toISOString();
  const gatewayUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

  if (!token || isOfflineToken(token)) {
    return buildSimulatedResult(executedAt);
  }

  try {
    const t0 = nowMs();
    const cropAnalysis = await cropApi.analyze(token);
    const analyzedCount = Array.isArray(cropAnalysis.results)
      ? cropAnalysis.results.length
      : cropAnalysis.analyzed ?? 1;
    const t1 = nowMs();

    const sensorSummary = await sensorApi.summary(token);
    const t2 = nowMs();

    const valveSummary = await valveApi.summary(token);
    const t3 = nowMs();

    return {
      mode: "LIVE",
      gatewayUrl,
      eurekaDiscovery: "REGISTERED",
      executedAt,
      steps: [
        {
          stage: "Monitoring",
          service: "crop-service",
          endpoint: "POST /api/crops/analyze",
          status: "OK",
          latencyMs: Math.max(1, Math.round(t1 - t0)),
          summary: `Analyzed ${analyzedCount} crop parcel(s) via Eureka-routed crop-service`,
        },
        {
          stage: "Sensor",
          service: "sensor-service",
          endpoint: "GET /api/sensors/summary",
          status: "OK",
          latencyMs: Math.max(1, Math.round(t2 - t1)),
          summary: `${sensorSummary.online}/${sensorSummary.total} sensors online (${sensorSummary.lowBattery} low battery)`,
        },
        {
          stage: "Irrigation",
          service: "irrigation-service",
          endpoint: "GET /api/valves/summary",
          status: "OK",
          latencyMs: Math.max(1, Math.round(t3 - t2)),
          summary: `${valveSummary.running}/${valveSummary.totalZones} valve zones actively irrigating`,
        },
      ],
    };
  } catch (err) {
    if (isBackendUnreachableError(err)) {
      return buildSimulatedResult(executedAt);
    }
    throw err;
  }
}
