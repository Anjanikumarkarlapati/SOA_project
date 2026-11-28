"use client";
import React, { useEffect, useState } from "react";
import { Heading } from "@astryxdesign/core/Heading";
import {
  fetchClimate,
  computeClimateStats,
  computeFarmerRecommendations,
  type ClimateData,
  type ClimateStats,
} from "@/lib/climate";
import {
  recommendCrops,
  getCropById,
  type CropScore,
  type Season,
} from "@/lib/crops";
import { useFarmStore, getActiveProperty } from "@/lib/property-store";
import { isOfflineToken, useAuthStore } from "@/lib/auth";
import {
  climateApi,
  farmApi,
  recommendationApi,
  toBackendCropIntent,
  type BackendRecommendationResponse,
} from "@/lib/api";
import { FarmerRecommendationCard } from "@/components/FarmerRecommendationCard";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { Banner } from "@astryxdesign/core/Banner";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import {
  Sprout,
  Droplets,
  Thermometer,
  Star,
  AlertTriangle,
  Wind,
  MapPin,
  RefreshCw,
} from "lucide-react";

function pastIsoDate(daysAgo: number, yearsAgo = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  if (yearsAgo > 0) d.setUTCFullYear(d.getUTCFullYear() - yearsAgo);
  return d.toISOString().slice(0, 10);
}

function isoDateOrNull(val?: string | null): string | null {
  if (!val) return null;
  const trimmed = val.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function riskBadgeVariant(risk: string): "green" | "yellow" | "red" {
  const upper = risk.toUpperCase();
  if (upper === "LOW") return "green";
  if (upper === "MODERATE") return "yellow";
  return "red";
}

const FARMS: { name: string; lat: number; lon: number; season: Season }[] = [
  { name: "Punjab (Ludhiana)",    lat: 30.901, lon: 75.857, season: "Rabi" },
  { name: "Maharashtra (Nashik)", lat: 20.006, lon: 73.790, season: "Kharif" },
  { name: "Andhra (Guntur)",      lat: 16.307, lon: 80.437, season: "Kharif" },
  { name: "Karnataka (Mandya)",   lat: 12.522, lon: 76.895, season: "any" },
];

function suitabilityColor(s: string) {
  if (s === "Excellent") return "var(--status-good)";
  if (s === "Good") return "var(--status-info)";
  if (s === "Fair") return "var(--status-warning)";
  return "var(--status-critical)";
}

export default function RecommendationsPage() {
  const token = useAuthStore((s) => s.user?.token ?? "");
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const updateProperty = useFarmStore((s) => s.updateProperty);
  const activeFarm = getActiveProperty({ properties, activePropertyId });

  const [presetIdx, setPresetIdx] = useState(0);
  const [climateData, setClimateData] = useState<ClimateData | null>(null);
  const [stats, setStats] = useState<ClimateStats | null>(null);
  const [results, setResults] = useState<CropScore[]>([]);
  const [backendRecs, setBackendRecs] = useState<BackendRecommendationResponse | null>(null);
  const [backendRecsError, setBackendRecsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const targetLat = activeFarm ? activeFarm.lat : FARMS[presetIdx].lat;
  const targetLon = activeFarm ? activeFarm.lon : FARMS[presetIdx].lon;
  const targetSeason: Season = activeFarm ? "any" : FARMS[presetIdx].season;
  const targetName = activeFarm ? activeFarm.name : FARMS[presetIdx].name;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const d = await fetchClimate(targetLat, targetLon);
        if (cancelled) return;
        const computedStats = computeClimateStats(d);
        setClimateData(d);
        setStats(computedStats);
        setResults(recommendCrops(computedStats, targetSeason).slice(0, 5));
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to calculate recommendations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadGatewayRecommendations() {
      if (!token || isOfflineToken(token)) {
        if (!cancelled) {
          setBackendRecs(null);
          setBackendRecsError(null);
        }
        return;
      }
      try {
        const end = pastIsoDate(5);
        const start = pastIsoDate(5, 1);
        let res: BackendRecommendationResponse | null = null;
        if (activeFarm?.syncedToBackend) {
          res = await farmApi
            .propertyRecommendations(activeFarm.id, token, start, end)
            .catch(() => null);
        }
        if (!res) {
          const hist = await climateApi
            .history(targetLat, targetLon, start, end, token)
            .catch(() => null);
          res = await recommendationApi.score(
            {
              climate: hist?.statistics ?? null,
              soilType: activeFarm?.soilType ?? "loam",
              waterSource: activeFarm?.waterSource ?? "borewell",
              waterAvailability: activeFarm?.waterAvailability ?? "year-round",
              intent: toBackendCropIntent(activeFarm?.cropIntent),
              targetDate: isoDateOrNull(activeFarm?.plannedDateStart),
              limit: 5,
            },
            token
          );
        }
        if (!cancelled) {
          setBackendRecs(res);
          setBackendRecsError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setBackendRecs(null);
          setBackendRecsError(
            err instanceof Error ? err.message : "Live crop recommendation service unavailable"
          );
        }
      }
    }

    void load();
    void loadGatewayRecommendations();
    return () => {
      cancelled = true;
    };
  }, [
    targetLat,
    targetLon,
    targetSeason,
    token,
    activeFarm?.id,
    activeFarm?.syncedToBackend,
    activeFarm?.soilType,
    activeFarm?.waterSource,
    activeFarm?.waterAvailability,
    activeFarm?.cropIntent,
    activeFarm?.plannedDateStart,
    reloadKey,
  ]);

  const handleSelectCrop = async (cropId: string) => {
    if (!activeFarm) return;
    try {
      await updateProperty(activeFarm.id, { selectedCropId: cropId }, token);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unable to update active farm crop");
    }
  };

  const selectedCrop = activeFarm?.selectedCropId
    ? getCropById(activeFarm.selectedCropId)
    : results[0]?.crop ?? getCropById("wheat");

  const farmerRecs =
    climateData && stats
      ? computeFarmerRecommendations(selectedCrop, climateData, stats, activeFarm?.areaHa ?? 2.0)
      : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <Heading level={1} weight="normal" textWrap="balance" className="type-page-title">
            Crop Recommendations &amp; Daily Advisory
          </Heading>
          <p className="type-lead mt-1">
            Scored by temperature fit, water availability, season match, and humidity for{" "}
            <strong style={{ color: "var(--text-primary)" }}>{targetName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {properties.length === 0 && (
            <select
              aria-label="Select preset farm"
              value={presetIdx}
              onChange={(e) => {
                setLoading(true);
                setPresetIdx(Number(e.target.value));
              }}
              className="text-sm px-3 py-2 rounded-full border"
              style={{
                background: "var(--bg-raised)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {FARMS.map((f, i) => (
                <option key={i} value={i}>
                  {f.name}
                </option>
              ))}
            </select>
          )}
          <Button
            label="14-Day Climate Charts"
            href="/climate"
            variant="secondary"
            size="sm"
          />
        </div>
      </div>

      {activeFarm && (
        <div
          className="flex items-center justify-between gap-2 text-xs px-3.5 py-2 rounded-lg border flex-wrap"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            <span>Active Farm:</span>
            <strong style={{ color: "var(--text-primary)" }}>{activeFarm.name}</strong>
            <span>· Active Crop:</span>
            <strong style={{ color: "var(--accent)" }}>{selectedCrop.name}</strong>
          </div>
          <span>{activeFarm.areaHa.toFixed(1)} ha</span>
        </div>
      )}

      {loading && (
        <div role="status" aria-busy="true" aria-label="Calculating crop recommendations" className="space-y-4">
          <BezelCard innerClassName="p-5 space-y-3">
            <Skeleton width="45%" height={22} radius={2} index={0} />
            <Skeleton width="75%" height={14} radius={2} index={1} />
            <Skeleton width="100%" height={140} radius={3} index={2} />
          </BezelCard>
        </div>
      )}

      {error && (
        <Banner
          status="error"
          role="alert"
          title="Unable to load crop recommendations"
          description={error}
          endContent={
            <Button
              label="Retry"
              variant="secondary"
              size="sm"
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              onClick={() => setReloadKey((k) => k + 1)}
            />
          }
        />
      )}

      {/* Mounted Interactive FarmerRecommendationCard */}
      {!loading && farmerRecs && <FarmerRecommendationCard recommendations={farmerRecs} />}

      {/* Regional Crop Advisory Scoring */}
      {backendRecsError && !backendRecs && (
        <Banner
          status="warning"
          title="Regional Crop Advisory"
          description={backendRecsError}
        />
      )}

      {backendRecs && backendRecs.recommendations.length > 0 && (
        <BezelCard
          data-testid="gateway-crop-recommendations"
          innerClassName="p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <Heading level={2} weight="semibold" className="type-card-title !text-lg">
                Regional Crop Advisory Engine (Climate + Soil/Water Fit)
              </Heading>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Live multi-factor suitability score from synced climate &amp; soil profiles
                {backendRecs.period ? ` (${backendRecs.period.start} to ${backendRecs.period.end})` : ""}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {backendRecs.intent && (
                <Badge variant="neutral" label={backendRecs.intent} />
              )}
              <Badge
                variant={backendRecs.fallback ? "yellow" : "green"}
                label={backendRecs.fallback ? "Fallback Climate" : "Live Scored"}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {backendRecs.recommendations.map((rec) => {
              const isSelected = selectedCrop.id === rec.cropId;
              return (
                <div
                  key={rec.cropId}
                  className="rounded-xl border p-4 space-y-2.5"
                  style={{
                    background: "var(--bg-raised)",
                    borderColor: isSelected ? "var(--accent)" : "var(--border-default)",
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                          {rec.crop}
                        </span>
                        <Badge variant={riskBadgeVariant(rec.riskLevel)} label={`${rec.riskLevel} RISK`} />
                      </div>
                      <div className="text-xs mt-0.5 font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        Sow: {rec.sowingWindow} · Harvest: {rec.harvestWindow}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="type-kpi-sm !text-xl !text-[var(--accent)]">
                        {rec.score.toFixed(1)}
                      </div>
                      <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {Math.round(rec.expectedWaterNeedMm)} mm need
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {rec.explanation}
                  </p>

                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <div className="flex flex-wrap gap-2 text-xs font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                      <span>Temp {Math.round(rec.temperatureFit)}%</span>
                      <span>Water {Math.round(rec.waterFit)}%</span>
                      <span>Soil {Math.round(rec.soilMatch)}%</span>
                      <span>Season {Math.round(rec.seasonFit)}%</span>
                    </div>
                    {activeFarm && !isSelected && (
                      <Button
                        label="Set as Farm Crop"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleSelectCrop(rec.cropId)}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {backendRecs.adaptations.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-[var(--border-default)]">
              <div className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Climate Adaptation Guidance
              </div>
              {backendRecs.adaptations.map((note, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-xs"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--status-warning)]" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          )}
        </BezelCard>
      )}

      {/* Ranked Crop Suitability List */}
      {!loading && results.length > 0 && (
        <div className="space-y-4">
          <Heading level={2} weight="normal" className="type-section-title">
            Top Crop Suitability Ranking
          </Heading>
          {results.map((r, idx) => {
            const color = suitabilityColor(r.suitability);
            const isSelected = selectedCrop.id === r.crop.id;
            return (
              <BezelCard
                key={r.crop.id}
                className={isSelected ? "ring-1 ring-[var(--accent)]" : undefined}
                innerClassName="p-5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]">
                      <Sprout className="w-5 h-5 text-[var(--accent)]" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Heading level={3} weight="semibold" className="type-card-title">
                          {r.crop.name}
                        </Heading>
                        {idx === 0 && (
                          <span
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "var(--accent-wash)", color: "var(--accent)" }}
                          >
                            <Star className="w-3 h-3" /> Top pick
                          </span>
                        )}
                      </div>
                      <div className="text-xs mt-0.5 font-mono tabular-nums" style={{ color: "var(--text-secondary)" }}>
                        {r.crop.category} · {r.crop.seasons.join(", ")} · {r.crop.growDays}d grow
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {activeFarm && !isSelected && (
                      <Button
                        label="Set as Farm Crop"
                        variant="secondary"
                        size="sm"
                        onClick={() => void handleSelectCrop(r.crop.id)}
                      />
                    )}
                    <div className="text-right">
                      <div className="type-kpi !text-2xl" style={{ color }}>
                        {r.score}
                      </div>
                      <div className="text-xs font-medium" style={{ color }}>
                        {r.suitability}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score breakdown bars */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Season", value: r.breakdown.season, Icon: Sprout },
                    { label: "Temp", value: r.breakdown.temp, Icon: Thermometer },
                    { label: "Water", value: r.breakdown.water, Icon: Droplets },
                    { label: "Humidity", value: r.breakdown.humidity, Icon: Wind },
                  ].map(({ label, value, Icon }) => (
                    <div key={label}>
                      <div
                        className="flex items-center gap-1 text-xs mb-1"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <Icon className="w-3 h-3" /> {label}
                      </div>
                      <div
                        className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "var(--border-default)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${value}%`, background: "var(--accent)" }}
                        />
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                        {value}%
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warnings */}
                {r.warnings.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {r.warnings.slice(0, 2).map((w, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 text-xs"
                        style={{ color: "var(--status-warning)" }}
                      >
                        <AlertTriangle className="w-3 h-3 shrink-0" /> {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick facts */}
                <div className="flex flex-wrap gap-2 text-xs">
                  {[
                    { l: "Water need", v: r.crop.waterNeed },
                    { l: "Yield", v: `${r.crop.yieldTonPerHa} t/ha` },
                    { l: "Temp range", v: `${r.crop.tempRange[0]}–${r.crop.tempRange[1]} °C` },
                    { l: "Soil pH", v: `${r.crop.soilPH[0]}–${r.crop.soilPH[1]}` },
                  ].map(({ l, v }) => (
                    <div
                      key={l}
                      className="px-2 py-1 rounded"
                      style={{ background: "var(--bg-raised)", color: "var(--text-secondary)" }}
                    >
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{l}:</span>{" "}
                      {v}
                    </div>
                  ))}
                </div>

                {r.crop.notes && (
                  <p className="text-xs mt-3 italic" style={{ color: "var(--text-secondary)" }}>
                    {r.crop.notes}
                  </p>
                )}
              </BezelCard>
            );
          })}
        </div>
      )}

      <div
        className="flex items-center justify-between gap-3 pt-2 border-t flex-wrap"
        style={{ borderColor: "var(--border-default)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Next workflow step: schedule watering zones and valve interlocks for your chosen crop.
        </span>
        <Button
          label="Next: Irrigation & Valves"
          href="/irrigation"
          variant="primary"
          size="sm"
          icon={<Droplets className="w-4 h-4" />}
        />
      </div>
    </div>
  );
}
