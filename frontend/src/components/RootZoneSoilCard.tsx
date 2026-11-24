"use client";

import React from "react";
import {
  Sprout,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  Droplets,
} from "lucide-react";
import type { CropProfile } from "@/lib/crops";
import { BezelCard } from "@/components/ui/BezelCard";

interface RootZoneSoilCardProps {
  crop: CropProfile;
  soilMoisturePct: number;
  soilTempC: number;
}

export function RootZoneSoilCard({
  crop,
  soilMoisturePct,
  soilTempC,
}: RootZoneSoilCardProps) {
  const [minOpt, maxOpt] = crop.optimalSoilMoisture;
  const isOptimalMoisture =
    soilMoisturePct >= minOpt && soilMoisturePct <= maxOpt;
  const isDry = soilMoisturePct < minOpt;

  const clampedMoisture = Math.min(Math.max(soilMoisturePct, 5), 95);

  return (
    <BezelCard innerClassName="p-5 sm:p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-xl font-serif-display text-[var(--text-primary)]">
              In-Situ Root-Zone Telemetry &amp; Soil Health
            </h3>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Continuous dielectric capacitance measurements at active root depth (0–10cm layer).
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--accent)] bg-[var(--accent-wash)] text-[11px] font-medium text-[var(--text-primary)] self-start sm:self-auto">
          <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span>Probe Calibrated (Mineral Loam)</span>
        </div>
      </div>

      {/* Grid: Photo on Left, Metrics & Gauge on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Photo Container */}
        <div className="md:col-span-5 flex flex-col gap-2">
          <div className="photo-frame relative h-52 sm:h-56 group">
            <img
              src="/images/soil-sensing.jpg"
              alt="Macro photograph of fertile loam soil with emergent sprout and dielectric soil probe"
              className="w-full h-full object-cover photo-duotone"
            />
            <div className="absolute bottom-2 left-2 right-2 bg-black/75 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/20 text-[11px] text-white flex items-center justify-between">
              <span className="font-mono">Sensor #SZ-04: 6cm Depth</span>
              <span className="text-[#DFECC6]">Active Telemetry</span>
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-secondary)] italic">
            Micro-texture analysis confirms well-aerated crumb structure with adequate organic humic fractions.
          </p>
        </div>

        {/* Diagnostics & Visual Gauge */}
        <div className="md:col-span-7 flex flex-col gap-4">
          {/* Numerical highlights */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/60 flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center justify-between">
                <span>Volumetric Moisture</span>
                <Droplets className="w-3.5 h-3.5 text-[var(--accent)]" />
              </span>
              <span className="text-2xl font-mono tabular-nums text-[var(--text-primary)] font-bold">
                {soilMoisturePct}%
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                Target: {minOpt}% &ndash; {maxOpt}% Vol.
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/60 flex flex-col gap-1">
              <span className="text-xs text-[var(--text-secondary)] font-medium flex items-center justify-between">
                <span>Root Zone Temperature</span>
                <Thermometer className="w-3.5 h-3.5 text-[var(--accent)]" />
              </span>
              <span className="text-2xl font-mono tabular-nums text-[var(--text-primary)] font-bold">
                {soilTempC.toFixed(1)} °C
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                Opt: {crop.optimalSoilTemp[0]}–{crop.optimalSoilTemp[1]} °C
              </span>
            </div>
          </div>

          {/* Interactive Visual Soil Hydration Zone Bar */}
          <div className="bg-[var(--bg-raised)] p-4 rounded-xl border border-[var(--border-default)] flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Soil Hydration State Matrix
              </span>
              <span
                className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: isOptimalMoisture
                    ? "var(--accent)"
                    : isDry
                      ? "var(--status-warning)"
                      : "var(--status-info)",
                  color: "var(--on-accent)",
                }}
              >
                {isOptimalMoisture
                  ? "Optimal Root Pocket"
                  : isDry
                    ? "Water Deficit Stress"
                    : "Field Saturation"}
              </span>
            </div>

            {/* Custom Multi-Zone Gauge Bar */}
            <div className="relative pt-3 pb-1">
              <div
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-[left] duration-500 z-10"
                style={{ left: `${clampedMoisture}%` }}
              >
                <div className="bg-[var(--text-primary)] text-[var(--bg-base)] text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded">
                  {soilMoisturePct}%
                </div>
                <div
                  className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[5px]"
                  style={{ borderTopColor: "var(--text-primary)" }}
                />
              </div>

              <div className="h-3.5 w-full rounded-full flex overflow-hidden border border-[var(--border-strong)]/40 bg-[var(--accent-wash)]">
                <div
                  className="w-[20%] bg-[var(--status-warning)]/40 border-r border-[var(--border-strong)]/30"
                  title="Wilting Point (<20%)"
                />
                <div
                  className="w-[30%] bg-[var(--accent-brass)]/40 border-r border-[var(--border-strong)]/30"
                  title="Stress Zone (20-50%)"
                />
                <div
                  className="w-[25%] bg-[var(--accent)] border-r border-[var(--border-strong)]/30"
                  title="Optimal Growth (50-75%)"
                />
                <div
                  className="w-[25%] bg-[var(--status-info)]/40"
                  title="Saturation (>75%)"
                />
              </div>
            </div>

            {/* Scale Labels */}
            <div className="flex justify-between text-[10px] font-mono tabular-nums text-[var(--text-secondary)] px-1">
              <span>0% Wilting</span>
              <span>20% Stress</span>
              <span className="font-bold text-[var(--text-primary)]">
                {minOpt}–{maxOpt}% Optimal
              </span>
              <span>80%+ Saturation</span>
            </div>
          </div>

          {/* Practical Agronomic Action Tip */}
          <div className="text-xs text-[var(--text-secondary)] flex items-start gap-2 bg-[var(--bg-raised)]/50 p-3 rounded-lg border border-[var(--border-default)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <span>
              <strong className="text-[var(--text-primary)]">Agronomist Guidance:</strong>{" "}
              {isOptimalMoisture
                ? `Soil moisture of ${soilMoisturePct}% provides ideal tension for ${crop.name} root hair nutrient assimilation. No emergency irrigation needed.`
                : isDry
                  ? `Soil is below target threshold (${minOpt}%). Apply scheduled drip cycle during lower ET₀ hours.`
                  : `Moisture is elevated. Ensure furrows are free of blockages to protect root zone aeration.`}
            </span>
          </div>
        </div>
      </div>
    </BezelCard>
  );
}
