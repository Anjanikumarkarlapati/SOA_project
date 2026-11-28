// lib/property-store.ts — wizard state + persistent offline-first farm ledger
"use client";
import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import {
  irrigationApi,
  isBackendUnreachableError,
  isPropertyEndpointUnavailableError,
  propertyApi,
  sensorApi,
  valveApi,
  type CreateIrrigationSchedulePayload,
  type IrrigationEvent,
  type IrrigationSchedule,
  type Property,
  type Sensor,
  type ValveStatus,
} from "@/lib/api";
import { isOfflineToken, useAuthStore } from "@/lib/auth";
import {
  DEFAULT_FARM_LOCATION,
  inferLocationFromAddress,
  type FarmLocationProfile,
} from "@/lib/indian-locations";
import { getDefaultMediaStore } from "@/lib/media-queue";

export interface PropertyLocation {
  lat: number;
  lon: number;
  address: string;
  country: string;
  region: string;
  boundary?: GeoJSON.Polygon | null;
  areaHa?: number;
}

export type SoilType = "clay" | "loam" | "sandy" | "silt" | "black" | "";
export type IrrigationSystemType = "drip" | "sprinkler" | "flood" | "rainfed" | "";

export interface WaterDetails {
  waterSource: "borewell" | "canal" | "rain-fed" | "river" | "";
  availabilityMonths: number[];   // 1-12
  irrigationType: "drip" | "sprinkler" | "flood" | "none" | "";
  soilType: SoilType;
}

export function normalizeSoilType(input?: string | null): SoilType {
  if (!input) return "";
  const cleaned = input.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (cleaned === "black" || cleaned === "black cotton" || cleaned === "black soil") {
    return "black";
  }
  if (cleaned === "clay" || cleaned === "loam" || cleaned === "sandy" || cleaned === "silt") {
    return cleaned;
  }
  return "";
}

export function normalizeIrrigationType(input?: string | null): IrrigationSystemType {
  if (!input) return "";
  const cleaned = input.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (cleaned === "none" || cleaned === "rainfed" || cleaned === "rain fed") {
    return "rainfed";
  }
  if (cleaned === "drip" || cleaned === "sprinkler" || cleaned === "flood") {
    return cleaned;
  }
  return "";
}

export type CropIntent =
  | "GROW_NOW"
  | "PLAN_SEASON"
  | "RECOMMEND_BEST";

export interface CropIntentDetails {
  intent: CropIntent | "";
  previousCrops: string[];
  plannedSeason?: string;
  plannedDateStart?: string;
  plannedDateEnd?: string;
}

export interface SensorRecommendation {
  type: string;
  quantity: number;
  placement: string;
  priority: "essential" | "recommended" | "optional";
  reason: string;
}

export interface PropertyDraft {
  // Step 1 – Location
  name: string;
  location: PropertyLocation | null;

  // Step 2 – Water & land
  water: WaterDetails;

  // Step 3 – Crop intent
  cropIntent: CropIntentDetails;

  // Step 4 – Sensor recommendations (computed)
  sensorRecs: SensorRecommendation[];
}

interface WizardStore extends PropertyDraft {
  step: 1 | 2 | 3 | 4 | 5;
  setStep: (s: 1 | 2 | 3 | 4 | 5) => void;

  setName: (n: string) => void;
  setLocation: (l: PropertyLocation) => void;
  setWater: (w: Partial<WaterDetails>) => void;
  setCropIntent: (c: Partial<CropIntentDetails>) => void;
  setSensorRecs: (r: SensorRecommendation[]) => void;
  reset: () => void;
}

const EMPTY: PropertyDraft = {
  name: "",
  location: null,
  water: { waterSource: "", availabilityMonths: [], irrigationType: "", soilType: "" },
  cropIntent: { intent: "", previousCrops: [] },
  sensorRecs: [],
};

export const usePropertyWizard = create<WizardStore>()((set) => ({
  ...EMPTY,
  step: 1,
  setStep: (step) => set({ step }),
  setName: (name) => set({ name }),
  setLocation: (location) => set({ location }),
  setWater: (w) =>
    set((s) => ({
      water: {
        ...s.water,
        ...w,
        ...(w.soilType !== undefined ? { soilType: normalizeSoilType(w.soilType) } : {}),
      },
    })),
  setCropIntent: (c) => set((s) => ({ cropIntent: { ...s.cropIntent, ...c } })),
  setSensorRecs: (sensorRecs) => set({ sensorRecs }),
  reset: () => set({ ...EMPTY, step: 1 }),
}));

// ─── Rule-based sensor recommendation engine ────────────────────────────────

/**
 * Returns sensor recommendations based on area, crop intent, and water source.
 * Rules derived from FAO irrigation management and precision agriculture best practices.
 */
export function computeSensorRecommendations(
  areaHa: number,
  waterSource: string,
  cropIntent: CropIntent | "",
): SensorRecommendation[] {
  const recs: SensorRecommendation[] = [];

  // Soil moisture — always essential
  recs.push({
    type: "Soil Moisture",
    quantity: Math.max(1, Math.ceil(areaHa / 1.5)),
    placement: "Root zone (15–30 cm depth), distributed across field",
    priority: "essential",
    reason: "Core input for irrigation scheduling and water balance calculation.",
  });

  // Soil temperature
  recs.push({
    type: "Soil Temperature",
    quantity: Math.max(1, Math.ceil(areaHa / 2)),
    placement: "10 cm depth, representative zones",
    priority: "essential",
    reason: "Required for Growing Degree Day (GDD) accumulation and germination timing.",
  });

  // Weather station — essential if area > 1 ha
  recs.push({
    type: "Micro Weather Station",
    quantity: 1,
    placement: "Open area, not shaded, at field centre",
    priority: areaHa > 1 ? "essential" : "recommended",
    reason: "Provides on-site temperature, humidity, rainfall, and wind for ET₀ calculation.",
  });

  // EC/pH — recommended for all
  recs.push({
    type: "Soil EC / pH",
    quantity: Math.max(1, Math.ceil(areaHa)),
    placement: "0–30 cm depth, one per management zone",
    priority: "recommended",
    reason: "Detects salinity build-up and pH drift that reduce nutrient uptake.",
  });

  // Flow meter — essential if using borewell or canal
  if (waterSource === "borewell" || waterSource === "canal" || waterSource === "river") {
    recs.push({
      type: "Water Flow Meter",
      quantity: 1,
      placement: "Main supply line, before field distribution",
      priority: "essential",
      reason: `Measures actual water applied via ${waterSource}; critical for irrigation audits and water-use efficiency.`,
    });
  }

  // Leaf wetness — recommended if crop planning
  if (cropIntent !== "") {
    recs.push({
      type: "Leaf Wetness",
      quantity: Math.max(1, Math.ceil(areaHa / 3)),
      placement: "Crop canopy height, shaded from direct sun",
      priority: "recommended",
      reason: "Predicts fungal disease risk (duration of leaf surface wetness correlates with blight/rust outbreaks).",
    });
  }

  // Solar radiation — optional, large farms
  if (areaHa >= 2) {
    recs.push({
      type: "Solar Radiation (PAR)",
      quantity: 1,
      placement: "Unobstructed, near weather station",
      priority: "optional",
      reason: "Improves Penman-Monteith ET₀ accuracy; useful for greenhouse crop modelling.",
    });
  }

  return recs;
}

// ─── Offline-First Persisted Farm Store (agritech-farms-v1) ──────────────────

export const safeStateStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (typeof window === "undefined") return null;
      const storage = window.localStorage;
      if (!storage) return null;
      const raw = storage.getItem(name);
      if (!raw) return null;
      JSON.parse(raw);
      return raw;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage?.setItem(name, value);
    } catch {
      // ignore unavailable or restricted storage
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window === "undefined") return;
      window.localStorage?.removeItem(name);
    } catch {
      // ignore unavailable or restricted storage
    }
  },
};

export interface FarmProperty {
  id: string;
  name: string;
  lat: number;
  lon: number;
  address: string;
  country?: string;
  region?: string;
  boundary?: GeoJSON.Polygon | null;
  areaHa: number;
  waterSource: string;
  availabilityMonths?: number[];
  irrigationType: IrrigationSystemType;
  soilType: SoilType;
  cropIntent: CropIntent | "";
  selectedCropId: string;
  previousCrops: string[];
  plannedSeason?: string;
  plannedDateStart?: string;
  plannedDateEnd?: string;
  sensorRecs: SensorRecommendation[];
  createdAt: string;
  updatedAt: string;
  syncedToBackend: boolean;
  fieldId?: string;
  deviceId?: string;
  sensors?: string[];
  waterAvailability?: string;
  defaultProperty?: boolean;
}

export type FarmSensor = Sensor & { syncedToBackend?: boolean };

export type FarmValve = ValveStatus & {
  farmId: string;
  lastInterlockOverrideReason?: string;
};

export type FarmSchedule = IrrigationSchedule & {
  farmId: string;
  status: "ACTIVE" | "PAUSED" | "DEFERRED_RAIN_HOLD";
  deferredUntil?: string | null;
  deferredSavedLitres?: number;
  syncedToBackend?: boolean;
};

export type FarmEvent = IrrigationEvent & {
  farmId: string;
  volumeLitres?: number;
  savedLitres?: number;
  eventType?: string;
  syncedToBackend?: boolean;
};

export type FarmerMode = "simple" | "full";

export type SyncOutboxKind =
  | "PROPERTY_CREATE"
  | "PROPERTY_UPDATE"
  | "PROPERTY_DELETE"
  | "SENSOR_REGISTER"
  | "SENSOR_DELETE"
  | "VALVE_OPEN"
  | "VALVE_CLOSE"
  | "VALVE_EMERGENCY_STOP"
  | "SCHEDULE_CREATE"
  | "SCHEDULE_TOGGLE"
  | "SCHEDULE_DELETE"
  | "crop_diagnosis"
  | "pmfby_evidence"
  | "roznamcha_entry";

export interface SyncOutboxItem {
  id: string;
  kind: SyncOutboxKind;
  farmId: string;
  resourceId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

export interface FarmPreferences {
  areaUnit: "ha" | "acres";
  theme: "light" | "dark";
  pumpFlowLpm: number;
}

export interface AddPropertyInput {
  id?: string;
  name: string;
  lat: number;
  lon: number;
  address?: string;
  country?: string;
  region?: string;
  boundary?: GeoJSON.Polygon | null;
  areaHa?: number;
  waterSource?: string;
  availabilityMonths?: number[];
  irrigationType?: string;
  soilType?: string;
  cropIntent?: CropIntent | "";
  selectedCropId?: string;
  previousCrops?: string[];
  plannedSeason?: string;
  plannedDateStart?: string;
  plannedDateEnd?: string;
  sensorRecs?: SensorRecommendation[];
}

export interface AddSensorInput {
  deviceId?: string;
  sensorType: string;
  fieldId?: string;
  status?: string;
  health?: Sensor["health"];
  batteryPercent?: number;
  latitude?: number;
  longitude?: number;
}

export interface CreateScheduleInput {
  scheduleId?: string;
  cropId?: string;
  valveId: string;
  zoneName?: string;
  recurrence?: "DAILY" | "WEEKLY";
  daysOfWeek?: string[];
  startTime: string;
  durationMinutes: number;
  skipIfMoist?: boolean;
}

export interface FarmStoreState {
  properties: FarmProperty[];
  activePropertyId: string | null;
  sensorsByFarm: Record<string, FarmSensor[]>;
  valvesByFarm: Record<string, FarmValve[]>;
  schedulesByFarm: Record<string, FarmSchedule[]>;
  eventsByFarm: Record<string, FarmEvent[]>;
  checklistByFarm: Record<string, Record<string, boolean>>;
  waterSavedLitres: number;
  syncOutbox: SyncOutboxItem[];
  preferences: FarmPreferences;
  farmerMode: FarmerMode;
  farmLocation: FarmLocationProfile;
  _hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;
  setFarmerMode: (mode: FarmerMode) => void;
  setFarmLocation: (loc: FarmLocationProfile) => void;
  addProperty: (input: AddPropertyInput, token?: string | null) => Promise<FarmProperty>;
  updateProperty: (
    id: string,
    patch: Partial<AddPropertyInput>,
    token?: string | null
  ) => Promise<FarmProperty | null>;
  deleteProperty: (id: string, token?: string | null) => Promise<void>;
  setActiveProperty: (id: string | null) => void;

  addSensor: (
    farmId: string,
    input: AddSensorInput,
    token?: string | null
  ) => Promise<FarmSensor>;
  removeSensor: (farmId: string, deviceId: string, token?: string | null) => Promise<void>;

  openValveWithAudit: (
    farmId: string,
    valveId: string,
    durationMinutes?: number,
    overrideReason?: string,
    token?: string | null
  ) => Promise<void>;
  closeValve: (farmId: string, valveId: string, token?: string | null) => Promise<void>;
  toggleValve: (
    farmId: string,
    valveId: string,
    opts?: { durationMinutes?: number; overrideReason?: string; token?: string | null }
  ) => Promise<void>;
  emergencyStopValves: (
    farmId: string,
    reason?: string,
    token?: string | null
  ) => Promise<void>;

  createSchedule: (
    farmId: string,
    input: CreateScheduleInput,
    token?: string | null
  ) => Promise<FarmSchedule>;
  toggleSchedule: (
    farmId: string,
    scheduleId: string,
    token?: string | null
  ) => Promise<void>;
  deleteSchedule: (
    farmId: string,
    scheduleId: string,
    token?: string | null
  ) => Promise<void>;
  deferScheduleRainHold: (
    farmId: string,
    scheduleId: string,
    savedLitres: number,
    reason?: string
  ) => void;

  toggleChecklistTask: (farmId: string, taskId: string) => void;
  logShiftDispatch: (farmId: string, summary: string) => void;
  setPreferences: (patch: Partial<FarmPreferences>) => void;
  syncPropertiesFromBackend: (token?: string | null) => Promise<FarmProperty[]>;
  syncSensorsFromBackend: (farmId: string, token?: string | null) => Promise<FarmSensor[]>;
  syncIrrigationFromBackend: (farmId: string, token?: string | null) => Promise<void>;
  flushOutbox: (
    token?: string | null
  ) => Promise<{ flushed: number; remaining: number; skipped: boolean }>;
  seedSampleFarmIfEmpty: () => Promise<FarmProperty | null>;
  clearSessionData: () => void;
}

function makeUid(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

function shortTag(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleaned.slice(-6) || "FARM01";
}

function hasOnlineToken(token?: string | null): token is string {
  return Boolean(token && !isOfflineToken(token));
}

function makeOutboxItem(
  kind: SyncOutboxKind,
  farmId: string,
  resourceId: string,
  payload: Record<string, unknown>,
  lastError?: string
): SyncOutboxItem {
  return {
    id: makeUid("OUTBOX"),
    kind,
    farmId,
    resourceId,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    lastError,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Network or backend error";
}

function mergeBackendProperty(remote: Property, existing?: FarmProperty): FarmProperty {
  return {
    id: remote.id,
    name: remote.name,
    lat: remote.lat,
    lon: remote.lon,
    address: remote.address,
    country: remote.district ?? existing?.country,
    region: remote.state ?? existing?.region,
    boundary: existing?.boundary ?? null,
    areaHa: remote.areaHa,
    waterSource: remote.waterSource,
    availabilityMonths: existing?.availabilityMonths ?? [],
    irrigationType: normalizeIrrigationType(remote.irrigationType) || existing?.irrigationType || "drip",
    soilType: normalizeSoilType(remote.soilType) || existing?.soilType || "loam",
    cropIntent: (remote.cropIntent as CropIntent | "") || existing?.cropIntent || "RECOMMEND_BEST",
    selectedCropId: remote.selectedCropId || existing?.selectedCropId || "wheat",
    previousCrops: remote.previousCrops ?? existing?.previousCrops ?? [],
    plannedSeason: remote.plannedSeason ?? existing?.plannedSeason,
    plannedDateStart: remote.plannedDateStart ?? existing?.plannedDateStart,
    plannedDateEnd: remote.plannedDateEnd ?? existing?.plannedDateEnd,
    sensorRecs:
      existing?.sensorRecs && existing.sensorRecs.length > 0
        ? existing.sensorRecs
        : computeSensorRecommendations(
            remote.areaHa,
            remote.waterSource,
            (remote.cropIntent as CropIntent | "") || "RECOMMEND_BEST"
          ),
    createdAt: remote.createdAt || existing?.createdAt || new Date().toISOString(),
    updatedAt: remote.updatedAt || existing?.updatedAt || new Date().toISOString(),
    syncedToBackend: true,
    fieldId: remote.fieldId ?? existing?.fieldId,
    deviceId: remote.deviceId ?? existing?.deviceId,
    sensors: remote.sensors ?? existing?.sensors,
    waterAvailability: remote.waterAvailability ?? existing?.waterAvailability,
    defaultProperty: remote.defaultProperty ?? existing?.defaultProperty,
  };
}

function resolveApiFarmId(localFarmId: string): string {
  const authFarmId = useAuthStore.getState().user?.farmId;
  if (authFarmId) return authFarmId;
  if (localFarmId && localFarmId !== "farm-ludhiana-1" && !localFarmId.startsWith("farm-")) {
    return localFarmId;
  }
  return "FARM-001";
}

function toFarmSchedule(sch: IrrigationSchedule, localFarmId: string): FarmSchedule {
  return {
    ...sch,
    farmId: localFarmId,
    status: sch.active ? "ACTIVE" : "PAUSED",
    syncedToBackend: true,
  };
}

export function getActiveProperty(
  state: Pick<FarmStoreState, "properties" | "activePropertyId">
): FarmProperty | null {
  return (
    state.properties.find((p) => p.id === state.activePropertyId) ??
    state.properties[0] ??
    null
  );
}

export const useFarmStore = create<FarmStoreState>()(
  persist(
    (set, get) => ({
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
      farmerMode: "full",
      farmLocation: DEFAULT_FARM_LOCATION,
      _hasHydrated: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setFarmerMode: (farmerMode) => set({ farmerMode }),
      setFarmLocation: (farmLocation) => set({ farmLocation }),

      clearSessionData: () => {
        void getDefaultMediaStore()
          .clearAll()
          .catch(() => {});
        safeStateStorage.removeItem("agritech-roznamcha-v1");
        safeStateStorage.removeItem("agritech-pmfby-v1");
        safeStateStorage.removeItem("agritech-truth-history-v1");
        set({
          properties: [],
          activePropertyId: null,
          sensorsByFarm: {},
          valvesByFarm: {},
          schedulesByFarm: {},
          eventsByFarm: {},
          checklistByFarm: {},
          waterSavedLitres: 0,
          syncOutbox: [],
        });
      },

      addProperty: async (input, token) => {
        const now = new Date().toISOString();
        const id = input.id?.trim() || makeUid("FARM");
        const tag = shortTag(id);
        const areaHa = Math.max(0.1, Number(input.areaHa) || 1);
        const waterSource = input.waterSource || "borewell";
        const cropIntent = input.cropIntent ?? "RECOMMEND_BEST";
        const selectedCropId = input.selectedCropId || "wheat";
        const sensorRecs =
          input.sensorRecs && input.sensorRecs.length > 0
            ? input.sensorRecs
            : computeSensorRecommendations(areaHa, waterSource, cropIntent);

        const property: FarmProperty = {
          id,
          name: input.name.trim() || "Unnamed Farm",
          lat: Number.isFinite(input.lat) ? input.lat : 20.46,
          lon: Number.isFinite(input.lon) ? input.lon : 85.88,
          address: input.address ?? "",
          country: input.country,
          region: input.region,
          boundary: input.boundary ?? null,
          areaHa,
          waterSource,
          availabilityMonths: input.availabilityMonths ?? [],
          irrigationType: normalizeIrrigationType(input.irrigationType) || "drip",
          soilType: normalizeSoilType(input.soilType) || "loam",
          cropIntent,
          selectedCropId,
          previousCrops: input.previousCrops ?? [],
          plannedSeason: input.plannedSeason,
          plannedDateStart: input.plannedDateStart,
          plannedDateEnd: input.plannedDateEnd,
          sensorRecs,
          createdAt: now,
          updatedAt: now,
          syncedToBackend: false,
        };

        const seededSensors: FarmSensor[] = sensorRecs.slice(0, 4).map((rec, idx) => ({
          deviceId: `SENSOR-${tag}-0${idx + 1}`,
          farmId: id,
          sensorType: rec.type.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          fieldId: "FIELD-01",
          status: "ACTIVE",
          health: "ONLINE",
          batteryPercent: 95 - idx * 4,
          lastReadingAt: now,
          location: {
            latitude: Number((property.lat + idx * 0.0004).toFixed(6)),
            longitude: Number((property.lon + idx * 0.0004).toFixed(6)),
          },
          syncedToBackend: false,
        }));

        const defaultValveId = `VALVE-${tag}-01`;
        const defaultValve: FarmValve = {
          valveId: defaultValveId,
          farmId: id,
          cropId: selectedCropId,
          zoneName: "Main Zone",
          state: "CLOSED",
          flowRateLpm: 0,
          ratedFlowLpm: get().preferences.pumpFlowLpm,
          lastChangedAt: now,
          openUntil: null,
          secondsRemaining: null,
          runningScheduleId: null,
        };

        const defaultSchedule: FarmSchedule = {
          scheduleId: `SCH-${tag}-01`,
          farmId: id,
          cropId: selectedCropId,
          valveId: defaultValveId,
          zoneName: "Main Zone",
          recurrence: "DAILY",
          daysOfWeek: [],
          startTime: "06:00",
          durationMinutes: 25,
          active: true,
          skipIfMoist: true,
          lastRunAt: null,
          status: "ACTIVE",
        };

        set((s) => ({
          properties: [...s.properties, property],
          activePropertyId: id,
          sensorsByFarm: { ...s.sensorsByFarm, [id]: seededSensors },
          valvesByFarm: { ...s.valvesByFarm, [id]: [defaultValve] },
          schedulesByFarm: { ...s.schedulesByFarm, [id]: [defaultSchedule] },
          eventsByFarm: { ...s.eventsByFarm, [id]: s.eventsByFarm[id] ?? [] },
          checklistByFarm: { ...s.checklistByFarm, [id]: s.checklistByFarm[id] ?? {} },
        }));

        const payload: Record<string, unknown> = {
          id: property.id,
          name: property.name,
          lat: property.lat,
          lon: property.lon,
          address: property.address,
          areaHa: property.areaHa,
          waterSource: property.waterSource,
          irrigationType: property.irrigationType,
          soilType: property.soilType,
          cropIntent: property.cropIntent,
          selectedCropId: property.selectedCropId,
          previousCrops: property.previousCrops,
          availabilityMonths: property.availabilityMonths,
          plannedSeason: property.plannedSeason,
          plannedDateStart: property.plannedDateStart,
          plannedDateEnd: property.plannedDateEnd,
          state: property.region,
          district: property.country,
          boundary: property.boundary,
        };

        if (hasOnlineToken(token)) {
          try {
            const created = await propertyApi.create(payload, token);
            const finalId = created?.id?.trim() ? created.id : id;
            const synced: FarmProperty = created?.id
              ? mergeBackendProperty(created, property)
              : { ...property, syncedToBackend: true };
            synced.id = finalId;
            synced.syncedToBackend = true;

            set((s) => {
              const nextProperties = s.properties.map((p) => (p.id === id ? synced : p));
              if (finalId === id) {
                return { properties: nextProperties };
              }
              const nextSensors = { ...s.sensorsByFarm };
              const nextValves = { ...s.valvesByFarm };
              const nextSchedules = { ...s.schedulesByFarm };
              const nextEvents = { ...s.eventsByFarm };
              const nextChecklist = { ...s.checklistByFarm };
              if (nextSensors[id]) {
                nextSensors[finalId] = nextSensors[id].map((sen, idx) =>
                  idx === 0 && created.deviceId
                    ? { ...sen, deviceId: created.deviceId, farmId: finalId, fieldId: created.fieldId ?? sen.fieldId, syncedToBackend: true }
                    : { ...sen, farmId: finalId }
                );
                delete nextSensors[id];
              }
              if (nextValves[id]) {
                nextValves[finalId] = nextValves[id].map((v) => ({ ...v, farmId: finalId }));
                delete nextValves[id];
              }
              if (nextSchedules[id]) {
                nextSchedules[finalId] = nextSchedules[id].map((sch) => ({ ...sch, farmId: finalId }));
                delete nextSchedules[id];
              }
              if (nextEvents[id]) {
                nextEvents[finalId] = nextEvents[id].map((evt) => ({ ...evt, farmId: finalId }));
                delete nextEvents[id];
              }
              if (nextChecklist[id]) {
                nextChecklist[finalId] = nextChecklist[id];
                delete nextChecklist[id];
              }
              return {
                properties: nextProperties,
                activePropertyId: s.activePropertyId === id ? finalId : s.activePropertyId,
                sensorsByFarm: nextSensors,
                valvesByFarm: nextValves,
                schedulesByFarm: nextSchedules,
                eventsByFarm: nextEvents,
                checklistByFarm: nextChecklist,
              };
            });
            return synced;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("PROPERTY_CREATE", id, id, payload, errorMessage(err)),
                ],
              }));
              return property;
            }
            set((s) => {
              const remaining = s.properties.filter((p) => p.id !== id);
              const nextSensors = { ...s.sensorsByFarm };
              const nextValves = { ...s.valvesByFarm };
              const nextSchedules = { ...s.schedulesByFarm };
              delete nextSensors[id];
              delete nextValves[id];
              delete nextSchedules[id];
              return {
                properties: remaining,
                activePropertyId: s.activePropertyId === id ? (remaining[0]?.id ?? null) : s.activePropertyId,
                sensorsByFarm: nextSensors,
                valvesByFarm: nextValves,
                schedulesByFarm: nextSchedules,
              };
            });
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [...s.syncOutbox, makeOutboxItem("PROPERTY_CREATE", id, id, payload)],
        }));
        return property;
      },

      updateProperty: async (id, patch, token) => {
        const existing = get().properties.find((p) => p.id === id);
        if (!existing) return null;

        const now = new Date().toISOString();
        const updated: FarmProperty = {
          ...existing,
          ...patch,
          id: existing.id,
          areaHa:
            patch.areaHa !== undefined
              ? Math.max(0.1, Number(patch.areaHa) || existing.areaHa)
              : existing.areaHa,
          soilType:
            patch.soilType !== undefined
              ? normalizeSoilType(patch.soilType)
              : existing.soilType,
          irrigationType:
            patch.irrigationType !== undefined
              ? normalizeIrrigationType(patch.irrigationType)
              : existing.irrigationType,
          updatedAt: now,
        };

        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? updated : p)),
        }));

        const payload: Record<string, unknown> = {
          name: updated.name,
          lat: updated.lat,
          lon: updated.lon,
          address: updated.address,
          areaHa: updated.areaHa,
          waterSource: updated.waterSource,
          irrigationType: updated.irrigationType,
          soilType: updated.soilType,
          cropIntent: updated.cropIntent,
          selectedCropId: updated.selectedCropId,
          previousCrops: updated.previousCrops,
          availabilityMonths: updated.availabilityMonths,
          plannedSeason: updated.plannedSeason,
          plannedDateStart: updated.plannedDateStart,
          plannedDateEnd: updated.plannedDateEnd,
          state: updated.region,
          district: updated.country,
          boundary: updated.boundary,
        };

        if (hasOnlineToken(token)) {
          try {
            const saved = await propertyApi.update(id, payload, token);
            const synced: FarmProperty = saved?.id
              ? mergeBackendProperty(saved, updated)
              : { ...updated, syncedToBackend: true };
            set((s) => ({
              properties: s.properties.map((p) => (p.id === id ? synced : p)),
            }));
            return synced;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("PROPERTY_UPDATE", id, id, payload, errorMessage(err)),
                ],
              }));
              return updated;
            }
            set((s) => ({
              properties: s.properties.map((p) => (p.id === id ? existing : p)),
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [...s.syncOutbox, makeOutboxItem("PROPERTY_UPDATE", id, id, payload)],
        }));
        return updated;
      },

      deleteProperty: async (id, token) => {
        const existing = get().properties.find((p) => p.id === id);
        if (!existing) return;

        set((s) => {
          const remaining = s.properties.filter((p) => p.id !== id);
          const nextActive =
            s.activePropertyId === id ? (remaining[0]?.id ?? null) : s.activePropertyId;

          const nextSensors = { ...s.sensorsByFarm };
          const nextValves = { ...s.valvesByFarm };
          const nextSchedules = { ...s.schedulesByFarm };
          const nextEvents = { ...s.eventsByFarm };
          const nextChecklist = { ...s.checklistByFarm };
          delete nextSensors[id];
          delete nextValves[id];
          delete nextSchedules[id];
          delete nextEvents[id];
          delete nextChecklist[id];

          return {
            properties: remaining,
            activePropertyId: nextActive,
            sensorsByFarm: nextSensors,
            valvesByFarm: nextValves,
            schedulesByFarm: nextSchedules,
            eventsByFarm: nextEvents,
            checklistByFarm: nextChecklist,
            syncOutbox: s.syncOutbox.filter((item) => item.farmId !== id),
          };
        });

        if (existing.syncedToBackend) {
          if (hasOnlineToken(token)) {
            try {
              await propertyApi.remove(id, token);
            } catch (err) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("PROPERTY_DELETE", id, id, {}, errorMessage(err)),
                ],
              }));
            }
          } else {
            set((s) => ({
              syncOutbox: [...s.syncOutbox, makeOutboxItem("PROPERTY_DELETE", id, id, {})],
            }));
          }
        }
      },

      setActiveProperty: (id) => {
        if (id === null) {
          set({ activePropertyId: null });
          return;
        }
        const target = get().properties.find((p) => p.id === id);
        if (target) {
          const inferred = inferLocationFromAddress(target.address);
          set((s) => ({
            activePropertyId: id,
            ...(inferred &&
            s.farmLocation.stateCode === DEFAULT_FARM_LOCATION.stateCode &&
            s.farmLocation.districtName === DEFAULT_FARM_LOCATION.districtName
              ? { farmLocation: inferred }
              : {}),
          }));
        }
      },

      addSensor: async (farmId, input, token) => {
        const farm = get().properties.find((p) => p.id === farmId);
        const now = new Date().toISOString();
        const deviceId = input.deviceId?.trim() || makeUid(`SENSOR-${shortTag(farmId)}`);
        const lat = input.latitude ?? farm?.lat;
        const lon = input.longitude ?? farm?.lon;
        const apiFarmId = resolveApiFarmId(farmId);

        const sensor: FarmSensor = {
          deviceId,
          farmId,
          sensorType: input.sensorType,
          fieldId: input.fieldId || farm?.fieldId || "FIELD-01",
          status: input.status || "ACTIVE",
          health: input.health || "ONLINE",
          batteryPercent: input.batteryPercent ?? 100,
          lastReadingAt: now,
          registered: now,
          location:
            lat !== undefined && lon !== undefined
              ? { latitude: lat, longitude: lon }
              : undefined,
          syncedToBackend: false,
        };

        set((s) => ({
          sensorsByFarm: {
            ...s.sensorsByFarm,
            [farmId]: [...(s.sensorsByFarm[farmId] ?? []), sensor],
          },
        }));

        const payload: Record<string, unknown> = {
          deviceId: sensor.deviceId,
          farmId: apiFarmId,
          sensorType: sensor.sensorType,
          fieldId: sensor.fieldId,
          latitude: lat,
          longitude: lon,
        };

        if (hasOnlineToken(token)) {
          try {
            const created = await sensorApi.register(
              payload as unknown as Parameters<typeof sensorApi.register>[0],
              token
            );
            const synced: FarmSensor = { ...sensor, ...created, syncedToBackend: true };
            set((s) => ({
              sensorsByFarm: {
                ...s.sensorsByFarm,
                [farmId]: (s.sensorsByFarm[farmId] ?? []).map((item) =>
                  item.deviceId === deviceId ? synced : item
                ),
              },
            }));
            return synced;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("SENSOR_REGISTER", farmId, deviceId, payload, errorMessage(err)),
                ],
              }));
              return sensor;
            }
            set((s) => ({
              sensorsByFarm: {
                ...s.sensorsByFarm,
                [farmId]: (s.sensorsByFarm[farmId] ?? []).filter(
                  (item) => item.deviceId !== deviceId
                ),
              },
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [
            ...s.syncOutbox,
            makeOutboxItem("SENSOR_REGISTER", farmId, deviceId, payload),
          ],
        }));
        return sensor;
      },

      removeSensor: async (farmId, deviceId, token) => {
        const existing = (get().sensorsByFarm[farmId] ?? []).find(
          (s) => s.deviceId === deviceId
        );
        set((s) => ({
          sensorsByFarm: {
            ...s.sensorsByFarm,
            [farmId]: (s.sensorsByFarm[farmId] ?? []).filter(
              (item) => item.deviceId !== deviceId
            ),
          },
          syncOutbox: s.syncOutbox.filter(
            (item) => !(item.kind === "SENSOR_REGISTER" && item.resourceId === deviceId)
          ),
        }));

        const shouldCallBackend = existing ? Boolean(existing.syncedToBackend) : true;
        if (shouldCallBackend) {
          if (hasOnlineToken(token)) {
            try {
              await sensorApi.remove(deviceId, token);
            } catch (err) {
              if (isBackendUnreachableError(err)) {
                set((s) => ({
                  syncOutbox: [
                    ...s.syncOutbox,
                    makeOutboxItem("SENSOR_DELETE", farmId, deviceId, {}, errorMessage(err)),
                  ],
                }));
                return;
              }
              if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
                return;
              }
              if (existing) {
                set((s) => ({
                  sensorsByFarm: {
                    ...s.sensorsByFarm,
                    [farmId]: [...(s.sensorsByFarm[farmId] ?? []), existing],
                  },
                }));
              }
              throw err;
            }
          } else if (existing?.syncedToBackend) {
            set((s) => ({
              syncOutbox: [
                ...s.syncOutbox,
                makeOutboxItem("SENSOR_DELETE", farmId, deviceId, {}),
              ],
            }));
          }
        }
      },

      openValveWithAudit: async (
        farmId,
        valveId,
        durationMinutes = 20,
        overrideReason,
        token
      ) => {
        const mins = Number.isFinite(durationMinutes)
          ? Math.min(240, Math.max(1, Math.round(durationMinutes)))
          : 20;
        const nowMs = Date.now();
        const now = new Date(nowMs).toISOString();
        const openUntil = new Date(nowMs + mins * 60_000).toISOString();

        const prevValves = get().valvesByFarm[farmId] ?? [];
        const prevEvents = get().eventsByFarm[farmId] ?? [];
        const target = prevValves.find((v) => v.valveId === valveId);
        const ratedFlow = target?.ratedFlowLpm ?? get().preferences.pumpFlowLpm;

        const evt: FarmEvent = {
          id: makeUid("EVT"),
          farmId,
          severity: overrideReason ? "WARNING" : "INFO",
          source: valveId,
          cropId: target?.cropId ?? "wheat",
          message: overrideReason
            ? `Valve ${valveId} opened (${mins} min) with interlock override: ${overrideReason}`
            : `Valve ${valveId} opened for ${mins} min`,
          timestamp: now,
          eventType: overrideReason ? "INTERLOCK_OVERRIDE" : "VALVE_OPEN",
        };

        set((s) => {
          const existingList = s.valvesByFarm[farmId] ?? [];
          const hasValve = existingList.some((v) => v.valveId === valveId);
          const nextValves: FarmValve[] = hasValve
            ? existingList.map((v) =>
                v.valveId === valveId
                  ? {
                      ...v,
                      state: "OPEN",
                      flowRateLpm: ratedFlow,
                      lastChangedAt: now,
                      openUntil,
                      secondsRemaining: mins * 60,
                      lastInterlockOverrideReason: overrideReason,
                    }
                  : v
              )
            : [
                ...existingList,
                {
                  valveId,
                  farmId,
                  cropId: target?.cropId ?? "wheat",
                  zoneName: "North Furrow Main Valve",
                  state: "OPEN",
                  flowRateLpm: ratedFlow,
                  ratedFlowLpm: ratedFlow,
                  lastChangedAt: now,
                  openUntil,
                  secondsRemaining: mins * 60,
                  runningScheduleId: null,
                  lastInterlockOverrideReason: overrideReason,
                },
              ];

          return {
            valvesByFarm: {
              ...s.valvesByFarm,
              [farmId]: nextValves,
            },
            eventsByFarm: {
              ...s.eventsByFarm,
              [farmId]: [evt, ...(s.eventsByFarm[farmId] ?? [])],
            },
          };
        });

        const payload = { durationMinutes: mins, overrideReason };
        if (hasOnlineToken(token)) {
          try {
            const liveValve = await valveApi.open(valveId, token, mins);
            if (liveValve && liveValve.valveId) {
              set((s) => ({
                valvesByFarm: {
                  ...s.valvesByFarm,
                  [farmId]: (s.valvesByFarm[farmId] ?? []).map((v) =>
                    v.valveId === valveId
                      ? {
                          ...liveValve,
                          farmId,
                          lastInterlockOverrideReason: overrideReason,
                        }
                      : v
                  ),
                },
              }));
            }
            return;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("VALVE_OPEN", farmId, valveId, payload, errorMessage(err)),
                ],
              }));
              return;
            }
            set((s) => ({
              valvesByFarm: { ...s.valvesByFarm, [farmId]: prevValves },
              eventsByFarm: { ...s.eventsByFarm, [farmId]: prevEvents },
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [...s.syncOutbox, makeOutboxItem("VALVE_OPEN", farmId, valveId, payload)],
        }));
      },

      closeValve: async (farmId, valveId, token) => {
        const now = new Date().toISOString();
        const prevValves = get().valvesByFarm[farmId] ?? [];
        const prevEvents = get().eventsByFarm[farmId] ?? [];
        const target = prevValves.find((v) => v.valveId === valveId);

        const evt: FarmEvent = {
          id: makeUid("EVT"),
          farmId,
          severity: "INFO",
          source: valveId,
          cropId: target?.cropId ?? "wheat",
          message: `Valve ${valveId} closed`,
          timestamp: now,
          eventType: "VALVE_CLOSE",
        };

        set((s) => ({
          valvesByFarm: {
            ...s.valvesByFarm,
            [farmId]: (s.valvesByFarm[farmId] ?? []).map((v) =>
              v.valveId === valveId
                ? {
                    ...v,
                    state: "CLOSED",
                    flowRateLpm: 0,
                    lastChangedAt: now,
                    openUntil: null,
                    secondsRemaining: null,
                    runningScheduleId: null,
                  }
                : v
            ),
          },
          eventsByFarm: {
            ...s.eventsByFarm,
            [farmId]: [evt, ...(s.eventsByFarm[farmId] ?? [])],
          },
        }));

        if (hasOnlineToken(token)) {
          try {
            const liveValve = await valveApi.close(valveId, token);
            if (liveValve && liveValve.valveId) {
              set((s) => ({
                valvesByFarm: {
                  ...s.valvesByFarm,
                  [farmId]: (s.valvesByFarm[farmId] ?? []).map((v) =>
                    v.valveId === valveId ? { ...liveValve, farmId } : v
                  ),
                },
              }));
            }
            return;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("VALVE_CLOSE", farmId, valveId, {}, errorMessage(err)),
                ],
              }));
              return;
            }
            set((s) => ({
              valvesByFarm: { ...s.valvesByFarm, [farmId]: prevValves },
              eventsByFarm: { ...s.eventsByFarm, [farmId]: prevEvents },
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [...s.syncOutbox, makeOutboxItem("VALVE_CLOSE", farmId, valveId, {})],
        }));
      },

      toggleValve: async (farmId, valveId, opts) => {
        const target = (get().valvesByFarm[farmId] ?? []).find((v) => v.valveId === valveId);
        if (target?.state === "OPEN") {
          await get().closeValve(farmId, valveId, opts?.token);
        } else {
          await get().openValveWithAudit(
            farmId,
            valveId,
            opts?.durationMinutes ?? 20,
            opts?.overrideReason,
            opts?.token
          );
        }
      },

      emergencyStopValves: async (farmId, reason = "Operator emergency stop", token) => {
        const now = new Date().toISOString();
        const prevValves = get().valvesByFarm[farmId] ?? [];
        const prevEvents = get().eventsByFarm[farmId] ?? [];
        const evt: FarmEvent = {
          id: makeUid("EVT"),
          farmId,
          severity: "CRITICAL",
          source: "ALL_VALVES",
          cropId: get().properties.find((p) => p.id === farmId)?.selectedCropId ?? "wheat",
          message: `Emergency stop triggered: ${reason}`,
          timestamp: now,
          eventType: "EMERGENCY_STOP",
        };

        set((s) => ({
          valvesByFarm: {
            ...s.valvesByFarm,
            [farmId]: (s.valvesByFarm[farmId] ?? []).map((v) => ({
              ...v,
              state: "CLOSED",
              flowRateLpm: 0,
              lastChangedAt: now,
              openUntil: null,
              secondsRemaining: null,
              runningScheduleId: null,
            })),
          },
          eventsByFarm: {
            ...s.eventsByFarm,
            [farmId]: [evt, ...(s.eventsByFarm[farmId] ?? [])],
          },
        }));

        if (hasOnlineToken(token)) {
          try {
            await valveApi.emergencyStop(token, reason);
            return;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem(
                    "VALVE_EMERGENCY_STOP",
                    farmId,
                    "ALL",
                    { reason },
                    errorMessage(err)
                  ),
                ],
              }));
              return;
            }
            set((s) => ({
              valvesByFarm: { ...s.valvesByFarm, [farmId]: prevValves },
              eventsByFarm: { ...s.eventsByFarm, [farmId]: prevEvents },
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [
            ...s.syncOutbox,
            makeOutboxItem("VALVE_EMERGENCY_STOP", farmId, "ALL", { reason }),
          ],
        }));
      },

      createSchedule: async (farmId, input, token) => {
        const now = new Date().toISOString();
        const farm = get().properties.find((p) => p.id === farmId);
        const matchingValve = (get().valvesByFarm[farmId] ?? []).find(
          (v) => v.valveId === input.valveId
        );
        const resolvedCropId =
          input.cropId || matchingValve?.cropId || farm?.fieldId || farm?.selectedCropId || "CROP-FIELD-01";
        const resolvedApiFarmId = resolveApiFarmId(farmId);
        const scheduleId = input.scheduleId?.trim() || makeUid("SCH");
        const schedule: FarmSchedule = {
          scheduleId,
          farmId,
          cropId: resolvedCropId,
          valveId: input.valveId,
          zoneName: input.zoneName || matchingValve?.zoneName || "Main Zone",
          recurrence: input.recurrence ?? "DAILY",
          daysOfWeek: input.daysOfWeek ?? [],
          startTime: input.startTime,
          durationMinutes: Math.max(1, Math.round(input.durationMinutes)),
          active: true,
          skipIfMoist: input.skipIfMoist ?? true,
          lastRunAt: null,
          status: "ACTIVE",
          syncedToBackend: false,
        };

        const evt: FarmEvent = {
          id: makeUid("EVT"),
          farmId,
          severity: "INFO",
          source: schedule.valveId,
          cropId: schedule.cropId,
          message: `Created schedule ${schedule.startTime} (${schedule.durationMinutes} min)`,
          timestamp: now,
          eventType: "SCHEDULE_CREATE",
        };

        set((s) => ({
          schedulesByFarm: {
            ...s.schedulesByFarm,
            [farmId]: [...(s.schedulesByFarm[farmId] ?? []), schedule],
          },
          eventsByFarm: {
            ...s.eventsByFarm,
            [farmId]: [evt, ...(s.eventsByFarm[farmId] ?? [])],
          },
        }));

        const payload: CreateIrrigationSchedulePayload = {
          cropId: schedule.cropId,
          valveId: schedule.valveId,
          farmId: resolvedApiFarmId,
          recurrence: schedule.recurrence === "WEEKLY" ? "WEEKLY" : "DAILY",
          daysOfWeek: schedule.daysOfWeek,
          startTime: schedule.startTime,
          durationMinutes: schedule.durationMinutes,
          skipIfMoist: schedule.skipIfMoist,
          active: schedule.active,
        };

        if (hasOnlineToken(token)) {
          try {
            const created = await irrigationApi.createSchedule(payload, token);
            const finalSchedule: FarmSchedule =
              created && created.scheduleId
                ? toFarmSchedule(created, farmId)
                : { ...schedule, syncedToBackend: true };
            set((s) => ({
              schedulesByFarm: {
                ...s.schedulesByFarm,
                [farmId]: (s.schedulesByFarm[farmId] ?? []).map((sch) =>
                  sch.scheduleId === scheduleId ? finalSchedule : sch
                ),
              },
            }));
            return finalSchedule;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem(
                    "SCHEDULE_CREATE",
                    farmId,
                    scheduleId,
                    payload as unknown as Record<string, unknown>,
                    errorMessage(err)
                  ),
                ],
              }));
              return schedule;
            }
            set((s) => ({
              schedulesByFarm: {
                ...s.schedulesByFarm,
                [farmId]: (s.schedulesByFarm[farmId] ?? []).filter(
                  (sch) => sch.scheduleId !== scheduleId
                ),
              },
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [
            ...s.syncOutbox,
            makeOutboxItem(
              "SCHEDULE_CREATE",
              farmId,
              scheduleId,
              payload as unknown as Record<string, unknown>
            ),
          ],
        }));
        return schedule;
      },

      toggleSchedule: async (farmId, scheduleId, token) => {
        const prevSchedules = get().schedulesByFarm[farmId] ?? [];
        const target = prevSchedules.find((s) => s.scheduleId === scheduleId);
        if (!target) return;
        const nextActive = !target.active;

        set((s) => ({
          schedulesByFarm: {
            ...s.schedulesByFarm,
            [farmId]: (s.schedulesByFarm[farmId] ?? []).map((sch) =>
              sch.scheduleId === scheduleId
                ? {
                    ...sch,
                    active: nextActive,
                    status: nextActive ? "ACTIVE" : "PAUSED",
                    deferredUntil: nextActive ? null : sch.deferredUntil,
                  }
                : sch
            ),
          },
        }));

        if (hasOnlineToken(token)) {
          try {
            const updated = await irrigationApi.toggleSchedule(scheduleId, nextActive, token);
            if (updated && updated.scheduleId) {
              set((s) => ({
                schedulesByFarm: {
                  ...s.schedulesByFarm,
                  [farmId]: (s.schedulesByFarm[farmId] ?? []).map((sch) =>
                    sch.scheduleId === scheduleId ? toFarmSchedule(updated, farmId) : sch
                  ),
                },
              }));
            }
            return;
          } catch (err) {
            if (isPropertyEndpointUnavailableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem(
                    "SCHEDULE_TOGGLE",
                    farmId,
                    scheduleId,
                    { active: nextActive },
                    errorMessage(err)
                  ),
                ],
              }));
              return;
            }
            set((s) => ({
              schedulesByFarm: { ...s.schedulesByFarm, [farmId]: prevSchedules },
            }));
            throw err;
          }
        }

        set((s) => ({
          syncOutbox: [
            ...s.syncOutbox,
            makeOutboxItem("SCHEDULE_TOGGLE", farmId, scheduleId, { active: nextActive }),
          ],
        }));
      },

      deleteSchedule: async (farmId, scheduleId, token) => {
        const prevSchedules = get().schedulesByFarm[farmId] ?? [];
        const target = prevSchedules.find((sch) => sch.scheduleId === scheduleId);
        set((s) => ({
          schedulesByFarm: {
            ...s.schedulesByFarm,
            [farmId]: prevSchedules.filter((sch) => sch.scheduleId !== scheduleId),
          },
        }));

        if (hasOnlineToken(token)) {
          try {
            await irrigationApi.deleteSchedule(scheduleId, token);
            return;
          } catch (err) {
            if (isBackendUnreachableError(err)) {
              set((s) => ({
                syncOutbox: [
                  ...s.syncOutbox,
                  makeOutboxItem("SCHEDULE_DELETE", farmId, scheduleId, {}, errorMessage(err)),
                ],
              }));
              return;
            }
            if (err instanceof Error && "status" in err && (err as { status: number }).status === 404) {
              return;
            }
            set((s) => ({
              schedulesByFarm: { ...s.schedulesByFarm, [farmId]: prevSchedules },
            }));
            throw err;
          }
        }

        if (target?.syncedToBackend) {
          set((s) => ({
            syncOutbox: [
              ...s.syncOutbox,
              makeOutboxItem("SCHEDULE_DELETE", farmId, scheduleId, {}),
            ],
          }));
        }
      },

      deferScheduleRainHold: (
        farmId,
        scheduleId,
        savedLitres,
        reason = "FieldShield Rain-Hold Interlock"
      ) => {
        const safeSaved = Math.max(0, Math.round(Number.isFinite(savedLitres) ? savedLitres : 0));
        const now = new Date().toISOString();
        const deferredUntil = new Date(Date.now() + 24 * 3600_000).toISOString();
        const target = (get().schedulesByFarm[farmId] ?? []).find(
          (s) => s.scheduleId === scheduleId
        );

        const evt: FarmEvent = {
          id: makeUid("EVT"),
          farmId,
          severity: "INFO",
          source: target?.valveId ?? scheduleId,
          cropId: target?.cropId ?? "wheat",
          message: `Deferred 24h (${reason}) — banked ${safeSaved.toLocaleString("en-US")} L`,
          timestamp: now,
          savedLitres: safeSaved,
          eventType: "RAIN_HOLD_DEFER",
        };

        set((s) => {
          const existingSchedules = s.schedulesByFarm[farmId] ?? [];
          const hasSchedule = existingSchedules.some((sch) => sch.scheduleId === scheduleId);
          const nextSchedules: FarmSchedule[] = hasSchedule
            ? existingSchedules.map((sch) =>
                sch.scheduleId === scheduleId
                  ? {
                      ...sch,
                      active: false,
                      status: "DEFERRED_RAIN_HOLD",
                      deferredUntil,
                      deferredSavedLitres: safeSaved,
                    }
                  : sch
              )
            : [
                ...existingSchedules,
                {
                  scheduleId,
                  farmId,
                  cropId: "wheat",
                  valveId: "VALVE-MAIN-01",
                  zoneName: "Main Zone Morning Cycle",
                  recurrence: "DAILY",
                  daysOfWeek: [],
                  startTime: "06:00",
                  durationMinutes: 25,
                  active: false,
                  skipIfMoist: true,
                  lastRunAt: null,
                  status: "DEFERRED_RAIN_HOLD",
                  deferredUntil,
                  deferredSavedLitres: safeSaved,
                },
              ];

          return {
            schedulesByFarm: {
              ...s.schedulesByFarm,
              [farmId]: nextSchedules,
            },
            waterSavedLitres: s.waterSavedLitres + safeSaved,
            eventsByFarm: {
              ...s.eventsByFarm,
              [farmId]: [evt, ...(s.eventsByFarm[farmId] ?? [])],
            },
          };
        });
      },

      toggleChecklistTask: (farmId, taskId) => {
        set((s) => {
          const prevFarmMap = s.checklistByFarm[farmId] ?? {};
          return {
            checklistByFarm: {
              ...s.checklistByFarm,
              [farmId]: {
                ...prevFarmMap,
                [taskId]: !prevFarmMap[taskId],
              },
            },
          };
        });
      },

      logShiftDispatch: (farmId, summary) => {
        const now = new Date().toISOString();
        const farm = get().properties.find((p) => p.id === farmId);
        const evt: FarmEvent = {
          id: makeUid("EVT"),
          farmId,
          severity: "INFO",
          source: "FIELDSHIELD",
          cropId: farm?.selectedCropId ?? "wheat",
          message: summary,
          timestamp: now,
          eventType: "SHIFT_DISPATCH",
        };
        set((s) => ({
          eventsByFarm: {
            ...s.eventsByFarm,
            [farmId]: [evt, ...(s.eventsByFarm[farmId] ?? [])],
          },
        }));
      },

      setPreferences: (patch) => {
        set((s) => ({ preferences: { ...s.preferences, ...patch } }));
      },

      syncPropertiesFromBackend: async (token) => {
        if (!hasOnlineToken(token)) return get().properties;
        try {
          const remoteProps = await propertyApi.list(token);
          const pendingCreates = new Set(
            get()
              .syncOutbox.filter((i) => i.kind === "PROPERTY_CREATE")
              .map((i) => i.farmId)
          );
          const existingList = get().properties;
          const existingById = new Map(existingList.map((p) => [p.id, p]));
          const mergedBackend = remoteProps.map((rp) =>
            mergeBackendProperty(rp, existingById.get(rp.id))
          );
          const backendIds = new Set(mergedBackend.map((p) => p.id));
          const unsyncedLocal = existingList.filter(
            (p) => !p.syncedToBackend && pendingCreates.has(p.id) && !backendIds.has(p.id)
          );
          const nextProperties = [...mergedBackend, ...unsyncedLocal];
          const currentActive = get().activePropertyId;
          const nextActive =
            currentActive && nextProperties.some((p) => p.id === currentActive)
              ? currentActive
              : (nextProperties.find((p) => p.defaultProperty)?.id ?? nextProperties[0]?.id ?? null);

          set({
            properties: nextProperties,
            activePropertyId: nextActive,
          });
          return nextProperties;
        } catch {
          return get().properties;
        }
      },

      syncSensorsFromBackend: async (farmId, token) => {
        if (!hasOnlineToken(token)) return get().sensorsByFarm[farmId] ?? [];
        try {
          const res = await sensorApi.list(token, "page=0&size=100");
          const remoteList = Array.isArray(res?.content) ? res.content : [];
          const pendingIds = new Set(
            get()
              .syncOutbox.filter((i) => i.kind === "SENSOR_REGISTER")
              .map((i) => i.resourceId)
          );
          const remoteIds = new Set(remoteList.map((s) => s.deviceId));
          const unsyncedLocal = (get().sensorsByFarm[farmId] ?? []).filter(
            (s) => s.syncedToBackend === false && pendingIds.has(s.deviceId) && !remoteIds.has(s.deviceId)
          );
          const merged: FarmSensor[] = [
            ...remoteList.map((s) => ({ ...s, syncedToBackend: true })),
            ...unsyncedLocal,
          ];
          set((state) => ({
            sensorsByFarm: {
              ...state.sensorsByFarm,
              [farmId]: merged,
            },
          }));
          return merged;
        } catch {
          return get().sensorsByFarm[farmId] ?? [];
        }
      },

      syncIrrigationFromBackend: async (farmId, token) => {
        if (!hasOnlineToken(token)) return;
        const [valvesRes, schedulesRes, eventsRes] = await Promise.allSettled([
          valveApi.list(token),
          irrigationApi.schedules(token),
          irrigationApi.events(token),
        ]);

        set((state) => {
          const nextValvesByFarm = { ...state.valvesByFarm };
          if (valvesRes.status === "fulfilled" && Array.isArray(valvesRes.value)) {
            const existingValves = state.valvesByFarm[farmId] ?? [];
            const overrideByValve = new Map(
              existingValves.map((v) => [v.valveId, v.lastInterlockOverrideReason])
            );
            nextValvesByFarm[farmId] = valvesRes.value.map((v) => ({
              ...v,
              farmId,
              lastInterlockOverrideReason:
                v.state === "OPEN" ? overrideByValve.get(v.valveId) : undefined,
            }));
          }

          const nextSchedulesByFarm = { ...state.schedulesByFarm };
          if (schedulesRes.status === "fulfilled" && Array.isArray(schedulesRes.value)) {
            const pendingCreateIds = new Set(
              state.syncOutbox
                .filter((i) => i.kind === "SCHEDULE_CREATE")
                .map((i) => i.resourceId)
            );
            const remoteIds = new Set(schedulesRes.value.map((sch) => sch.scheduleId));
            const existingLocal = state.schedulesByFarm[farmId] ?? [];
            const deferredById = new Map(
              existingLocal
                .filter((sch) => sch.status === "DEFERRED_RAIN_HOLD")
                .map((sch) => [sch.scheduleId, sch])
            );
            const unsyncedLocal = existingLocal.filter(
              (sch) =>
                sch.syncedToBackend === false &&
                pendingCreateIds.has(sch.scheduleId) &&
                !remoteIds.has(sch.scheduleId)
            );
            nextSchedulesByFarm[farmId] = [
              ...schedulesRes.value.map((sch) => {
                const base = toFarmSchedule(sch, farmId);
                const deferred = deferredById.get(sch.scheduleId);
                return deferred && !sch.active
                  ? {
                      ...base,
                      status: "DEFERRED_RAIN_HOLD" as const,
                      deferredUntil: deferred.deferredUntil,
                      deferredSavedLitres: deferred.deferredSavedLitres,
                    }
                  : base;
              }),
              ...unsyncedLocal,
            ];
          }

          const nextEventsByFarm = { ...state.eventsByFarm };
          if (eventsRes.status === "fulfilled" && Array.isArray(eventsRes.value)) {
            const localOnlyEvents = (state.eventsByFarm[farmId] ?? []).filter(
              (e) =>
                e.eventType === "RAIN_HOLD_DEFER" ||
                e.eventType === "SHIFT_DISPATCH" ||
                e.eventType === "INTERLOCK_OVERRIDE"
            );
            const remoteEvents: FarmEvent[] = eventsRes.value.map((e) => ({
              ...e,
              farmId,
              syncedToBackend: true,
            }));
            const seenIds = new Set(remoteEvents.map((e) => e.id));
            nextEventsByFarm[farmId] = [
              ...localOnlyEvents.filter((e) => !seenIds.has(e.id)),
              ...remoteEvents,
            ].sort(
              (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          }

          return {
            valvesByFarm: nextValvesByFarm,
            schedulesByFarm: nextSchedulesByFarm,
            eventsByFarm: nextEventsByFarm,
          };
        });
      },

      flushOutbox: async (token) => {
        const queue = get().syncOutbox;
        if (!hasOnlineToken(token)) {
          return { flushed: 0, remaining: queue.length, skipped: true };
        }

        let flushed = 0;
        const remaining: SyncOutboxItem[] = [];

        for (const item of queue) {
          try {
            switch (item.kind) {
              case "PROPERTY_CREATE": {
                const created = await propertyApi.create(item.payload, token);
                const finalId = created?.id?.trim() ? created.id : item.farmId;
                set((s) => ({
                  properties: s.properties.map((p) =>
                    p.id === item.farmId
                      ? { ...mergeBackendProperty(created, p), id: finalId, syncedToBackend: true }
                      : p
                  ),
                  activePropertyId:
                    s.activePropertyId === item.farmId ? finalId : s.activePropertyId,
                }));
                break;
              }
              case "PROPERTY_UPDATE":
                await propertyApi.update(item.resourceId, item.payload, token);
                set((s) => ({
                  properties: s.properties.map((p) =>
                    p.id === item.farmId ? { ...p, syncedToBackend: true } : p
                  ),
                }));
                break;
              case "PROPERTY_DELETE":
                await propertyApi.remove(item.resourceId, token);
                break;
              case "SENSOR_REGISTER": {
                const sensorPayload = {
                  ...item.payload,
                  farmId: resolveApiFarmId(String(item.payload.farmId ?? item.farmId)),
                };
                await sensorApi.register(
                  sensorPayload as unknown as Parameters<typeof sensorApi.register>[0],
                  token
                );
                set((s) => ({
                  sensorsByFarm: {
                    ...s.sensorsByFarm,
                    [item.farmId]: (s.sensorsByFarm[item.farmId] ?? []).map((sen) =>
                      sen.deviceId === item.resourceId
                        ? { ...sen, syncedToBackend: true }
                        : sen
                    ),
                  },
                }));
                break;
              }
              case "SENSOR_DELETE":
                await sensorApi.remove(item.resourceId, token);
                break;
              case "VALVE_OPEN":
                await valveApi.open(
                  item.resourceId,
                  token,
                  Number(item.payload.durationMinutes ?? 15)
                );
                break;
              case "VALVE_CLOSE":
                await valveApi.close(item.resourceId, token);
                break;
              case "VALVE_EMERGENCY_STOP":
                await valveApi.emergencyStop(
                  token,
                  String(item.payload.reason ?? "Operator emergency stop")
                );
                break;
              case "SCHEDULE_CREATE": {
                const schPayload = {
                  ...(item.payload as unknown as CreateIrrigationSchedulePayload),
                  farmId: resolveApiFarmId(String(item.payload.farmId ?? item.farmId)),
                };
                const created = await irrigationApi.createSchedule(schPayload, token);
                if (created?.scheduleId) {
                  set((s) => ({
                    schedulesByFarm: {
                      ...s.schedulesByFarm,
                      [item.farmId]: (s.schedulesByFarm[item.farmId] ?? []).map((sch) =>
                        sch.scheduleId === item.resourceId
                          ? toFarmSchedule(created, item.farmId)
                          : sch
                      ),
                    },
                  }));
                }
                break;
              }
              case "SCHEDULE_TOGGLE":
                await irrigationApi.toggleSchedule(
                  item.resourceId,
                  Boolean(item.payload.active),
                  token
                );
                break;
              case "SCHEDULE_DELETE":
                await irrigationApi.deleteSchedule(item.resourceId, token);
                break;
              case "crop_diagnosis": {
                const mediaId = item.payload.mediaId ? String(item.payload.mediaId) : "";
                if (mediaId && typeof FormData !== "undefined") {
                  const blob = await getDefaultMediaStore().get(mediaId);
                  if (blob) {
                    const body = new FormData();
                    body.append("image", blob, String(item.payload.fileName ?? "leaf.jpg"));
                    if (item.payload.crop) body.append("crop", String(item.payload.crop));
                    if (item.payload.locale) body.append("locale", String(item.payload.locale));
                    const res = await fetch("/api/ai/diagnose", { method: "POST", body });
                    if (!res.ok) {
                      throw new Error(`Crop diagnosis sync failed (${res.status})`);
                    }
                  }
                }
                break;
              }
              case "pmfby_evidence":
              case "roznamcha_entry":
                // Local-first companion ledgers do not have a Java backend endpoint yet.
                break;
            }
            flushed += 1;
          } catch (err) {
            remaining.push({
              ...item,
              attempts: item.attempts + 1,
              lastError: errorMessage(err),
            });
          }
        }

        set({ syncOutbox: remaining });
        return { flushed, remaining: remaining.length, skipped: false };
      },

      seedSampleFarmIfEmpty: async () => {
        if (get().properties.length > 0) return null;
        return get().addProperty(
          {
            name: "Ludhiana Wheat & Paddy Farm",
            lat: 30.901,
            lon: 75.857,
            address: "Ludhiana, Punjab",
            areaHa: 2.5,
            waterSource: "borewell",
            irrigationType: "drip",
            soilType: "loam",
            cropIntent: "RECOMMEND_BEST",
            selectedCropId: "wheat",
            previousCrops: ["Rice", "Wheat"],
          },
          "offline-sample"
        );
      },
    }),
    {
      name: "agritech-farms-v1",
      storage: createJSONStorage(() => safeStateStorage),
      partialize: (state) => ({
        properties: state.properties,
        activePropertyId: state.activePropertyId,
        sensorsByFarm: state.sensorsByFarm,
        valvesByFarm: state.valvesByFarm,
        schedulesByFarm: state.schedulesByFarm,
        eventsByFarm: state.eventsByFarm,
        checklistByFarm: state.checklistByFarm,
        waterSavedLitres: state.waterSavedLitres,
        syncOutbox: state.syncOutbox,
        preferences: state.preferences,
        farmerMode: state.farmerMode,
        farmLocation: state.farmLocation,
      }),
      onRehydrateStorage: (preState) => (state) => {
        (state ?? preState)?.setHasHydrated(true);
      },
    }
  )
);

useAuthStore.subscribe((next, prev) => {
  const prevUser = prev.user;
  const nextUser = next.user;
  if (!prevUser) return;
  const accountChanged =
    !nextUser ||
    prevUser.email.toLowerCase() !== nextUser.email.toLowerCase() ||
    prevUser.farmId !== nextUser.farmId ||
    isOfflineToken(prevUser.token) !== isOfflineToken(nextUser.token);
  if (accountChanged) {
    useFarmStore.getState().clearSessionData();
  }
});
