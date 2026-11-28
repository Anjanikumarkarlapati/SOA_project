"use client";
import React, { useEffect, useState } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import { useAuthStore, isOfflineToken } from "@/lib/auth";
import { telemetryApi, type TelemetryReading } from "@/lib/api";
import {
  useFarmStore,
  getActiveProperty,
  computeSensorRecommendations,
  type FarmSensor,
} from "@/lib/property-store";
import { getCropById } from "@/lib/crops";
import { fetchClimate, computeClimateStats, type ClimateStats } from "@/lib/climate";
import { RootZoneSoilCard } from "@/components/RootZoneSoilCard";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { EditorialPhotoFrame } from "@/components/ui/EditorialPhotoFrame";
import { toast } from "@/components/ui/Toaster";
import { Banner } from "@astryxdesign/core/Banner";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  Activity,
  ArrowRight,
  Battery,
  MapPin,
  Wifi,
  WifiOff,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  ONLINE:  "var(--status-good)",
  ACTIVE:  "var(--status-good)",
  LOW_BATTERY: "var(--status-warning)",
  OFFLINE: "var(--status-critical)",
  IDLE:    "var(--status-warning)",
};

export default function SensorsPage() {
  const token = useAuthStore((s) => s.user?.token ?? "");
  const userRole = useAuthStore((s) => s.user?.role ?? "FARMER");
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const sensorsByFarm = useFarmStore((s) => s.sensorsByFarm);
  const addSensor = useFarmStore((s) => s.addSensor);
  const removeSensor = useFarmStore((s) => s.removeSensor);
  const syncSensorsFromBackend = useFarmStore((s) => s.syncSensorsFromBackend);

  const activeFarm = getActiveProperty({ properties, activePropertyId });
  const activeFarmId = activeFarm?.id ?? "farm-ludhiana-1";
  const activeCrop = getCropById(activeFarm?.selectedCropId || "wheat");
  const isReadOnlyFarmer = Boolean(token && !isOfflineToken(token) && userRole !== "ADMIN");

  const [climateStats, setClimateStats] = useState<ClimateStats | null>(null);
  const [liveReading, setLiveReading] = useState<TelemetryReading | null>(null);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add Sensor Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deviceId, setDeviceId] = useState("");
  const [sensorType, setSensorType] = useState("SOIL_MOISTURE");
  const [fieldId, setFieldId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const lat = activeFarm?.lat ?? 30.901;
  const lon = activeFarm?.lon ?? 75.857;

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      if (token && !isOfflineToken(token)) {
        try {
          const synced = await syncSensorsFromBackend(activeFarmId, token);
          const firstReporting = synced.find(
            (s) => s.health === "ONLINE" || s.status === "ACTIVE" || s.status === "ONLINE"
          );
          if (firstReporting) {
            try {
              const latest = await telemetryApi.latest(firstReporting.deviceId, token);
              if (!cancelled && latest) {
                setLiveReading(latest);
                setSelectedSensorId(firstReporting.deviceId);
              }
            } catch {
              /* sensor has no telemetry yet */
            }
          }
        } catch {
          /* offline fallback uses useFarmStore */
        }
      }

      try {
        const d = await fetchClimate(lat, lon);
        if (!cancelled) {
          setClimateStats(computeClimateStats(d));
        }
      } catch {
        /* ignore climate error */
      }
    }

    void fetchAll();
    return () => {
      cancelled = true;
    };
  }, [token, activeFarmId, lat, lon, syncSensorsFromBackend]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setActionError(null);
    try {
      if (token && !isOfflineToken(token)) {
        const synced = await syncSensorsFromBackend(activeFarmId, token);
        const targetId = selectedSensorId ?? synced[0]?.deviceId;
        if (targetId) {
          try {
            const latest = await telemetryApi.latest(targetId, token);
            setLiveReading(latest);
            setSelectedSensorId(targetId);
          } catch {
            /* ignore if sensor has no readings */
          }
        }
      }
    } catch {
      /* offline */
    } finally {
      setRefreshing(false);
    }
  };

  const handleInspectTelemetry = async (targetDeviceId: string) => {
    if (!token || isOfflineToken(token)) return;
    setActionError(null);
    try {
      const latest = await telemetryApi.latest(targetDeviceId, token);
      setLiveReading(latest);
      setSelectedSensorId(targetDeviceId);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `No telemetry found for ${targetDeviceId}`
      );
    }
  };

  const mergedSensors: FarmSensor[] = sensorsByFarm[activeFarmId] ?? [];

  const totalCount = mergedSensors.length;
  const onlineCount = mergedSensors.filter(
    (s) => s.health === "ONLINE" || (s.health !== "OFFLINE" && (s.status === "ONLINE" || s.status === "ACTIVE"))
  ).length;
  const offlineCount = Math.max(0, totalCount - onlineCount);
  const lowBatteryCount = mergedSensors.filter(
    (s) => s.health === "LOW_BATTERY" || (s.batteryPercent ?? 100) < 30
  ).length;

  const statCards = [
    { label: "Total", value: totalCount, color: "var(--text-primary)" },
    { label: "Online", value: onlineCount, color: "var(--status-good)" },
    { label: "Offline", value: offlineCount, color: "var(--status-critical)" },
    { label: "Low battery", value: lowBatteryCount, color: "var(--status-warning)" },
  ];

  const recommendedBlueprint =
    activeFarm?.sensorRecs && activeFarm.sensorRecs.length > 0
      ? activeFarm.sensorRecs
      : computeSensorRecommendations(
          activeFarm?.areaHa ?? 2.5,
          activeFarm?.waterSource ?? "borewell",
          activeFarm?.cropIntent ?? "GROW_NOW"
        );

  const handleOpenDialog = () => {
    setDeviceId("");
    setFieldId("");
    setSensorType("SOIL_MOISTURE");
    setFormError(null);
    setDialogOpen(true);
  };

  useEffect(() => {
    if (!dialogOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dialogOpen]);

  const handleSaveSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      setFormError("Device ID is required.");
      return;
    }
    setLoading(true);
    setFormError(null);
    setActionError(null);
    try {
      await addSensor(
        activeFarmId,
        {
          deviceId: deviceId.trim(),
          sensorType,
          fieldId: fieldId.trim() || activeFarm?.fieldId || "CROP-FIELD-01",
          status: "ONLINE",
          health: "ONLINE",
          batteryPercent: 100,
          latitude: lat,
          longitude: lon,
        },
        token
      );
      toast("Sensor registered", "success");
      setDialogOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to register sensor"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDeploy = async (recType: string, idx: number) => {
    const cleanType = recType.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
    const generatedId = `SM-${cleanType.slice(0, 6)}-0${idx + 1}`;
    setActionError(null);
    try {
      await addSensor(
        activeFarmId,
        {
          deviceId: generatedId,
          sensorType: recType,
          fieldId: activeFarm?.fieldId || `Zone-${idx + 1}`,
          status: "ONLINE",
          health: "ONLINE",
          batteryPercent: 98,
          latitude: Number((lat + idx * 0.0004).toFixed(6)),
          longitude: Number((lon + idx * 0.0004).toFixed(6)),
        },
        token
      );
      toast("Recommended sensor deployed", "success");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to quick-register sensor"
      );
    }
  };

  const handleRemoveSensor = async (targetDeviceId: string) => {
    setActionError(null);
    try {
      await removeSensor(activeFarmId, targetDeviceId, token);
      toast("Sensor removed", "info");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to deregister sensor"
      );
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <Heading level={1} weight="normal" textWrap="balance" className="type-page-title">
            Sensors &amp; Root-Zone Telemetry
          </Heading>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Live status of registered field sensors for{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {activeFarm?.name ?? "Ludhiana Wheat Parcel"}
            </strong>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            label="Refresh"
            variant="secondary"
            size="sm"
            loading={refreshing}
            disabled={refreshing}
            icon={!refreshing ? <RefreshCw className="w-4 h-4" /> : undefined}
            onClick={() => void handleRefresh()}
          />
          <Button
            label="Add sensor"
            variant="primary"
            size="sm"
            elevation="low"
            disabled={isReadOnlyFarmer}
            tooltip={isReadOnlyFarmer ? "Requires Field Organizer (ADMIN) account" : undefined}
            icon={<Plus className="w-4 h-4" />}
            onClick={handleOpenDialog}
          />
        </div>
      </div>

      {/* Summary stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map(({ label, value, color }) => (
          <BezelCard
            key={label}
            innerClassName="p-4"
          >
            <div className="text-xs mb-1" style={{ color: "var(--text-secondary)" }}>
              {label}
            </div>
            <div className="type-kpi !text-2xl" style={{ color }}>
              {value}
            </div>
          </BezelCard>
        ))}
      </div>

      {actionError && (
        <Banner
          status="error"
          role="alert"
          title={actionError}
          isDismissable
          onDismiss={() => setActionError(null)}
        />
      )}

      {token && !isOfflineToken(token) && userRole !== "ADMIN" && (
        <Banner
          status="info"
          title="Farmer view: live telemetry active (adding or removing field probes requires a Field Organizer account)."
        />
      )}

      {liveReading && (
        <BezelCard data-testid="live-sensor-telemetry" innerClassName="p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="type-eyebrow !text-[var(--text-secondary)]">
              LIVE FIELD SENSOR TELEMETRY · {selectedSensorId ?? liveReading.deviceId}
            </span>
            <div className="mt-1 flex flex-wrap gap-4 font-mono text-xs tabular-nums text-[var(--text-primary)]">
              <span>Moisture: <strong>{liveReading.soilMoisture.toFixed(1)}%</strong></span>
              <span>Soil Temp: <strong>{liveReading.soilTemperature.toFixed(1)}°C</strong></span>
              <span>pH: <strong>{liveReading.ph.toFixed(2)}</strong></span>
              <span>Battery: <strong>{liveReading.batteryPercent !== null ? `${liveReading.batteryPercent.toFixed(0)}%` : "—"}</strong></span>
            </div>
          </div>
          <span className="font-mono text-[11px] text-[var(--text-secondary)]">
            {new Date(liveReading.timestamp).toLocaleTimeString()}
          </span>
        </BezelCard>
      )}

      {/* Hardware Probe Placement Guide (Zero-Human soil-sensing.jpg) */}
      <BezelCard
        data-testid="probe-placement-guide"
        innerClassName="p-5 grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-center"
      >
        <div className="min-w-0">
          <EditorialPhotoFrame
            innerClassName="h-48 sm:h-52 w-full"
            caption={
              <span className="rounded-full border border-white/25 bg-black/65 px-2.5 py-0.5 font-mono text-[11px] tabular-nums text-[#DFECC6] backdrop-blur-sm">
                15 / 30 / 60 cm horizons
              </span>
            }
          >
            <img
              src="/images/soil-sensing.jpg"
              alt="In-situ dielectric capacitance probe placed in active root-zone horizon"
              className="h-full w-full object-cover photo-duotone"
            />
          </EditorialPhotoFrame>
        </div>
        <div className="min-w-0 space-y-2 text-xs">
          <span className="text-[12px] font-medium text-[var(--accent)]">
            FAO-56 calibration protocol
          </span>
          <Heading level={2} weight="normal" className="type-section-title !text-xl">
            Multi-Depth Dielectric Probe Placement Guide
          </Heading>
          <p className="text-[var(--text-secondary)] leading-relaxed">
            Insert the primary volumetric moisture waveguide at <strong>15 cm</strong> (germination &amp; feeder root zone) and the secondary tensiometer at <strong>30–60 cm</strong> (deep root extraction zone), 12 cm laterally from the active drip emitter to prevent channeling artifacts.
          </p>
        </div>
      </BezelCard>

      {/* Mounted RootZoneSoilCard */}
      <RootZoneSoilCard
        crop={activeCrop}
        soilMoisturePct={Math.round(liveReading?.soilMoisture ?? climateStats?.currentSoilMoisturePct ?? 62)}
        soilTempC={Number((liveReading?.soilTemperature ?? climateStats?.currentSoilTempC ?? 22.4).toFixed(1))}
      />

      {/* Registered Sensors Grid */}
      {mergedSensors.length === 0 ? (
        <div
          className="rounded-xl border-2 border-dashed p-10 text-center"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
        >
          <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--border-strong)" }} />
          <Heading level={3} weight="semibold" className="type-card-title mb-1">
            No sensors registered
          </Heading>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Use the Add sensor button above or deploy one of the recommended FAO field probes below.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mergedSensors.map((s) => {
            const isOnline =
              s.health === "ONLINE" ||
              (s.health !== "OFFLINE" && (s.status === "ONLINE" || s.status === "ACTIVE"));
            const badgeColor = STATUS_COLOR[s.health || s.status] ?? "var(--status-good)";
            return (
              <div
                key={s.deviceId}
                className="rounded-xl border p-4 flex flex-col justify-between gap-3"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                        {s.deviceId}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {s.sensorType}
                      </div>
                    </div>
                    <span
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        background: "var(--bg-raised)",
                        color: badgeColor,
                      }}
                    >
                      {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                      {s.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>
                        Field {s.fieldId}
                        {s.location &&
                          ` · ${s.location.latitude.toFixed(4)}, ${s.location.longitude.toFixed(4)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Battery className="w-3 h-3 shrink-0" />
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--border-default)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, Math.round(s.batteryPercent ?? 100)))}%`,
                            background:
                              (s.batteryPercent ?? 100) > 30
                                ? "var(--status-good)"
                                : "var(--status-critical)",
                          }}
                        />
                      </div>
                      <span className="font-mono tabular-nums">{Math.round(s.batteryPercent ?? 100)}%</span>
                    </div>
                  </div>
                </div>

                <div
                  className="flex items-center justify-between pt-2 border-t text-xs"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <span>
                    Health:{" "}
                    <strong style={{ color: badgeColor }}>
                      {s.health || "ONLINE"}
                    </strong>
                  </span>
                  <div className="flex items-center gap-2">
                    {token && !isOfflineToken(token) && (
                      <Button
                        label="Telemetry"
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleInspectTelemetry(s.deviceId)}
                      />
                    )}
                    <Button
                      label="Remove"
                      variant="destructive"
                      size="sm"
                      disabled={isReadOnlyFarmer}
                      aria-label={`Remove sensor ${s.deviceId}`}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => void handleRemoveSensor(s.deviceId)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended Sensor Blueprint with 1-Click Deploy */}
      <section
        className="rounded-xl border p-5 space-y-3"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
          <Heading level={2} weight="semibold" className="type-card-title !text-lg">
            Recommended FAO Sensor Blueprint for {activeFarm?.name ?? "Active Farm"}
          </Heading>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {recommendedBlueprint.slice(0, 3).map((rec, idx) => (
            <div
              key={idx}
              className="rounded-lg border p-3.5 flex flex-col justify-between gap-3"
              style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
            >
              <div>
                <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  {rec.type} ×{rec.quantity}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  {rec.placement}
                </div>
              </div>
              <Button
                label={`+ Quick Register ${rec.type}`}
                variant="secondary"
                size="sm"
                disabled={isReadOnlyFarmer}
                className="self-start"
                onClick={() => void handleQuickDeploy(rec.type, idx)}
              />
            </div>
          ))}
        </div>
      </section>

      <div
        className="flex items-center justify-between gap-3 pt-2 border-t flex-wrap"
        style={{ borderColor: "var(--border-default)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Next workflow step: check 14-day rainfall, heat stress, and evapotranspiration for this farm.
        </span>
        <Button
          label="Next: Climate Forecast"
          href="/climate"
          variant="primary"
          size="sm"
          endContent={<ArrowRight className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Add Sensor Modal Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-sensor-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center justify-between">
              <Heading
                level={2}
                id="add-sensor-title"
                weight="semibold"
                className="type-card-title !text-xl"
              >
                Register Field Sensor
              </Heading>
              <IconButton
                label="Close modal"
                icon={<X className="w-5 h-5" />}
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
              />
            </div>

            {formError && (
              <div
                className="text-xs px-3 py-2 rounded-lg border"
                role="alert"
                style={{
                  background: "rgba(179,38,30,0.08)",
                  borderColor: "rgba(179,38,30,0.3)",
                  color: "var(--status-critical)",
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={(e) => void handleSaveSensor(e)} className="space-y-4">
              <div>
                <label
                  htmlFor="sensor-device-id"
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Device ID *
                </label>
                <input
                  id="sensor-device-id"
                  type="text"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="SM-NORTH-09"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{
                    background: "var(--bg-raised)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="sensor-type-select"
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Sensor Type
                </label>
                <select
                  id="sensor-type-select"
                  value={sensorType}
                  onChange={(e) => setSensorType(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{
                    background: "var(--bg-raised)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                >
                  <option value="SOIL_MOISTURE">Soil Moisture Probe</option>
                  <option value="SOIL_TEMP">Soil Temperature Probe</option>
                  <option value="WEATHER">Micro Weather Station</option>
                  <option value="PH_EC">Soil EC / pH Probe</option>
                  <option value="FLOW_METER">Water Flow Meter</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="sensor-field-zone"
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Field / Zone
                </label>
                <input
                  id="sensor-field-zone"
                  type="text"
                  value={fieldId}
                  onChange={(e) => setFieldId(e.target.value)}
                  placeholder="North Furrow"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{
                    background: "var(--bg-raised)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  label="Cancel"
                  variant="secondary"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                />
                <Button
                  label="Save sensor"
                  type="submit"
                  variant="primary"
                  size="sm"
                  elevation="low"
                  loading={loading}
                  disabled={loading}
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
