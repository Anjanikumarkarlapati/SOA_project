"use client";

import React, { useState } from "react";
import {
  Droplets,
  Sprout,
  Bug,
  Wind,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Tractor,
  Printer,
  FileCheck,
} from "lucide-react";
import type { FarmerRecommendations } from "@/lib/climate";
import { useLanguage } from "@/lib/i18n";
import { useFarmStore, getActiveProperty } from "@/lib/property-store";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { EditorialPhotoFrame } from "@/components/ui/EditorialPhotoFrame";

interface FarmerRecommendationCardProps {
  recommendations: FarmerRecommendations;
  className?: string;
}

export function FarmerRecommendationCard({
  recommendations,
  className = "",
}: FarmerRecommendationCardProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<
    "irrigation" | "protection" | "soil" | "fertilizer" | "checklist"
  >("irrigation");

  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const checklistByFarm = useFarmStore((s) => s.checklistByFarm);
  const toggleChecklistTask = useFarmStore((s) => s.toggleChecklistTask);

  const activeFarm = getActiveProperty({ properties, activePropertyId });
  const farmKey = activeFarm?.id ?? "farm-default";
  const persistedMap = checklistByFarm[farmKey] ?? {};

  const checklist = recommendations.dailyChecklist.map((item) => ({
    ...item,
    completed: persistedMap[item.id] ?? item.completed,
  }));

  const toggleChecklist = (id: string) => {
    toggleChecklistTask(farmKey, id);
  };

  const {
    crop,
    date,
    overallStatus,
    overallSummary,
    irrigation,
    soilHealth,
    cropProtection,
    sprayingAdvisory,
    fertilizerAdvisory,
    extremeWeatherAlerts,
  } = recommendations;

  const statusLabel =
    overallStatus === "OPTIMAL"
      ? t("advisory.statusOptimal", "Optimal Growing Conditions")
      : overallStatus === "ATTENTION"
        ? t("advisory.statusAttention", "Action Required Today")
        : t("advisory.statusCritical", "Critical Crop Warning");

  const statusTone =
    overallStatus === "OPTIMAL"
      ? {
          text: "text-[var(--text-primary)]",
          bg: "bg-[var(--accent-wash)]",
          border: "border-[var(--accent)]",
          label: statusLabel,
          Icon: ShieldCheck,
        }
      : overallStatus === "ATTENTION"
        ? {
            text: "text-[var(--status-warning)]",
            bg: "bg-[var(--bg-raised)]",
            border: "border-[var(--status-warning)]",
            label: statusLabel,
            Icon: AlertTriangle,
          }
        : {
            text: "text-[var(--status-critical)]",
            bg: "bg-[var(--status-critical)]/10",
            border: "border-[var(--status-critical)]",
            label: statusLabel,
            Icon: ShieldAlert,
          };

  return (
    <BezelCard
      className={className}
      innerClassName="p-6 sm:p-7 flex flex-col gap-6"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[var(--border-default)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sprout className="w-6 h-6 text-[var(--accent)]" aria-hidden="true" />
            <h2 className="text-2xl font-serif-display text-[var(--text-primary)]">
              {t("advisory.title", "Farmer's Field Advisory")} &bull; {crop.name}
            </h2>
          </div>
          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-2 flex-wrap">
            <Calendar className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums">{date}</span>
            <span>&bull;</span>
            <span>
              {t("advisory.category", "Category")}: {crop.category.toUpperCase()}
            </span>
            <span>&bull;</span>
            <span className="font-mono tabular-nums">
              {t("advisory.growthCycle", "Growth Cycle")}: ~{crop.growDays} days
            </span>
          </p>
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium ${statusTone.bg} ${statusTone.border} ${statusTone.text}`}
        >
          <statusTone.Icon className="w-4 h-4" />
          <span>{statusTone.label}</span>
        </div>
      </div>

      {/* Visual Field Scouting Editorial Card (Zero-Human crop-canopy.webp) */}
      <EditorialPhotoFrame
        innerClassName="h-52 sm:h-56 select-none"
        topRight={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/65 px-3 py-1 text-[11px] font-medium text-white backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-[#DFECC6]" />
            <span>FAO-56 validated</span>
          </span>
        }
        caption={
          <div>
            <span className="block text-[11px] font-medium text-[#DFECC6]">
              Agronomic field observation
            </span>
            <h4 className="font-serif-display text-lg sm:text-xl text-white">
              In-Situ Crop Scouting &amp; Advisory Protocol
            </h4>
          </div>
        }
      >
        <img
          src="/images/crop-canopy.webp"
          alt="Sunlit golden-green cultivated wheat ears and terraced crop furrows in morning mist"
          className="w-full h-full object-cover photo-duotone"
        />
      </EditorialPhotoFrame>

      {/* Phenological Crop Growth Stage Visualizer */}
      <div className="bg-[var(--bg-raised)] p-3.5 rounded-xl border border-[var(--border-default)] flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--text-primary)]">
            Active Phenological Phase &amp; Crop Stage
          </span>
          <span className="font-mono tabular-nums text-[11px] text-[var(--text-secondary)]">
            Kc Mid: {crop.kc[1]} &bull; High Transpiration
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
          <div className="p-1.5 rounded-lg bg-[var(--accent-wash)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            1. Germination
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--accent)] text-[var(--on-accent)] font-medium border border-[var(--accent)]">
            2. Tillering (Active)
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            3. Heading / Flower
          </div>
          <div className="p-1.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-secondary)]">
            4. Ripening
          </div>
        </div>
      </div>

      {/* Extreme Weather Warnings */}
      {extremeWeatherAlerts.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {extremeWeatherAlerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border text-xs flex flex-col gap-1.5 ${
                alert.level === "CRITICAL"
                  ? "bg-[var(--status-critical)]/10 border-[var(--status-critical)]/40 text-[var(--text-primary)]"
                  : "bg-[var(--status-warning)]/10 border-[var(--status-warning)]/40 text-[var(--text-primary)]"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle
                  className={`w-4 h-4 ${
                    alert.level === "CRITICAL"
                      ? "text-[var(--status-critical)]"
                      : "text-[var(--status-warning)]"
                  }`}
                />
                <span>{alert.title}</span>
              </div>
              <p className="text-[var(--text-primary)]/90">{alert.description}</p>
              <div className="text-[11px] font-medium text-[var(--text-secondary)] bg-[var(--bg-surface)]/80 p-2 rounded-lg border border-[var(--border-default)]">
                <strong className="text-[var(--text-primary)]">
                  {t("advisory.fieldAction", "Field Action:")}
                </strong>{" "}
                {alert.mitigation}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Note */}
      <div className="bg-[var(--bg-raised)] p-4 rounded-2xl border border-[var(--border-default)] text-xs text-[var(--text-primary)] leading-relaxed">
        <strong>
          {t("advisory.dailyIntelligence", "Daily Agronomic Intelligence:")}
        </strong>{" "}
        {overallSummary}
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-default)] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("irrigation")}
          className={`pill-btn text-xs py-1.5 px-3.5 ${
            activeTab === "irrigation" ? "pill-btn-primary" : "pill-btn-secondary"
          }`}
        >
          <Droplets className="w-3.5 h-3.5" />
          <span>{t("tab.irrigation", "Water & Irrigation")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("soil")}
          className={`pill-btn text-xs py-1.5 px-3.5 ${
            activeTab === "soil" ? "pill-btn-primary" : "pill-btn-secondary"
          }`}
        >
          <Sprout className="w-3.5 h-3.5" />
          <span>{t("tab.soil", "Soil & Operations")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("protection")}
          className={`pill-btn text-xs py-1.5 px-3.5 ${
            activeTab === "protection" ? "pill-btn-primary" : "pill-btn-secondary"
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          <span>{t("tab.protection", "Pest & Disease")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fertilizer")}
          className={`pill-btn text-xs py-1.5 px-3.5 ${
            activeTab === "fertilizer" ? "pill-btn-primary" : "pill-btn-secondary"
          }`}
        >
          <FlaskConical className="w-3.5 h-3.5" />
          <span>{t("tab.fertilizer", "Nutrition & Spray")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("checklist")}
          className={`pill-btn text-xs py-1.5 px-3.5 ${
            activeTab === "checklist" ? "pill-btn-primary" : "pill-btn-secondary"
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>
            {t("tab.checklist", "Field Tasks")} (
            {checklist.filter((c) => c.completed).length}/{checklist.length})
          </span>
        </button>
      </div>

      {/* TAB CONTENT 1: WATER & IRRIGATION */}
      {activeTab === "irrigation" && (
        <div className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("irrigation.demand", "Crop Demand (ETc)")}
              </span>
              <span className="text-xl font-mono tabular-nums text-[var(--text-primary)]">
                {irrigation.cropWaterNeedMm} mm
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                ~{irrigation.cropWaterNeedLitres.toLocaleString()} Litres
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("irrigation.rainCredit", "Effective Rain Credit")}
              </span>
              <span className="text-xl font-mono tabular-nums text-[var(--text-primary)]">
                {irrigation.effectiveRainMm} mm
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                {t("irrigation.naturalRecharge", "Natural soil recharge")}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--accent-wash)] flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("irrigation.netNeed", "Net Water To Deliver")}
              </span>
              <span className="text-xl font-mono tabular-nums text-[var(--accent)] font-bold">
                {irrigation.netIrrigationNeedMm} mm
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                ~{irrigation.netIrrigationNeedLitres.toLocaleString()} Litres
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("irrigation.window", "Irrigation Window")}
              </span>
              <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-[var(--accent)]" />
                {irrigation.recommendedWindow}
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Minimizes evaporative loss
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <strong className="text-sm text-[var(--text-primary)]">
                {t("irrigation.directive", "Scheduled Irrigation Directive:")}
              </strong>
              <span className="pill-btn pill-btn-primary text-[11px] py-1 px-3">
                {irrigation.status}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {irrigation.action}
            </p>
            <div className="text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-default)]">
              <strong className="text-[var(--text-primary)]">
                {t("irrigation.tip", "Water Efficiency Tip:")}
              </strong>{" "}
              {irrigation.efficiencyTip}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: SOIL HEALTH & TRAFFICABILITY */}
      {activeTab === "soil" && (
        <div className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("soil.surface", "Topsoil Moisture (0-1cm)")}
              </span>
              <span className="text-xl font-mono tabular-nums text-[var(--text-primary)]">
                {soilHealth.surfaceMoisturePct}%
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                Optimal target: {crop.optimalSoilMoisture[0]}–{crop.optimalSoilMoisture[1]}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("soil.rootZone", "Root-Zone Moisture")}
              </span>
              <span className="text-xl font-mono tabular-nums text-[var(--text-primary)]">
                {soilHealth.rootZoneMoisturePct}%
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Status: {soilHealth.moistureStatus}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/50 flex flex-col gap-1">
              <span className="text-[var(--text-secondary)] font-medium">
                {t("soil.temp", "Soil Temperature")}
              </span>
              <span className="text-xl font-mono tabular-nums text-[var(--text-primary)]">
                {soilHealth.soilTempC.toFixed(1)} °C
              </span>
              <span className="text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
                Optimal: {crop.optimalSoilTemp[0]}–{crop.optimalSoilTemp[1]} °C
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/40 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Tractor className="w-4 h-4 text-[var(--accent)]" />
              <strong className="text-sm text-[var(--text-primary)]">
                {t("soil.trafficability", "Machinery & Tractor Trafficability:")}
              </strong>
              <span className="pill-btn pill-btn-secondary text-[11px] py-0.5 px-2.5">
                {soilHealth.trafficability}
              </span>
            </div>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {soilHealth.soilAdvisory}
            </p>
            <div className="text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-default)]">
              <strong className="text-[var(--text-primary)]">
                {t("soil.ph", "Optimal Soil pH:")}
              </strong>{" "}
              {crop.soilPH[0]} &ndash; {crop.soilPH[1]} &bull; Suitable for {crop.notes}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: PEST & DISEASE */}
      {activeTab === "protection" && (
        <div className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-[var(--status-warning)]" />
                  <strong className="text-sm text-[var(--text-primary)]">
                    {t("protection.diseaseRisk", "Fungal / Disease Risk")}
                  </strong>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                    cropProtection.diseaseRisk === "HIGH" ||
                    cropProtection.diseaseRisk === "CRITICAL"
                      ? "bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                      : cropProtection.diseaseRisk === "MODERATE"
                        ? "bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                        : "bg-[var(--accent-wash)] text-[var(--text-primary)]"
                  }`}
                >
                  {cropProtection.diseaseRisk} RISK
                </span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {cropProtection.diseaseAdvisory}
              </p>
              <div className="pt-2 border-t border-[var(--border-default)]">
                <span className="text-[11px] font-medium text-[var(--text-primary)]">
                  {t("protection.pathogens", "Susceptible Pathogens:")}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {cropProtection.diseasesAtRisk.map((d, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-[var(--bg-raised)] text-[10px] text-[var(--text-secondary)] border border-[var(--border-default)]"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Bug className="w-4 h-4 text-[var(--accent)]" />
                  <strong className="text-sm text-[var(--text-primary)]">
                    {t("protection.pestRisk", "Insect & Pest Activity")}
                  </strong>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                    cropProtection.pestRisk === "HIGH"
                      ? "bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                      : "bg-[var(--accent-wash)] text-[var(--text-primary)]"
                  }`}
                >
                  {cropProtection.pestRisk} RISK
                </span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {cropProtection.pestAdvisory}
              </p>
              <div className="pt-2 border-t border-[var(--border-default)]">
                <span className="text-[11px] font-medium text-[var(--text-primary)]">
                  {t("protection.pestWatchlist", "Target Pest Watchlist:")}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {cropProtection.pestsAtRisk.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full bg-[var(--bg-raised)] text-[10px] text-[var(--text-secondary)] border border-[var(--border-default)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: NUTRITION & SPRAY ADVISORY */}
      {activeTab === "fertilizer" && (
        <div className="flex flex-col gap-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-[var(--accent)]" />
                  <strong className="text-sm text-[var(--text-primary)]">
                    {t("spray.foliar", "Foliar Spraying Condition")}
                  </strong>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-medium text-[11px] ${
                    sprayingAdvisory.isSafeToSpray
                      ? "bg-[var(--accent)] text-[var(--on-accent)]"
                      : "bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                  }`}
                >
                  {sprayingAdvisory.isSafeToSpray
                    ? t("spray.safe", "Safe to Spray")
                    : t("spray.hold", "Hold Spraying")}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {sprayingAdvisory.guidance}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-default)] text-[11px]">
                <div>
                  <span className="text-[var(--text-secondary)]">
                    {t("spray.windDrift", "Wind Drift:")}
                  </span>
                  <p className="font-mono tabular-nums text-[var(--text-primary)]">
                    {sprayingAdvisory.windStatus}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">
                    {t("spray.washOff", "Wash-off Risk:")}
                  </span>
                  <p className="font-mono tabular-nums text-[var(--text-primary)]">
                    {sprayingAdvisory.rainRisk}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/40 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4 text-[var(--accent)]" />
                  <strong className="text-sm text-[var(--text-primary)]">
                    {t("spray.nutrition", "Soil Nutrition Scheduling")}
                  </strong>
                </div>
                <span className="pill-btn pill-btn-secondary text-[11px] py-0.5 px-2.5">
                  {fertilizerAdvisory.status}
                </span>
              </div>
              <p className="text-[var(--text-secondary)] leading-relaxed">
                {fertilizerAdvisory.guidance}
              </p>
              <div className="text-[11px] text-[var(--text-secondary)] pt-2 border-t border-[var(--border-default)]">
                <strong className="text-[var(--text-primary)]">
                  {t("spray.advice", "Agronomist Advice:")}
                </strong>{" "}
                Apply fertilizer when soil moisture is around 50–70% to facilitate nutrient ion diffusion to root hairs.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: DAILY CHECKLIST */}
      {activeTab === "checklist" && (
        <div className="flex flex-col gap-2.5 text-xs">
          <p className="text-[var(--text-secondary)] mb-1">
            Prioritized tasks for today based on real-time field data and the 7-day agro-meteorological forecast:
          </p>
          {checklist.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleChecklist(item.id)}
              className={`p-3 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                item.completed
                  ? "bg-[var(--accent-wash)] border-[var(--accent)] opacity-85"
                  : "bg-[var(--bg-surface)] border-[var(--border-default)] hover:bg-[var(--bg-raised)]"
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleChecklist(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-4 h-4 rounded text-[var(--accent)] focus:ring-[var(--accent)] cursor-pointer"
                />
                <span
                  className={`text-xs ${
                    item.completed
                      ? "line-through text-[var(--text-secondary)]"
                      : "text-[var(--text-primary)] font-medium"
                  }`}
                >
                  {item.task}
                </span>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  item.priority === "HIGH"
                    ? "bg-[var(--status-critical)]/15 text-[var(--status-critical)]"
                    : item.priority === "MEDIUM"
                      ? "bg-[var(--status-warning)]/15 text-[var(--status-warning)]"
                      : "bg-[var(--accent-wash)] text-[var(--text-secondary)]"
                }`}
              >
                {item.priority}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Official Advisory Export & Print Action */}
      <div className="pt-4 border-t border-[var(--border-default)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs no-print">
        <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[var(--text-secondary)]">
          <FileCheck className="w-4 h-4 text-[var(--accent)]" />
          <span>Report Generated: {date} &bull; Model v3.4</span>
        </div>
        <Button
          label="Print / Export Advisory PDF"
          variant="secondary"
          size="sm"
          icon={<Printer className="w-3.5 h-3.5 text-[var(--accent)]" />}
          onClick={() => window.print()}
          tooltip="Print or save PDF of this field advisory"
        />
      </div>
    </BezelCard>
  );
}
