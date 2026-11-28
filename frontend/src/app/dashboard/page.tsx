"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Heading } from "@astryxdesign/core/Heading";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthStore, isOfflineToken } from "@/lib/auth";
import {
  sensorApi,
  cropApi,
  valveApi,
  telemetryApi,
  type CropField,
  type ValveSummary,
} from "@/lib/api";
import {
  fetchClimate,
  computeClimateStats,
  type ClimateData,
  type ClimateStats,
} from "@/lib/climate";
import { getCropById } from "@/lib/crops";
import {
  useFarmStore,
  getActiveProperty,
  type FarmerMode,
} from "@/lib/property-store";
import {
  computeWaterBudget,
  buildVernacularShiftBriefing,
} from "@/lib/fieldshield";
import type {
  DailyActionBriefing,
  DailyBriefingMandiInput,
} from "@/lib/daily-briefing";
import { appendRoznamchaEntry } from "@/lib/roznamcha";
import { useLanguage } from "@/lib/i18n";
import { DailyActionCard } from "@/components/farmer/DailyActionCard";
import { RoznamchaDrawer } from "@/components/farmer/RoznamchaDrawer";
import { SimpleFarmerHome } from "@/components/farmer/SimpleFarmerHome";
import { FpoBroadcastPanel } from "@/components/fpo/FpoBroadcastPanel";
import { RootZoneSoilCard } from "@/components/RootZoneSoilCard";
import { FarmAerialSurvey } from "@/components/FarmAerialSurvey";
import { FarmMap } from "@/components/FarmMap";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Badge } from "@astryxdesign/core/Badge";
import { Divider } from "@astryxdesign/core/Divider";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import {
  DEFAULT_FARM_LOCATION,
  inferLocationFromAddress,
} from "@/lib/indian-locations";
import {
  CloudSun,
  Droplets,
  Activity,
  Sprout,
  CheckCircle2,
  Plus,
  MapPin,
  Copy,
  Send,
  FileText,
  ArrowRight,
  BookOpen,
} from "lucide-react";

interface WeatherSummary {
  temp: number;
  precip: number;
  humidity: number;
  windSpeed: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const token = useAuthStore((s) => s.user?.token ?? "");
  const { language, t } = useLanguage();

  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const sensorsByFarm = useFarmStore((s) => s.sensorsByFarm);
  const preferences = useFarmStore((s) => s.preferences);
  const waterSavedLitres = useFarmStore((s) => s.waterSavedLitres);
  const farmerMode = useFarmStore((s) => s.farmerMode);
  const setFarmerMode = useFarmStore((s) => s.setFarmerMode);
  const farmLocation = useFarmStore((s) => s.farmLocation);
  const setFarmLocation = useFarmStore((s) => s.setFarmLocation);
  const logShiftDispatch = useFarmStore((s) => s.logShiftDispatch);
  const updateProperty = useFarmStore((s) => s.updateProperty);
  const syncPropertiesFromBackend = useFarmStore((s) => s.syncPropertiesFromBackend);

  const activeFarm = getActiveProperty({ properties, activePropertyId });
  const activeCrop = getCropById(activeFarm?.selectedCropId || "wheat");

  useEffect(() => {
    if (
      activeFarm?.address &&
      farmLocation.stateCode === DEFAULT_FARM_LOCATION.stateCode &&
      farmLocation.districtName === DEFAULT_FARM_LOCATION.districtName
    ) {
      const inferred = inferLocationFromAddress(activeFarm.address);
      if (inferred) setFarmLocation(inferred);
    }
  }, [activeFarm?.address, farmLocation.stateCode, farmLocation.districtName, setFarmLocation]);

  const [sensorSummary, setSensorSummary] = useState<{
    total: number;
    online: number;
    offline: number;
    lowBattery: number;
  } | null>(null);
  const [cropSummary, setCropSummary] = useState<{
    totalFields: number;
    optimalFields: number;
    optimalPercent: number;
  } | null>(null);
  const [cropFields, setCropFields] = useState<CropField[]>([]);
  const [valveSummary, setValveSummary] = useState<ValveSummary | null>(null);
  const [telemetryStats, setTelemetryStats] = useState<{
    readingsLastMinute: number;
    readingsLastHour: number;
    totalReadings: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [alerts, setAlerts] = useState<{ severity: string; message: string }[]>([]);
  const [climateData, setClimateData] = useState<ClimateData | null>(null);
  const [weather, setWeather] = useState<WeatherSummary | null>(null);
  const [stats, setStats] = useState<ClimateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [dispatched, setDispatched] = useState(false);
  const [roznamchaOpen, setRoznamchaOpen] = useState(false);
  const [topMandi, setTopMandi] = useState<DailyBriefingMandiInput | null>(null);

  const lat = activeFarm?.lat ?? farmLocation.lat ?? 30.901;
  const lon = activeFarm?.lon ?? farmLocation.lon ?? 75.857;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (token && !isOfflineToken(token)) {
        try {
          const [ss, cs, al, cf, vs, ts] = await Promise.allSettled([
            sensorApi.summary(token),
            cropApi.summary(token),
            cropApi.alerts(token),
            cropApi.list(token),
            valveApi.summary(token),
            telemetryApi.stats(token),
            syncPropertiesFromBackend(token),
          ]);
          if (!cancelled) {
            if (ss.status === "fulfilled") setSensorSummary(ss.value);
            if (cs.status === "fulfilled") setCropSummary(cs.value);
            if (al.status === "fulfilled") setAlerts(al.value.slice(0, 3));
            if (cf.status === "fulfilled" && Array.isArray(cf.value)) {
              setCropFields(cf.value);
            }
            if (vs.status === "fulfilled") setValveSummary(vs.value);
            if (ts.status === "fulfilled") setTelemetryStats(ts.value);
          }
        } catch {
          /* backend offline */
        }
      }

      try {
        const climate = await fetchClimate(lat, lon);
        if (!cancelled && climate?.current) {
          setClimateData(climate);
          setWeather({
            temp: climate.current.temperature_2m,
            precip: climate.current.precipitation,
            humidity: climate.current.relative_humidity_2m,
            windSpeed: climate.current.wind_speed_10m,
          });
          setStats(computeClimateStats(climate));
        }
      } catch {
        /* no weather */
      }

      if (!cancelled) setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, lat, lon, syncPropertiesFromBackend]);

  useEffect(() => {
    let cancelled = false;
    async function loadMandi() {
      try {
        const params = new URLSearchParams({
          stateCode: farmLocation.stateCode,
          district: farmLocation.districtName,
          crop: activeCrop.name,
        });
        const res = await fetch(`/api/mandi?${params.toString()}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          rates?: Array<{
            crop?: string;
            mandiName?: string;
            modalPriceInr?: number;
            mspInr?: number;
            verdict?: "SELL_NOW" | "HOLD" | "WATCH";
          }>;
        };
        const first = data?.rates?.[0];
        if (!cancelled && first) {
          setTopMandi({
            cropName: first.crop ?? activeCrop.name,
            mandiName: first.mandiName,
            modalPriceInr: first.modalPriceInr,
            mspInr: first.mspInr,
            verdict: first.verdict,
          });
        }
      } catch {
        /* offline or route unavailable */
      }
    }
    void loadMandi();
    return () => {
      cancelled = true;
    };
  }, [farmLocation.stateCode, farmLocation.districtName, activeCrop.name]);

  const handleAnalyzeAll = async () => {
    if (!token || isOfflineToken(token)) return;
    setAnalyzing(true);
    try {
      await cropApi.analyze(token);
      const [cf, cs, al] = await Promise.allSettled([
        cropApi.list(token),
        cropApi.summary(token),
        cropApi.alerts(token),
      ]);
      if (cf.status === "fulfilled" && Array.isArray(cf.value)) setCropFields(cf.value);
      if (cs.status === "fulfilled") setCropSummary(cs.value);
      if (al.status === "fulfilled") setAlerts(al.value.slice(0, 3));
    } catch {
      /* ignore transient analysis failure */
    } finally {
      setAnalyzing(false);
    }
  };

  const primaryLiveCrop =
    (activeFarm?.fieldId && cropFields.find((c) => c.cropId === activeFarm.fieldId)) ||
    cropFields.find((c) => c.cropType.toLowerCase() === activeCrop.id.toLowerCase()) ||
    cropFields[0] ||
    null;

  const localSensors = activeFarm ? sensorsByFarm[activeFarm.id] ?? [] : [];
  const effectiveSensorTotal = sensorSummary?.total ?? localSensors.length;
  const effectiveSensorOnline =
    sensorSummary?.online ??
    localSensors.filter(
      (s) => s.status === "ONLINE" || s.status === "ACTIVE" || s.health === "ONLINE"
    ).length;
  const effectiveSensorOffline = Math.max(0, effectiveSensorTotal - effectiveSensorOnline);

  const formatArea = (areaHa: number) => {
    if (preferences.areaUnit === "acres") {
      return `${(areaHa * 2.47105).toFixed(2)} acres`;
    }
    return `${areaHa.toFixed(1)} ha`;
  };

  const waterBudget = computeWaterBudget({
    areaHa: activeFarm?.areaHa ?? 2.5,
    todayEt0: stats?.todayEt0 ?? 4.2,
    todayRainMm: stats?.todayRainMm ?? 0,
    kc: activeCrop.kc[1] ?? 1.15,
    irrigationType: activeFarm?.irrigationType || "drip",
    pumpFlowLpm: preferences.pumpFlowLpm,
  });

  const spraySafe =
    (stats?.currentWindKmh ?? 8) < 15 && (stats?.rainProbMax ?? 10) < 40;

  const briefingText = buildVernacularShiftBriefing({
    farmName: activeFarm?.name ?? "Ludhiana Wheat Parcel",
    cropName: activeCrop.name,
    priorityZone: "South Ridge Furrow (Block C)",
    netLitres: waterBudget.netDeliveryLitres,
    recommendedMinutes: waterBudget.recommendedMinutes,
    spraySafe,
    topTasks: [
      `Verify root-zone moisture (${stats?.currentSoilMoisturePct ?? 62}%) before morning valve cycle`,
      `Inspect ${activeCrop.name} canopy for ${activeCrop.commonPests[0] ?? "aphid"} activity`,
    ],
    language,
    t,
  });

  const handleCopyBrief = async () => {
    try {
      await navigator.clipboard?.writeText(briefingText);
    } catch {
      /* ignore clipboard error in headless browser */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDispatchShift = () => {
    logShiftDispatch(activeFarm?.id ?? "farm-default", briefingText);
    setDispatched(true);
  };

  const briefingWeather = {
    todayEt0: stats?.todayEt0 ?? 4.2,
    todayRainMm: stats?.todayRainMm ?? weather?.precip ?? 0,
    rainProbMax: stats?.rainProbMax ?? 10,
    currentWindKmh: stats?.currentWindKmh ?? weather?.windSpeed ?? 8,
    currentSoilMoisturePct:
      primaryLiveCrop?.soilMoisture ?? stats?.currentSoilMoisturePct ?? 62,
    pumpFlowLpm: preferences.pumpFlowLpm,
  };

  const handleLogBriefingToRoznamcha = (briefing: DailyActionBriefing) => {
    appendRoznamchaEntry({
      farmId: activeFarm?.id ?? "farm-default",
      category: "irrigation",
      title: `6 AM Brief · ${briefing.irrigationVerdict.action}`,
      details: `${briefing.irrigationVerdict.headline} | Spray ${briefing.sprayWindow.status} (${briefing.sprayWindow.windKmh} km/h)`,
      soilMoisturePct: briefingWeather.currentSoilMoisturePct,
      rainMm: briefingWeather.todayRainMm,
      waterLitres:
        briefing.irrigationVerdict.netLitres ||
        briefing.irrigationVerdict.estimatedWasteLitres,
    });
    setRoznamchaOpen(true);
  };

  const cards = [
    {
      label: "Sensors",
      icon: Activity,
      main:
        effectiveSensorTotal > 0
          ? `${effectiveSensorOnline}/${effectiveSensorTotal}`
          : sensorSummary
            ? `${sensorSummary.online}/${sensorSummary.total}`
            : "—",
      sub:
        effectiveSensorTotal > 0
          ? `${effectiveSensorOffline} offline`
          : sensorSummary
            ? `${sensorSummary.offline} offline`
            : "No data",
      color: "var(--status-info)",
    },
    {
      label: "Crop Fields",
      icon: Sprout,
      main: cropSummary
        ? `${cropSummary.optimalPercent}%`
        : activeFarm
          ? formatArea(activeFarm.areaHa)
          : "—",
      sub: cropSummary
        ? `${cropSummary.optimalFields}/${cropSummary.totalFields} optimal`
        : activeFarm
          ? `${activeCrop.name} · ${activeFarm.irrigationType || "drip"}`
          : "No data",
      color: "var(--status-good)",
    },
    {
      label: "Temperature",
      icon: CloudSun,
      main: weather ? `${weather.temp.toFixed(1)}°C` : "—",
      sub: stats ? `${stats.avgTempC.toFixed(1)}°C avg (14-day)` : "Loading…",
      color: "var(--status-warning)",
    },
    {
      label: "Rainfall",
      icon: Droplets,
      main: weather ? `${weather.precip.toFixed(1)} mm` : "—",
      sub: stats ? `${stats.totalPrecipMm.toFixed(0)} mm (14-day)` : "Loading…",
      color: "var(--status-info)",
    },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap border-b border-[var(--border-default)] pb-6">
        <div>
          <Heading level={1} weight="normal" textWrap="balance" className="type-page-title">
            {t("dashboard.goodMorning", "Good morning")}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </Heading>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-secondary)" }}>
            {activeFarm ? (
              <>
                Active Field Hub: <strong style={{ color: "var(--text-primary)" }}>{activeFarm.name}</strong>
                {" · "}
                <span>{formatArea(activeFarm.areaHa)}</span>
                {" · "}
                <span>
                  {activeFarm.address ||
                    `${activeFarm.lat.toFixed(3)}, ${activeFarm.lon.toFixed(3)}`}
                </span>
              </>
            ) : (
              "Here's an overview of your farm today."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <SegmentedControl
            label="Farmer view mode"
            value={farmerMode}
            onChange={(val) => setFarmerMode(val as FarmerMode)}
            size="sm"
          >
            <SegmentedControlItem value="simple" label={t("companion.simpleMode", "Simple")} />
            <SegmentedControlItem value="full" label={t("companion.fullMode", "Full")} />
          </SegmentedControl>
          <Button
            label={t("dashboard.roznamcha", "Roznamcha")}
            variant="outline"
            size="sm"
            icon={<BookOpen className="w-4 h-4" />}
            onClick={() => setRoznamchaOpen(true)}
          />
          {waterSavedLitres > 0 && (
            <span
              className="text-xs font-medium px-3.5 py-2 rounded-full border"
              style={{
                background: "var(--accent-wash)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              Water Saved: {waterSavedLitres.toLocaleString("en-US")} L
            </span>
          )}
          <Button
            href="/properties/new"
            label={t("dashboard.addProperty", "Add Property")}
            variant="primary"
            icon={<Plus className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Urgent Active Alerts first */}
      {alerts.length > 0 && (
        <div>
          <Heading level={2} weight="normal" className="type-section-title !text-xl mb-3">
            {t("dashboard.activeAlerts", "Active Alerts")}
          </Heading>
          <div className="space-y-2.5">
            {alerts.map((a, i) => (
              <Banner
                key={i}
                status={a.severity === "CRITICAL" ? "error" : "warning"}
                title={a.message}
              />
            ))}
          </div>
        </div>
      )}

      {farmerMode === "simple" ? (
        <SimpleFarmerHome
          property={activeFarm}
          weather={briefingWeather}
          topMandi={topMandi}
          onOpenRoznamcha={() => setRoznamchaOpen(true)}
          onLogBriefing={handleLogBriefingToRoznamcha}
        />
      ) : (
        <>
          <DailyActionCard
            property={activeFarm}
            weather={briefingWeather}
            topMandi={topMandi}
            onLogToRoznamcha={handleLogBriefingToRoznamcha}
          />

          {/* Stat cards */}
      {loading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading dashboard metrics"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {[0, 1, 2, 3].map((idx) => (
            <BezelCard key={idx} innerClassName="p-4 space-y-2.5">
              <Skeleton width="55%" height={14} radius={2} index={idx} />
              <Skeleton width="45%" height={28} radius={2} index={idx} />
              <Skeleton width="75%" height={12} radius={2} index={idx} />
            </BezelCard>
          ))}
        </div>
      ) : (
        <div data-testid="dashboard-kpi-grid" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(({ label, icon: Icon, main, sub, color }) => (
            <BezelCard key={label} innerClassName="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                  {label}
                </span>
              </div>
              <div
                className="type-kpi !text-2xl"
                style={{ color: "var(--text-primary)" }}
              >
                {main}
              </div>
              <div
                className="text-xs mt-0.5 font-mono tabular-nums"
                style={{ color: "var(--text-secondary)" }}
              >
                {sub}
              </div>
            </BezelCard>
          ))}
        </div>
      )}

      {/* Empty state — only when 0 properties in store AND no backend cropSummary */}
      {!loading && properties.length === 0 && !cropSummary && cropFields.length === 0 && (
        <div
          className="rounded-[24px] border border-dashed p-6"
          style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
        >
          <EmptyState
            title="No properties yet"
            description="Register your first farm to start getting climate analysis and crop recommendations."
            icon={<MapPin className="w-8 h-8" />}
            actions={
              <Button
                href="/properties/new"
                label="Register farm"
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
              />
            }
          />
        </div>
      )}

      {/* Morning Priority: FieldShield Vernacular Field Shift Briefing Card */}
      <BezelCard innerClassName="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: "var(--accent)" }} />
            <div>
              <Heading level={2} weight="semibold" className="type-card-title">
                {t("briefing.title", "FieldShield Shift Brief")}
              </Heading>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Ready-to-dispatch morning instructions for field crews in {language.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              label={copied ? "Copied Brief" : "Copy WhatsApp / SMS Brief"}
              variant="secondary"
              size="sm"
              icon={<Copy className="w-3.5 h-3.5" />}
              onClick={() => void handleCopyBrief()}
            />
            <Button
              label="Log Shift Dispatched"
              variant="primary"
              size="sm"
              icon={<Send className="w-3.5 h-3.5" />}
              onClick={handleDispatchShift}
            />
          </div>
        </div>

        <pre
          className="text-xs sm:text-sm whitespace-pre-wrap rounded-lg p-4 border font-sans leading-relaxed"
          style={{
            background: "var(--bg-raised)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
        >
          {briefingText}
        </pre>

        {dispatched && (
          <div
            className="text-xs flex items-center gap-1.5"
            style={{ color: "var(--status-good)" }}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Shift briefing logged to farm event ledger.</span>
          </div>
        )}
      </BezelCard>

      {/* Live Gateway Crop Fields & Telemetry Health Ledger */}
      {cropFields.length > 0 && (
        <BezelCard
          data-testid="live-field-health-ledger"
          innerClassName="p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <Heading level={2} weight="semibold" className="type-card-title">
                Live Field Health &amp; Telemetry Ledger
              </Heading>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Live crop fields &amp; root-zone activity
                {valveSummary
                  ? ` · ${valveSummary.running}/${valveSummary.totalZones} valve zones active`
                  : ""}
                {telemetryStats
                  ? ` · ${telemetryStats.totalReadings.toLocaleString("en-US")} sensor readings`
                  : ""}
              </p>
            </div>
            <Button
              label={analyzing ? "Analyzing..." : "Analyze All Fields"}
              variant="secondary"
              size="sm"
              loading={analyzing}
              disabled={analyzing}
              onClick={() => void handleAnalyzeAll()}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cropFields.map((cf) => (
              <div
                key={cf.cropId}
                className="rounded-xl border p-3.5 space-y-1.5"
                style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      {cf.name}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                      {cf.cropId} · {cf.cropType} · {formatArea(cf.areaHectares)}
                    </div>
                  </div>
                  <Badge
                    variant={
                      cf.status === "OPTIMAL" || cf.status === "HEALTHY"
                        ? "green"
                        : cf.status === "CRITICAL"
                          ? "red"
                          : "yellow"
                    }
                    label={cf.healthScore != null ? `${cf.status} (${cf.healthScore})` : cf.status}
                  />
                </div>
                <div className="flex flex-wrap gap-3 text-xs font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                  <span>Moisture {cf.soilMoisture != null ? `${cf.soilMoisture.toFixed(1)}%` : "—"}</span>
                  <span>Temp {cf.soilTemperature != null ? `${cf.soilTemperature.toFixed(1)}°C` : "—"}</span>
                  <span>pH {cf.ph != null ? cf.ph.toFixed(2) : "—"}</span>
                </div>
                {Array.isArray(cf.recommendations) && cf.recommendations[0] && (
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {cf.recommendations[0]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </BezelCard>
      )}

      {/* Root-Zone Soil Telemetry */}
      <RootZoneSoilCard
        crop={activeCrop}
        soilMoisturePct={primaryLiveCrop?.soilMoisture ?? stats?.currentSoilMoisturePct ?? 62}
        soilTempC={primaryLiveCrop?.soilTemperature ?? stats?.currentSoilTempC ?? 22.4}
      />

      {/* Interactive FarmMap */}
      {activeFarm && (
        <FarmMap
          lat={activeFarm.lat}
          lng={activeFarm.lon}
          farmName={activeFarm.name}
          cropName={activeCrop.name}
          areaHectares={activeFarm.areaHa}
          currentWeather={climateData?.current ?? null}
          onLocationChange={(loc) => {
            void updateProperty(
              activeFarm.id,
              {
                lat: loc.lat,
                lon: loc.lng,
                ...(loc.address ? { address: loc.address } : {}),
              },
              token
            );
          }}
        />
      )}

      {/* Multi-Spectral Aerial Survey */}
      <FarmAerialSurvey
        farmName={activeFarm?.name ?? "Ludhiana Wheat Parcel"}
        cropName={activeCrop.name}
        areaHectares={activeFarm?.areaHa ?? 2.5}
      />

      {/* FPO 1-to-50 Broadcast Command Center */}
      <FpoBroadcastPanel />

      <Divider variant="subtle" />

      {/* Climate quick view + Direct Next-Step Workflow Shortcuts */}
      {stats && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Heading level={2} weight="normal" className="type-section-title !text-xl">
              Climate snapshot (14-day)
            </Heading>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                href="/climate"
                label="Climate Forecast"
                variant="secondary"
                size="sm"
                endContent={<ArrowRight className="w-3.5 h-3.5" />}
              />
              <Button
                href="/recommendations"
                label="Open Crop Planner"
                variant="secondary"
                size="sm"
                endContent={<ArrowRight className="w-3.5 h-3.5" />}
              />
              <Button
                href="/irrigation"
                label="Manage Irrigation"
                variant="primary"
                size="sm"
                endContent={<ArrowRight className="w-3.5 h-3.5" />}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Avg Temp", value: stats.avgTempC.toFixed(1) + " °C" },
              { label: "ET₀ (total)", value: stats.et0Total.toFixed(1) + " mm" },
              {
                label: "Rain days",
                value: stats.rainDays + " / " + (stats.rainDays + stats.dryDays),
              },
              { label: "Risk level", value: stats.riskLevel },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-lg px-4 py-3 border"
                style={{ background: "var(--bg-raised)", borderColor: "var(--border-default)" }}
              >
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {label}
                </div>
                <div
                  className="font-medium font-mono tabular-nums text-[15px] mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs" style={{ color: "var(--text-secondary)" }}>
            <Badge variant="info" label="Open-Meteo (ECMWF)" />
            <Link href="/climate" className="underline">
              Full analysis &rarr;
            </Link>
          </div>
        </div>
      )}
        </>
      )}

      <RoznamchaDrawer
        open={roznamchaOpen}
        onClose={() => setRoznamchaOpen(false)}
        property={activeFarm}
      />
    </div>
  );
}
