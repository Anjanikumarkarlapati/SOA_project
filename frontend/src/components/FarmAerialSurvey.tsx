"use client";

import React, { useState } from "react";
import { Plane, Sparkles, Info } from "lucide-react";
import { BezelCard } from "@/components/ui/BezelCard";

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

  return (
    <BezelCard innerClassName="flex flex-col gap-4 p-5">
      {/* Interactive Drone Survey Viewer */}
      <div className="photo-frame relative h-[360px] sm:h-[400px] select-none group">
        <img
          src="/images/aerial-farm.jpg"
          alt="High-altitude drone aerial survey of agricultural fields"
          className={`w-full h-full object-cover transition-[filter,transform] duration-500 ${
            ndviOverlay ? "contrast-125 saturate-150 hue-rotate-15" : "photo-duotone"
          }`}
        />

        {/* Top Badges & Controls Overlay */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="pill-btn py-1 px-3 text-[11px] bg-black/72 text-white backdrop-blur-md border border-white/20 flex items-center gap-1.5">
              <Plane className="w-3.5 h-3.5 text-[#DFECC6]" />
              <span>Multi-Spectral Drone Survey</span>
            </span>
            <span className="hidden sm:inline-flex pill-btn py-1 px-2.5 text-[10px] bg-[var(--accent)] text-[var(--on-accent)] backdrop-blur-md border border-[var(--border-default)]">
              Alt 120m &bull; GSD 2.4cm/px
            </span>
          </div>

          <button
            type="button"
            onClick={() => setNdviOverlay(!ndviOverlay)}
            className={`pointer-events-auto pill-btn py-1 px-3 text-xs backdrop-blur-md border transition-colors ${
              ndviOverlay
                ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--border-default)]"
                : "bg-[var(--bg-surface)]/92 text-[var(--text-primary)] border-[var(--border-default)] hover:bg-[var(--bg-surface)]"
            }`}
            title="Toggle simulated NDVI vegetation vigor filter"
          >
            <Sparkles className="w-3 h-3 text-[var(--accent)]" />
            <span className="font-medium">
              {ndviOverlay ? "NDVI Active" : "NDVI Filter"}
            </span>
          </button>
        </div>

        {/* Hotspot Pins on Field */}
        {ZONES.map((zone) => {
          const isSelected = selectedZone.id === zone.id;
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => setSelectedZone(zone)}
              style={{ left: `${zone.xPct}%`, top: `${zone.yPct}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group/pin focus:outline-none"
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
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-transform ${
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

        {/* Bottom Inspector Bar */}
        <div className="absolute bottom-3 left-3 right-3 bg-black/75 text-white backdrop-blur-md p-3 rounded-xl border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{selectedZone.name}</span>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor:
                  selectedZone.status === "ATTENTION"
                    ? "var(--status-warning)"
                    : "var(--status-good)",
                color: "var(--on-accent)",
              }}
            >
              {selectedZone.status}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums text-[#DFECC6]">
            <span>NDVI: {selectedZone.ndvi}</span>
            <span>Moisture: {selectedZone.moisture}%</span>
            <span className="hidden md:inline">Uniformity: 94.6%</span>
          </div>
        </div>
      </div>

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
          <span className="text-lg font-mono tabular-nums text-[var(--text-primary)] font-semibold">
            0.78 / 1.0
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">Dense photosynthetic mass</span>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Field Drainage Slope</span>
          <span className="text-lg font-mono tabular-nums text-[var(--text-primary)] font-semibold">
            1.4% SW
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">Zero ponding hazard</span>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Canopy Uniformity</span>
          <span className="text-lg font-mono tabular-nums text-[var(--text-primary)] font-semibold">
            94.2%
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">Even seed emergence</span>
        </div>

        <div className="p-3 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--text-secondary)]">Water Stress Index</span>
          <span className="text-lg font-mono tabular-nums text-[var(--accent)] font-semibold">
            0.14 CWSI
          </span>
          <span className="text-[10px] text-[var(--text-secondary)]">Normal transpiration</span>
        </div>
      </div>
    </BezelCard>
  );
}
