"use client";

import React, { useState } from "react";
import { Plane, Sparkles, Info, Box, Image as ImageIcon } from "lucide-react";
import { BezelCard } from "@/components/ui/BezelCard";
import { EditorialPhotoFrame } from "@/components/ui/EditorialPhotoFrame";
import { FieldTerrain3D } from "@/components/ui/FieldTerrain3D";

interface ZoneInfo {
  id: string;
  name: string;
  xPct: number;
  yPct: number;
  ndvi: number;
  moisture: number;
  status: "OPTIMAL" | "ATTENTION" | "NORMAL";
  note: string;
}

const ZONES: ZoneInfo[] = [
  {
    id: "zone-1",
    name: "Zone Alpha (North Furrow)",
    xPct: 32,
    yPct: 38,
    ndvi: 0.82,
    moisture: 66,
    status: "OPTIMAL",
    note: "Vigorous vegetative tillering. Zero chlorophyll degradation detected.",
  },
  {
    id: "zone-2",
    name: "Zone Beta (Canal Inflow Corridor)",
    xPct: 68,
    yPct: 45,
    ndvi: 0.79,
    moisture: 72,
    status: "NORMAL",
    note: "Optimal moisture along natural drainage gradient. Rapid nutrient diffusion.",
  },
  {
    id: "zone-3",
    name: "Zone Gamma (South Ridge)",
    xPct: 54,
    yPct: 75,
    ndvi: 0.69,
    moisture: 51,
    status: "ATTENTION",
    note: "Lower soil moisture retention. Recommended for 20-min evening micro-drip.",
  },
];

interface FarmAerialSurveyProps {
  farmName: string;
  cropName: string;
  areaHectares: number;
}

export function FarmAerialSurvey({
  farmName,
  cropName,
  areaHectares,
}: FarmAerialSurveyProps) {
  const [selectedZone, setSelectedZone] = useState<ZoneInfo>(ZONES[0]);
  const [ndviOverlay, setNdviOverlay] = useState(false);
  const [viewMode, setViewMode] = useState<"photo" | "terrain3d">("photo");

  return (
    <BezelCard innerClassName="flex flex-col gap-4 p-5">
      {/* Interactive Drone Survey Viewer */}
      <EditorialPhotoFrame
        innerClassName="h-[360px] sm:h-[420px] select-none"
        lightbox={
          viewMode === "photo"
            ? {
                src: "/images/aerial-farm.jpg",
                alt: "High-altitude drone aerial survey of agricultural fields",
                caption: `${farmName} · ${cropName} (${areaHectares} ha) — ${selectedZone.name} (NDVI ${selectedZone.ndvi.toFixed(2)}, ${selectedZone.moisture}% moisture)`,
              }
            : undefined
        }
        topLeft={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/70 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
              <Plane className="w-3.5 h-3.5 text-[#DFECC6]" />
              <span>Multi-spectral drone survey</span>
            </span>
            <span className="hidden sm:inline-flex rounded-full border border-white/20 bg-[var(--accent)]/90 px-2.5 py-1 font-mono text-[11px] tabular-nums text-[var(--on-accent)] backdrop-blur-md">
              Alt 120 m · 2.4 cm/px
            </span>
          </>
        }
        topRight={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              data-testid="toggle-terrain-3d"
              onClick={() => setViewMode((m) => (m === "photo" ? "terrain3d" : "photo"))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-[background-color,color,border-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-[0.98] ${
                viewMode === "terrain3d"
                  ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--border-default)]"
                  : "bg-[var(--bg-surface)]/92 text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--bg-surface)]"
              }`}
              title="Switch between 2D drone photography and 3D React Three Fiber moisture terrain"
            >
              {viewMode === "terrain3d" ? (
                <ImageIcon className="w-3.5 h-3.5" />
              ) : (
                <Box className="w-3.5 h-3.5 text-[var(--accent)]" />
              )}
              <span>{viewMode === "terrain3d" ? "2D aerial" : "3D terrain"}</span>
            </button>

            {viewMode === "photo" && (
              <button
                type="button"
                onClick={() => setNdviOverlay(!ndviOverlay)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold backdrop-blur-md transition-[background-color,color,border-color,transform] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] active:scale-[0.98] ${
                  ndviOverlay
                    ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--border-default)]"
                    : "bg-[var(--bg-surface)]/92 text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--bg-surface)]"
                }`}
                title="Toggle simulated NDVI vegetation vigor filter"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>{ndviOverlay ? "NDVI active" : "NDVI filter"}</span>
              </button>
            )}
          </div>
        }
        caption={
          <>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-white">
                {farmName} · {cropName} ({areaHectares} ha)
              </p>
              <p className="truncate text-[11px] text-white/80">
                Inspecting {selectedZone.name}
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/25 bg-black/65 px-2.5 py-1 font-mono text-[11px] tabular-nums text-[#DFECC6] backdrop-blur-sm">
              NDVI {selectedZone.ndvi.toFixed(2)} · {selectedZone.moisture}% moisture
            </span>
          </>
        }
      >
        {viewMode === "terrain3d" ? (
          <FieldTerrain3D
            zones={ZONES}
            selectedZoneId={selectedZone.id}
            moistureAvg={Math.round(
              ZONES.reduce((acc, z) => acc + z.moisture, 0) / ZONES.length
            )}
          />
        ) : (
          <>
            <img
              src="/images/aerial-farm.jpg"
              alt="High-altitude drone aerial survey of agricultural fields"
              className={`w-full h-full object-cover transition-[filter,transform] duration-500 ${
                ndviOverlay ? "contrast-125 saturate-150 hue-rotate-15" : "photo-duotone"
              }`}
            />

            {/* Hotspot Pins on Field */}
            {ZONES.map((zone) => {
              const isSelected = selectedZone.id === zone.id;
              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setSelectedZone(zone)}
                  style={{ left: `${zone.xPct}%`, top: `${zone.yPct}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group/pin focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white rounded-full"
                  title={`${zone.name} — Click to inspect`}
                >
                  <div className="relative flex items-center justify-center">
                    <span
                      className={`w-8 h-8 rounded-full absolute zone-pulse ${
                        zone.status === "ATTENTION"
                          ? "bg-[var(--status-warning)]/40"
                          : "bg-[var(--accent)]/40"
                      }`}
                    />
                    <div
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-mono font-medium transition-transform ${
                        isSelected
                          ? "scale-125 bg-[var(--accent)] text-[var(--on-accent)] border-[var(--on-accent)]"
                          : "bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--accent)] hover:scale-110"
                      }`}
                    >
                      {zone.id.replace("zone-", "Z")}
                    </div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </EditorialPhotoFrame>

      {/* Selected Zone Notes & Farm Spatial Analytics */}
      <div className="bg-[var(--bg-raised)] p-4 rounded-xl border border-[var(--border-default)] flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Zone Agronomic Analysis ({selectedZone.id.toUpperCase()})</span>
          </span>
          <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
            {farmName} &bull; {cropName} ({areaHectares} Ha)
          </span>
        </div>
        <p className="text-[var(--text-secondary)] leading-relaxed">
          {selectedZone.note}
        </p>
      </div>

      {/* Spatial Telemetry Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Mean Canopy NDVI</span>
          <span className="type-kpi-sm text-lg">
            0.78 / 1.0
          </span>
          <span className="type-caption !text-[var(--text-secondary)]">Dense photosynthetic mass</span>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Field Drainage Slope</span>
          <span className="type-kpi-sm text-lg">
            1.4% SW
          </span>
          <span className="type-caption !text-[var(--text-secondary)]">Zero ponding hazard</span>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Canopy Uniformity</span>
          <span className="type-kpi-sm text-lg">
            94.2%
          </span>
          <span className="type-caption !text-[var(--text-secondary)]">Even seed emergence</span>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Water Stress Index</span>
          <span className="type-kpi-sm text-lg !text-[var(--accent)]">
            0.14 CWSI
          </span>
          <span className="type-caption !text-[var(--text-secondary)]">Normal transpiration</span>
        </div>
      </div>
    </BezelCard>
  );
}
