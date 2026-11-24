"use client";
import React, { useEffect, useState } from "react";
import { isOfflineToken, useAuthStore } from "@/lib/auth";
import {
  useFarmStore,
  getActiveProperty,
  type FarmValve,
  type FarmSchedule,
} from "@/lib/property-store";
import { fetchClimate, computeClimateStats, type ClimateStats } from "@/lib/climate";
import { getCropById } from "@/lib/crops";
import { computeWaterBudget, evaluateValveInterlock } from "@/lib/fieldshield";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  Droplets,
  Calendar,
  Clock,
  AlertTriangle,
  Plus,
  Power,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  X,
  Trash2,
} from "lucide-react";

const OVERRIDE_REASONS = [
  "Fertigation Flush",
  "Transplant Establishment",
  "Localized Dry Pocket",
  "Manual Check",
] as const;

export default function IrrigationPage() {
  const token = useAuthStore((s) => s.user?.token ?? "");
  const userRole = useAuthStore((s) => s.user?.role ?? "FARMER");
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const valvesByFarm = useFarmStore((s) => s.valvesByFarm);
  const schedulesByFarm = useFarmStore((s) => s.schedulesByFarm);
  const eventsByFarm = useFarmStore((s) => s.eventsByFarm);
  const waterSavedLitres = useFarmStore((s) => s.waterSavedLitres);
  const preferences = useFarmStore((s) => s.preferences);

  const openValveWithAudit = useFarmStore((s) => s.openValveWithAudit);
  const closeValve = useFarmStore((s) => s.closeValve);
  const emergencyStopValves = useFarmStore((s) => s.emergencyStopValves);
  const createSchedule = useFarmStore((s) => s.createSchedule);
  const toggleSchedule = useFarmStore((s) => s.toggleSchedule);
  const deleteSchedule = useFarmStore((s) => s.deleteSchedule);
  const deferScheduleRainHold = useFarmStore((s) => s.deferScheduleRainHold);
  const syncIrrigationFromBackend = useFarmStore((s) => s.syncIrrigationFromBackend);

  const activeFarm = getActiveProperty({ properties, activePropertyId });
  const farmId = activeFarm?.id ?? "farm-ludhiana-1";
  const activeCrop = getCropById(activeFarm?.selectedCropId || "wheat");

  const [stats, setStats] = useState<ClimateStats | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Interlock Modal State
  const [interlockValveId, setInterlockValveId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState<string>(OVERRIDE_REASONS[0]);

  // New Schedule Modal State
  const [schedModalOpen, setSchedModalOpen] = useState(false);
  const [selectedValveId, setSelectedValveId] = useState("");
  const [zoneName, setZoneName] = useState("");
  const [startTime, setStartTime] = useState("06:00");
  const [durationMinutes, setDurationMinutes] = useState("25");

  const lat = activeFarm?.lat ?? 30.901;
  const lon = activeFarm?.lon ?? 75.857;

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (token && !isOfflineToken(token)) {
        try {
          await syncIrrigationFromBackend(farmId, token);
        } catch {
          /* fallback to local store */
        }
      }
      try {
        const d = await fetchClimate(lat, lon);
        if (!cancelled) {
          setStats(computeClimateStats(d));
        }
      } catch {
        /* ignore offline weather */
      }
    }
    void loadData();
    return () => {
      cancelled = true;
    };
  }, [lat, lon, token, farmId, syncIrrigationFromBackend]);

  const handleSyncRefresh = async () => {
    if (!token || isOfflineToken(token)) return;
    setSyncing(true);
    setActionError(null);
    try {
      await syncIrrigationFromBackend(farmId, token);
    } finally {
      setSyncing(false);
    }
  };

  const storedValves = valvesByFarm[farmId] ?? [];
  const defaultValve: FarmValve = {
    valveId: "VALVE-MAIN-01",
    farmId,
    cropId: activeCrop.id,
    zoneName: "North Furrow Main Valve",
    state: "CLOSED",
    flowRateLpm: 0,
    ratedFlowLpm: preferences.pumpFlowLpm,
    lastChangedAt: "2026-11-10T06:00:00.000Z",
    openUntil: null,
    secondsRemaining: null,
    runningScheduleId: null,
  };
  const valves: FarmValve[] = storedValves.length > 0 ? storedValves : [defaultValve];

  const storedSchedules = schedulesByFarm[farmId] ?? [];
  const defaultSchedule: FarmSchedule = {
    scheduleId: "SCH-MAIN-01",
    farmId,
    cropId: activeCrop.id,
    valveId: valves[0].valveId,
    zoneName: "Main Zone Morning Cycle",
    recurrence: "DAILY",
    daysOfWeek: [],
    startTime: "06:00",
    durationMinutes: 25,
    active: true,
    skipIfMoist: true,
    lastRunAt: null,
    status: "ACTIVE",
  };
  const schedules: FarmSchedule[] =
    storedSchedules.length > 0 ? storedSchedules : [defaultSchedule];

  const events = eventsByFarm[farmId] ?? [];

  const waterBudget = computeWaterBudget({
    areaHa: activeFarm?.areaHa ?? 2.5,
    todayEt0: stats?.todayEt0 ?? 4.5,
    todayRainMm: stats?.todayRainMm ?? 0,
    kc: activeCrop.kc[1] ?? 1.15,
    irrigationType: activeFarm?.irrigationType || "drip",
    pumpFlowLpm: preferences.pumpFlowLpm,
  });

  const interlock = evaluateValveInterlock({
    rainProbMax: stats?.rainProbMax ?? 10,
    todayRainMm: stats?.todayRainMm ?? 0,
    currentWindKmh: stats?.currentWindKmh ?? 8,
    soilMoisturePct: stats?.currentSoilMoisturePct ?? 58,
    optimalMoistureRange: activeCrop.optimalSoilMoisture,
    waterBudgetLitres:
      waterBudget.netDeliveryLitres > 0
        ? waterBudget.netDeliveryLitres
        : Math.max(2500, waterBudget.grossLitres),
  });

  const handleValveAction = async (valve: FarmValve) => {
    setActionError(null);
    if (valve.state === "OPEN") {
      try {
        await closeValve(farmId, valve.valveId, token);
        if (token && !isOfflineToken(token)) await syncIrrigationFromBackend(farmId, token);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to close valve");
      }
      return;
    }

    if (interlock.triggered) {
      setOverrideReason(OVERRIDE_REASONS[0]);
      setInterlockValveId(valve.valveId);
      return;
    }

    try {
      await openValveWithAudit(
        farmId,
        valve.valveId,
        waterBudget.recommendedMinutes || 20,
        undefined,
        token
      );
      if (token && !isOfflineToken(token)) await syncIrrigationFromBackend(farmId, token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to open valve");
    }
  };

  const handleDeferRainHold = () => {
    const targetScheduleId = schedules[0]?.scheduleId ?? "SCH-MAIN-01";
    const bankedLitres = Math.max(
      2500,
      waterBudget.netDeliveryLitres || waterBudget.grossLitres || 5000
    );
    deferScheduleRainHold(
      farmId,
      targetScheduleId,
      bankedLitres,
      interlock.reasons.join("; ") || "FieldShield Rain-Hold Interlock"
    );
    setInterlockValveId(null);
  };

  const handleOverrideAndStart = async () => {
    if (!interlockValveId) return;
    setActionError(null);
    try {
      await openValveWithAudit(
        farmId,
        interlockValveId,
        waterBudget.recommendedMinutes || 20,
        overrideReason,
        token
      );
      if (token && !isOfflineToken(token)) await syncIrrigationFromBackend(farmId, token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to override and open valve");
    } finally {
      setInterlockValveId(null);
    }
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    const chosenValve =
      valves.find((v) => v.valveId === selectedValveId) ?? valves[0];
    try {
      await createSchedule(
        farmId,
        {
          valveId: chosenValve.valveId,
          cropId: chosenValve.cropId,
          zoneName: zoneName.trim() || chosenValve.zoneName || "Main Zone",
          startTime: startTime || "06:00",
          durationMinutes: parseInt(durationMinutes, 10) || 25,
        },
        token
      );
      if (token && !isOfflineToken(token)) await syncIrrigationFromBackend(farmId, token);
      setZoneName("");
      setSchedModalOpen(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create schedule");
    }
  };

  const handleEmergencyStop = async () => {
    setActionError(null);
    try {
      await emergencyStopValves(farmId, "Operator manual stop", token);
      if (token && !isOfflineToken(token)) await syncIrrigationFromBackend(farmId, token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Emergency stop failed");
    }
  };

  const handleToggleSchedule = async (scheduleId: string) => {
    setActionError(null);
    try {
      await toggleSchedule(farmId, scheduleId, token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to toggle schedule");
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    setActionError(null);
    try {
      await deleteSchedule(farmId, scheduleId, token);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete schedule");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
          >
            Irrigation &amp; Valve Control
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Closed-loop FAO-56 ET₀ water budget, Rain-Hold safety interlock, and schedules for{" "}
            <strong style={{ color: "var(--text-primary)" }}>
              {activeFarm?.name ?? "Ludhiana Wheat Parcel"}
            </strong>
            .
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="text-xs font-semibold px-3 py-2 rounded-lg border"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--border-default)",
              color: "var(--status-good)",
            }}
          >
            Water Saved Ledger: {waterSavedLitres.toLocaleString("en-US")} L
          </div>

          {token && !isOfflineToken(token) && (
            <Button
              label="Sync"
              variant="secondary"
              size="sm"
              loading={syncing}
              disabled={syncing}
              icon={!syncing ? <RefreshCw className="w-3.5 h-3.5" /> : undefined}
              onClick={() => void handleSyncRefresh()}
            />
          )}

          <Button
            label="Emergency Stop All"
            variant="destructive"
            size="sm"
            onClick={() => void handleEmergencyStop()}
          />

          <Button
            label="New Schedule"
            variant="primary"
            size="sm"
            elevation="low"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setSelectedValveId(valves[0]?.valveId ?? "");
              setSchedModalOpen(true);
            }}
          />
        </div>
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
          title="Farmer view: Emergency Stop is active; individual valve actuation and schedule writes require a Field Organizer account."
        />
      )}

      {/* Hydraulic Manifold Schematic & Human-Free Irrigation Strip */}
      <BezelCard
        data-testid="irrigation-flow-schematic"
        innerClassName="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center"
      >
        <div className="lg:col-span-5">
          <div className="photo-frame relative h-44 w-full overflow-hidden rounded-xl">
            <img
              src="/images/irrigation-drip.webp"
              alt="Precision drip irrigation manifold and root-zone moisture distribution"
              className="h-full w-full object-cover photo-duotone"
            />
            <div className="absolute inset-x-2.5 bottom-2 flex items-center justify-between rounded-lg border border-white/20 bg-black/75 px-2.5 py-1 font-mono text-[10px] text-white">
              <span>MANIFOLD PRESSURE: 2.1 BAR</span>
              <span className="text-[#DFECC6] tabular-nums">{preferences.pumpFlowLpm} L/MIN</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                CLOSED-LOOP HYDRAULIC TELEMETRY
              </span>
              <h2 className="text-lg font-serif-display text-[var(--text-primary)]">
                Borewell Header → Solenoid Manifold → Drip Laterals
              </h2>
            </div>
            <span className="rounded-full border border-[var(--border-default)] bg-[var(--bg-raised)] px-3 py-1 font-mono text-[11px] tabular-nums text-[var(--text-primary)]">
              {valves.some((v) => v.state === "OPEN") ? "FLOW ACTIVE" : "STANDBY LOCK"}
            </span>
          </div>

          <svg
            viewBox="0 0 540 110"
            className="w-full h-24 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-2"
            role="img"
            aria-label="Irrigation pipe and solenoid valve schematic"
          >
            {/* Main Supply Pipe */}
            <path
              d="M 30 55 L 220 55 L 340 55 L 500 55"
              stroke="var(--border-strong)"
              strokeWidth="8"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 30 55 L 220 55 L 340 55 L 500 55"
              stroke="var(--status-info)"
              strokeWidth="3.5"
              strokeDasharray="10 8"
              strokeLinecap="round"
              fill="none"
            />
            {/* Pump Node */}
            <circle cx="55" cy="55" r="18" fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth="2.5" />
            <text x="55" y="59" textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontFamily="monospace">
              PUMP
            </text>
            {/* Solenoid Valve Node */}
            <rect
              x="235"
              y="35"
              width="70"
              height="40"
              rx="10"
              fill={valves.some((v) => v.state === "OPEN") ? "var(--accent)" : "var(--bg-surface)"}
              stroke="var(--accent)"
              strokeWidth="2.5"
            />
            <text
              x="270"
              y="59"
              textAnchor="middle"
              fontSize="10"
              fill={valves.some((v) => v.state === "OPEN") ? "var(--on-accent)" : "var(--text-primary)"}
              fontFamily="monospace"
            >
              {valves[0]?.state ?? "CLOSED"}
            </text>
            {/* Drip Emitters Node */}
            <circle cx="475" cy="55" r="18" fill="var(--bg-surface)" stroke="var(--status-info)" strokeWidth="2.5" />
            <text x="475" y="59" textAnchor="middle" fontSize="10" fill="var(--text-primary)" fontFamily="monospace">
              DRIP
            </text>
          </svg>
        </div>
      </BezelCard>

      {/* FAO-56 ET0 Water Budget Calculator Card */}
      <section
        className="rounded-xl border p-5 space-y-4"
        style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2
              className="text-base font-semibold"
              style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
            >
              FAO-56 ET₀ Daily Water Budget Calculator
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Crop: {activeCrop.name} (Kc = {activeCrop.kc[1]}) · System:{" "}
              {activeFarm?.irrigationType || "drip"} ({Math.round(waterBudget.efficiency * 100)}%
              efficiency) · Area: {(activeFarm?.areaHa ?? 2.5).toFixed(1)} ha
            </p>
          </div>
          {interlock.triggered ? (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
              style={{
                background: "rgba(143,90,8,0.12)",
                color: "var(--status-warning)",
              }}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Interlock Active ({interlock.severity.toUpperCase()})
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
              style={{
                background: "rgba(84,83,51,0.12)",
                color: "var(--status-good)",
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Clear to Irrigate
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            className="rounded-lg p-3.5 border"
            style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
          >
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Crop ETc Demand
            </div>
            <div className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {waterBudget.etcMm} mm
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Gross: {waterBudget.grossLitres.toLocaleString("en-US")} Litres
            </div>
          </div>

          <div
            className="rounded-lg p-3.5 border"
            style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
          >
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Effective Rain Credit
            </div>
            <div className="text-lg font-bold mt-0.5" style={{ color: "var(--status-info)" }}>
              {waterBudget.effectiveRainCreditLitres.toLocaleString("en-US")} Litres
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Rain today: {(stats?.todayRainMm ?? 0).toFixed(1)} mm
            </div>
          </div>

          <div
            className="rounded-lg p-3.5 border"
            style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
          >
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Net Delivery Target
            </div>
            <div className="text-lg font-bold mt-0.5" style={{ color: "var(--accent)" }}>
              {waterBudget.netDeliveryLitres.toLocaleString("en-US")} Litres
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Adjusted for {activeFarm?.irrigationType || "drip"} efficiency
            </div>
          </div>

          <div
            className="rounded-lg p-3.5 border"
            style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
          >
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Recommended Runtime
            </div>
            <div className="text-lg font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>
              {waterBudget.recommendedMinutes} min
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              At {preferences.pumpFlowLpm} L/min pump flow
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Valves & Schedules Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Valves */}
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <Power className="w-4 h-4" style={{ color: "var(--accent)" }} />
            Solenoid Valves
          </h2>

          <div className="space-y-3">
            {valves.map((v) => {
              const isOpen = v.state === "OPEN";
              return (
                <div
                  key={v.valveId}
                  className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
                >
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {v.zoneName} ({v.valveId})
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      State: <strong>{v.state}</strong> · Flow: {v.flowRateLpm} / {v.ratedFlowLpm}{" "}
                      L/min
                    </div>
                    {v.lastInterlockOverrideReason && (
                      <div
                        className="text-xs mt-1 font-medium"
                        style={{ color: "var(--status-warning)" }}
                      >
                        Override active: {v.lastInterlockOverrideReason}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      label={isOpen ? "Close Valve" : "Open Valve"}
                      variant={isOpen ? "secondary" : "primary"}
                      size="sm"
                      elevation={isOpen ? "none" : "low"}
                      onClick={() => void handleValveAction(v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Schedules */}
        <section className="space-y-3">
          <h2
            className="text-sm font-semibold flex items-center gap-2"
            style={{ color: "var(--text-primary)" }}
          >
            <Calendar className="w-4 h-4" style={{ color: "var(--status-info)" }} />
            Schedules
          </h2>

          <div className="space-y-3">
            {schedules.map((s) => (
              <div
                key={s.scheduleId}
                className="rounded-xl border p-4 flex items-center justify-between gap-3 flex-wrap"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
              >
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {s.zoneName}
                  </div>
                  <div
                    className="flex items-center gap-3 mt-1 text-xs"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {s.startTime}
                    </span>
                    <span>{s.durationMinutes} min</span>
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                      style={{
                        background: "var(--bg-raised)",
                        color:
                          s.status === "DEFERRED_RAIN_HOLD"
                            ? "var(--status-warning)"
                            : s.status === "ACTIVE"
                              ? "var(--accent)"
                              : "var(--text-secondary)",
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    label={s.active ? "Pause" : "Resume"}
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleToggleSchedule(s.scheduleId)}
                  />
                  {storedSchedules.some((item) => item.scheduleId === s.scheduleId) && (
                    <IconButton
                      label={`Delete schedule ${s.zoneName}`}
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDeleteSchedule(s.scheduleId)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Recent Irrigation & Interlock Events Ledger */}
      <section className="space-y-3">
        <h2
          className="text-sm font-semibold flex items-center gap-2"
          style={{ color: "var(--text-primary)" }}
        >
          <Droplets className="w-4 h-4" style={{ color: "var(--status-info)" }} />
          Field Irrigation &amp; Interlock Event Ledger
        </h2>

        {events.length === 0 ? (
          <div
            className="rounded-xl border-2 border-dashed p-6 text-center text-sm"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            No watering or interlock events logged in this session yet.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((e) => (
              <div
                key={e.id}
                className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3 flex-wrap text-sm"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
              >
                <div>
                  <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                    {e.message}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {e.eventType ?? "EVENT"} · {new Date(e.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                {e.savedLitres ? (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: "var(--bg-raised)", color: "var(--status-good)" }}
                  >
                    +{e.savedLitres.toLocaleString("en-US")} L Saved
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <div
        className="flex items-center justify-between gap-3 pt-2 border-t flex-wrap"
        style={{ borderColor: "var(--border-default)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Workflow complete: monitor daily shift briefs and zone telemetry back on Field Hub.
        </span>
        <Button
          label="Return to Field Hub"
          href="/dashboard"
          variant="secondary"
          size="sm"
        />
      </div>

      {/* Rain-Hold & Soil-Saturation Interlock Dialog */}
      {interlockValveId && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="interlock-dialog-title"
        >
          <div
            className="w-full max-w-lg rounded-2xl border p-6 space-y-4"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" style={{ color: "var(--status-warning)" }} />
                <h2
                  id="interlock-dialog-title"
                  className="text-lg font-semibold"
                  style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
                >
                  FieldShield Rain-Hold &amp; Soil-Saturation Interlock
                </h2>
              </div>
              <IconButton
                label="Close interlock dialog"
                icon={<X className="w-5 h-5" />}
                variant="ghost"
                size="sm"
                onClick={() => setInterlockValveId(null)}
              />
            </div>

            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Opening valve <strong>{interlockValveId}</strong> now risks root-zone waterlogging and
              nutrient leaching:
            </p>

            <ul className="space-y-1.5 text-xs">
              {interlock.reasons.map((r, idx) => (
                <li
                  key={idx}
                  className="px-3 py-2 rounded-lg border"
                  style={{
                    background: "rgba(143,90,8,0.08)",
                    borderColor: "rgba(143,90,8,0.25)",
                    color: "var(--status-warning)",
                  }}
                >
                  • {r}
                </li>
              ))}
            </ul>

            <div>
              <div className="text-xs font-medium mb-2" style={{ color: "var(--text-primary)" }}>
                If overriding, select operator audit reason:
              </div>
              <div className="flex flex-wrap gap-2">
                {OVERRIDE_REASONS.map((reason) => (
                  <Button
                    key={reason}
                    label={reason}
                    variant={overrideReason === reason ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setOverrideReason(reason)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <Button
                label="Defer 24h & Bank Water Saved"
                variant="primary"
                size="md"
                elevation="low"
                onClick={handleDeferRainHold}
              />
              <Button
                label="Override Interlock & Start Valve"
                variant="secondary"
                size="md"
                onClick={() => void handleOverrideAndStart()}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Schedule Dialog */}
      {schedModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-schedule-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border p-6 space-y-4"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-default)" }}
          >
            <div className="flex items-center justify-between">
              <h2
                id="new-schedule-title"
                className="text-lg font-semibold"
                style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
              >
                Create Irrigation Schedule
              </h2>
              <IconButton
                label="Close schedule modal"
                icon={<X className="w-5 h-5" />}
                variant="ghost"
                size="sm"
                onClick={() => setSchedModalOpen(false)}
              />
            </div>

            <form onSubmit={(e) => void handleCreateSchedule(e)} className="space-y-4">
              {valves.length > 1 && (
                <div>
                  <label
                    htmlFor="schedule-valve-select"
                    className="block text-xs font-medium mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Valve
                  </label>
                  <select
                    id="schedule-valve-select"
                    value={selectedValveId || valves[0]?.valveId}
                    onChange={(e) => setSelectedValveId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                    style={{
                      background: "var(--bg-raised)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  >
                    {valves.map((v) => (
                      <option key={v.valveId} value={v.valveId}>
                        {v.zoneName} ({v.valveId})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label
                  htmlFor="schedule-zone-input"
                  className="block text-xs font-medium mb-1"
                  style={{ color: "var(--text-primary)" }}
                >
                  Zone / Field *
                </label>
                <input
                  id="schedule-zone-input"
                  type="text"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                  placeholder="Block A Wheat"
                  className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                  style={{
                    background: "var(--bg-raised)",
                    borderColor: "var(--border-default)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="schedule-start-time"
                    className="block text-xs font-medium mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Start Time
                  </label>
                  <input
                    id="schedule-start-time"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
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
                    htmlFor="schedule-duration"
                    className="block text-xs font-medium mb-1"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Duration (min)
                  </label>
                  <input
                    id="schedule-duration"
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border outline-none"
                    style={{
                      background: "var(--bg-raised)",
                      borderColor: "var(--border-default)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  label="Cancel"
                  variant="secondary"
                  size="sm"
                  onClick={() => setSchedModalOpen(false)}
                />
                <Button
                  label="Save schedule"
                  type="submit"
                  variant="primary"
                  size="sm"
                  elevation="low"
                />
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
