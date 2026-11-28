"use client";
import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  fetchClimate,
  computeClimateStats,
  type ClimateData,
  type ClimateStats,
} from "@/lib/climate";
import {
  climateApi,
  farmApi,
  type HistoricalClimateResponse,
} from "@/lib/api";
import { isOfflineToken, useAuthStore } from "@/lib/auth";
import { useFarmStore, getActiveProperty } from "@/lib/property-store";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { SlidingTabs } from "@/components/ui/SlidingTabs";
import {
  Loader2,
  Thermometer,
  Droplets,
  Wind,
  AlertTriangle,
  MapPin,
  Sprout,
} from "lucide-react";

const FARM_PRESETS = [
  { name: "Punjab (Ludhiana)",    lat: 30.901, lon: 75.857 },
  { name: "Maharashtra (Nashik)", lat: 20.006, lon: 73.790 },
  { name: "Andhra (Guntur)",      lat: 16.307, lon: 80.437 },
  { name: "Karnataka (Mandya)",   lat: 12.522, lon: 76.895 },
];

function pastIsoDate(daysAgo: number, yearsAgo = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  if (yearsAgo > 0) d.setUTCFullYear(d.getUTCFullYear() - yearsAgo);
  return d.toISOString().slice(0, 10);
}

export default function ClimatePage() {
  const token = useAuthStore((s) => s.user?.token ?? "");
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const activeFarm = getActiveProperty({ properties, activePropertyId });

  const [preset, setPreset] = useState(0);
  const [viewMode, setViewMode] = useState<"charts" | "table">("charts");
  const [data, setData] = useState<ClimateData | null>(null);
  const [stats, setStats] = useState<ClimateStats | null>(null);
  const [historical, setHistorical] = useState<HistoricalClimateResponse | null>(null);
  const [historicalNote, setHistoricalNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const targetLat = activeFarm ? activeFarm.lat : FARM_PRESETS[preset].lat;
  const targetLon = activeFarm ? activeFarm.lon : FARM_PRESETS[preset].lon;
  const targetName = activeFarm ? activeFarm.name : FARM_PRESETS[preset].name;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const d = await fetchClimate(targetLat, targetLon);
        if (cancelled) return;
        setData(d);
        setStats(computeClimateStats(d));
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load climate telemetry");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadGatewayHistorical() {
      if (!token || isOfflineToken(token)) {
        if (!cancelled) {
          setHistorical(null);
          setHistoricalNote(null);
        }
        return;
      }
      const end = pastIsoDate(5);
      const start = pastIsoDate(5, 1);
      try {
        let res: HistoricalClimateResponse | null = null;
        if (activeFarm?.syncedToBackend) {
          res = await farmApi.propertyClimate(activeFarm.id, token, start, end).catch(() => null);
        }
        if (!res) {
          res = await climateApi.history(targetLat, targetLon, start, end, token);
        }
        if (!cancelled) {
          setHistorical(res);
          setHistoricalNote(
            res.fallback || !res.dataAvailable
              ? "Historical reanalysis archive temporarily degraded (cached/fallback view)."
              : null
          );
        }
      } catch (err) {
        if (!cancelled) {
          setHistorical(null);
          setHistoricalNote(
            err instanceof Error
              ? err.message
              : "Historical climate summary unavailable"
          );
        }
      }
    }

    void load();
    void loadGatewayHistorical();
    return () => {
      cancelled = true;
    };
  }, [targetLat, targetLon, token, activeFarm?.id, activeFarm?.syncedToBackend]);

  const dailyChart = data?.daily
    ? data.daily.time.map((t, i) => ({
        date: t.slice(5),
        tmax: data.daily.temperature_2m_max[i],
        tmin: data.daily.temperature_2m_min[i],
        rain: data.daily.precipitation_sum[i],
        et0: data.daily.et0_fao_evapotranspiration[i] ?? 0,
        balance:
          data.daily.precipitation_sum[i] - (data.daily.et0_fao_evapotranspiration[i] ?? 0),
      }))
    : [];

  const statCards = stats
    ? [
        {
          label: "Avg Temp",
          value: `${stats.avgTempC.toFixed(1)} °C`,
          icon: Thermometer,
          color: "var(--status-warning)",
        },
        {
          label: "Current Temp",
          value: `${stats.currentTempC.toFixed(1)} °C`,
          icon: Thermometer,
          color: "var(--status-info)",
        },
        {
          label: "ET₀ (total)",
          value: `${stats.et0Total.toFixed(1)} mm`,
          icon: Wind,
          color: "var(--accent)",
        },
        {
          label: "Today ET₀",
          value: `${stats.todayEt0.toFixed(1)} mm`,
          icon: Wind,
          color: "var(--text-secondary)",
        },
        {
          label: "Rain days",
          value: `${stats.rainDays} of ${stats.rainDays + stats.dryDays}`,
          icon: Droplets,
          color: "var(--status-info)",
        },
        {
          label: "Risk",
          value: stats.riskLevel,
          icon: AlertTriangle,
          color:
            stats.riskLevel === "HIGH"
              ? "var(--status-critical)"
              : stats.riskLevel === "MODERATE"
                ? "var(--status-warning)"
                : "var(--status-good)",
        },
      ]
    : [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
          >
            Climate &amp; Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            14-day forecast &amp; soil data via Open-Meteo (ECMWF) for{" "}
            <strong style={{ color: "var(--text-primary)" }}>{targetName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div data-testid="climate-view-tabs">
            <SlidingTabs
              ariaLabel="Climate visualization mode"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "charts", label: "Telemetry Charts" },
                { value: "table", label: "Data Table", badge: dailyChart.length || 14 },
              ]}
            />
          </div>

          {properties.length === 0 && (
            <select
              aria-label="Select regional preset"
              value={preset}
              onChange={(e) => {
                setLoading(true);
                setPreset(Number(e.target.value));
              }}
              className="min-h-[44px] text-sm px-3 py-2 rounded-full border"
              style={{
                background: "var(--bg-raised)",
                borderColor: "var(--border-default)",
                color: "var(--text-primary)",
              }}
            >
              {FARM_PRESETS.map((p, i) => (
                <option key={i} value={i}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <Button
            label="Full Crop Advisory"
            href="/recommendations"
            variant="secondary"
            size="sm"
            icon={<Sprout className="w-3.5 h-3.5 text-[var(--accent)]" />}
          />
        </div>
      </div>

      {activeFarm && (
        <div
          className="flex items-center gap-2 text-xs px-3.5 py-2 rounded-lg border"
          style={{
            background: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            color: "var(--text-secondary)",
          }}
        >
          <MapPin className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
          <span>Active Farm:</span>
          <strong style={{ color: "var(--text-primary)" }}>{activeFarm.name}</strong>
          <span className="font-mono tabular-nums">
            ({activeFarm.lat.toFixed(4)}, {activeFarm.lon.toFixed(4)})
          </span>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-2 my-12" style={{ color: "var(--text-secondary)" }}>
          <Loader2 className="w-5 h-5 animate-spin" /> Fetching climate data…
        </div>
      )}

      {error && (
        <div
          className="text-sm px-4 py-3 rounded-lg border"
          role="alert"
          style={{
            background: "rgba(179,38,30,0.08)",
            borderColor: "rgba(179,38,30,0.3)",
            color: "var(--status-critical)",
          }}
        >
          Failed to load climate data: {error}
        </div>
      )}

      {!loading && stats && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {statCards.map(({ label, value, icon: Icon, color }) => (
              <BezelCard key={label} innerClassName="p-4">
                <Icon className="w-4 h-4 mb-2" style={{ color }} />
                <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
                  {label}
                </div>
                <div
                  className="font-bold font-mono tabular-nums text-sm mt-0.5"
                  style={{ color: "var(--text-primary)" }}
                >
                  {value}
                </div>
              </BezelCard>
            ))}
          </div>

          {/* Risk factors */}
          {stats.riskFactors.length > 0 && (
            <div className="space-y-2">
              {stats.riskFactors.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border"
                  style={{
                    background: "rgba(143,90,8,0.08)",
                    borderColor: "rgba(143,90,8,0.25)",
                    color: "var(--status-warning)",
                  }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {f}
                </div>
              ))}
            </div>
          )}

          {viewMode === "table" ? (
            <BezelCard innerClassName="p-5 overflow-x-auto">
              <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                14-Day Agro-Meteorological Telemetry Ledger
              </h2>
              <table
                data-testid="climate-data-table"
                className="w-full text-left text-xs border-collapse font-mono tabular-nums"
              >
                <thead>
                  <tr className="border-b border-[var(--border-default)] text-[var(--text-secondary)]">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Max °C</th>
                    <th className="py-2 pr-4">Min °C</th>
                    <th className="py-2 pr-4">Rain (mm)</th>
                    <th className="py-2 pr-4">ET₀ (mm)</th>
                    <th className="py-2">Balance (mm)</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyChart.map((row) => (
                    <tr
                      key={row.date}
                      className="border-b border-[var(--border-default)]/50 text-[var(--text-primary)]"
                    >
                      <td className="py-2 pr-4">{row.date}</td>
                      <td className="py-2 pr-4">{row.tmax?.toFixed(1)}</td>
                      <td className="py-2 pr-4">{row.tmin?.toFixed(1)}</td>
                      <td className="py-2 pr-4">{row.rain?.toFixed(1)}</td>
                      <td className="py-2 pr-4">{row.et0?.toFixed(1)}</td>
                      <td
                        className="py-2 font-semibold"
                        style={{
                          color:
                            row.balance < 0 ? "var(--status-warning)" : "var(--status-good)",
                        }}
                      >
                        {row.balance >= 0 ? `+${row.balance.toFixed(1)}` : row.balance.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BezelCard>
          ) : (
            <>
              {/* Temperature chart */}
              <BezelCard innerClassName="p-5">
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  Daily Temperature Range (°C)
                </h2>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} unit="°" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="tmax"
                      name="Max °C"
                      stroke="var(--status-warning)"
                      fill="color-mix(in oklab, var(--status-warning) 16%, transparent)"
                      strokeWidth={1.75}
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="tmin"
                      name="Min °C"
                      stroke="var(--status-info)"
                      fill="color-mix(in oklab, var(--status-info) 16%, transparent)"
                      strokeWidth={1.75}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </BezelCard>

              {/* Rainfall vs ET₀ */}
              <BezelCard innerClassName="p-5">
                <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                  Rainfall vs Reference ET₀ (mm/day)
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} unit=" mm" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="rain"
                      name="Rain (mm)"
                      fill="var(--status-info)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="et0"
                      name="ET₀ (mm)"
                      fill="var(--status-warning)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </BezelCard>

              {/* Water balance */}
              <BezelCard innerClassName="p-5">
                <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Daily Water Balance (Rain − ET₀, mm)
                </h2>
                <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                  Negative values indicate net moisture deficit — irrigation required.
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={dailyChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "var(--text-secondary)" }} />
                    <YAxis tick={{ fontSize: 12, fill: "var(--text-secondary)" }} unit=" mm" />
                    <Tooltip
                      contentStyle={{
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Balance (mm)"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </BezelCard>
            </>
          )}

          {historical && (
            <BezelCard data-testid="historical-climate-gateway" innerClassName="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                    REGIONAL CLIMATE ANALYTICS · {historical.startDate} TO {historical.endDate}
                  </span>
                  <h2
                    className="text-base font-semibold mt-0.5"
                    style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
                  >
                    Historical Reanalysis &amp; Risk Trends
                  </h2>
                </div>
                <Badge
                  variant={historical.dataAvailable && !historical.fallback ? "green" : "warning"}
                  label={
                    historical.dataAvailable
                      ? `${historical.dailyObservations.toLocaleString("en-US")} days analyzed`
                      : "Fallback Mode"
                  }
                />
              </div>

              {historicalNote && (
                <p className="text-xs text-[var(--status-warning)]">{historicalNote}</p>
              )}

              {historical.statistics && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs tabular-nums">
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-3">
                    <div className="text-[var(--text-secondary)]">Mean Temp</div>
                    <div className="text-sm font-bold mt-0.5 text-[var(--text-primary)]">
                      {historical.statistics.temperatureC?.mean !== null &&
                      historical.statistics.temperatureC?.mean !== undefined
                        ? `${historical.statistics.temperatureC.mean.toFixed(1)} °C`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-3">
                    <div className="text-[var(--text-secondary)]">Warming Trend</div>
                    <div className="text-sm font-bold mt-0.5 text-[var(--text-primary)]">
                      {historical.statistics.temperatureTrendCPerDecade !== null &&
                      historical.statistics.temperatureTrendCPerDecade !== undefined
                        ? `${historical.statistics.temperatureTrendCPerDecade.toFixed(2)} °C/dec`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-3">
                    <div className="text-[var(--text-secondary)]">Drought Risk</div>
                    <div className="text-sm font-bold mt-0.5 text-[var(--status-warning)]">
                      {historical.statistics.droughtRiskPercent !== null &&
                      historical.statistics.droughtRiskPercent !== undefined
                        ? `${historical.statistics.droughtRiskPercent.toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-raised)] p-3">
                    <div className="text-[var(--text-secondary)]">Heat Stress Risk</div>
                    <div className="text-sm font-bold mt-0.5 text-[var(--status-critical)]">
                      {historical.statistics.heatStressRiskPercent !== null &&
                      historical.statistics.heatStressRiskPercent !== undefined
                        ? `${historical.statistics.heatStressRiskPercent.toFixed(1)}%`
                        : "—"}
                    </div>
                  </div>
                </div>
              )}

              {historical.annualSeries && historical.annualSeries.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono tabular-nums">
                    <thead>
                      <tr className="border-b border-[var(--border-default)] text-[var(--text-secondary)]">
                        <th className="py-2 pr-4">Year</th>
                        <th className="py-2 pr-4">Mean °C</th>
                        <th className="py-2 pr-4">Rainfall (mm)</th>
                        <th className="py-2 pr-4">ET₀ (mm)</th>
                        <th className="py-2">Balance (mm)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historical.annualSeries.slice(-5).map((row) => (
                        <tr
                          key={row.year}
                          className="border-b border-[var(--border-default)]/50 text-[var(--text-primary)]"
                        >
                          <td className="py-1.5 pr-4">{row.year}</td>
                          <td className="py-1.5 pr-4">{row.meanTemperatureC?.toFixed(1) ?? "—"}</td>
                          <td className="py-1.5 pr-4">{row.rainfallTotalMm?.toFixed(0) ?? "—"}</td>
                          <td className="py-1.5 pr-4">{row.referenceEt0Mm?.toFixed(0) ?? "—"}</td>
                          <td className="py-1.5">{row.waterBalanceMm?.toFixed(0) ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {historical.attribution && (
                <p className="text-[11px] text-[var(--text-secondary)]">
                  {historical.attribution}
                </p>
              )}
            </BezelCard>
          )}

          <div
            className="flex items-center justify-between gap-3 pt-2 border-t flex-wrap"
            style={{ borderColor: "var(--border-default)" }}
          >
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Next workflow step: match this climate outlook against suitable seasonal crops.
            </span>
            <Button
              label="Next: Crop Planner"
              href="/recommendations"
              variant="primary"
              size="sm"
              icon={<Sprout className="w-4 h-4" />}
            />
          </div>
        </>
      )}
    </div>
  );
}
