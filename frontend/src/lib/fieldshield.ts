// lib/fieldshield.ts — Pure agronomic water budget, valve interlock & vernacular briefing engines

export interface WaterBudgetInput {
  areaHa: number;
  todayEt0: number;
  todayRainMm: number;
  kc: number;
  irrigationType: string;
  pumpFlowLpm: number;
}

export interface WaterBudgetResult {
  etcMm: number;
  grossLitres: number;
  effectiveRainCreditLitres: number;
  netDeliveryLitres: number;
  efficiency: number;
  recommendedMinutes: number;
}

export interface ValveInterlockInput {
  rainProbMax: number;
  todayRainMm: number;
  currentWindKmh: number;
  soilMoisturePct: number;
  optimalMoistureRange: [number, number];
  waterBudgetLitres: number;
}

export interface ValveInterlockDecision {
  triggered: boolean;
  severity: "ok" | "caution" | "hold";
  reasons: string[];
  estimatedWasteLitres: number;
}

export interface VernacularShiftBriefingInput {
  farmName: string;
  cropName: string;
  priorityZone: string;
  netLitres: number;
  recommendedMinutes: number;
  spraySafe: boolean;
  topTasks: string[];
  language: string;
  t: (key: string, fallback?: string) => string;
}

const IRRIGATION_EFFICIENCY: Record<string, number> = {
  drip: 0.9,
  sprinkler: 0.75,
  flood: 0.55,
  rainfed: 1.0,
  none: 1.0,
};

function nonNeg(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function computeWaterBudget(input: WaterBudgetInput): WaterBudgetResult {
  const safeAreaHa = nonNeg(input.areaHa);
  const safeEt0 = nonNeg(input.todayEt0);
  const safeRainMm = nonNeg(input.todayRainMm);
  const safeKc = nonNeg(input.kc);
  const safePumpFlow = nonNeg(input.pumpFlowLpm);

  const typeKey = input.irrigationType.trim().toLowerCase();
  const efficiency = IRRIGATION_EFFICIENCY[typeKey] ?? 0.75;
  const etcMm = Number((safeEt0 * safeKc).toFixed(2));

  if (safeAreaHa === 0) {
    return {
      etcMm,
      grossLitres: 0,
      effectiveRainCreditLitres: 0,
      netDeliveryLitres: 0,
      efficiency,
      recommendedMinutes: 0,
    };
  }

  // 1 mm across 1 hectare = 10,000 litres; matches climate.ts effective rain (>5mm * 0.8)
  const grossLitres = Math.round(safeEt0 * safeKc * safeAreaHa * 10000);
  const effectiveRainMm = safeRainMm > 5 ? safeRainMm * 0.8 : 0;
  const effectiveRainCreditLitres = Math.round(effectiveRainMm * safeAreaHa * 10000);
  const netCropNeedLitres = Math.max(0, grossLitres - effectiveRainCreditLitres);
  const netDeliveryLitres = Math.round(netCropNeedLitres / efficiency);
  const recommendedMinutes =
    safePumpFlow > 0 && netDeliveryLitres > 0
      ? Math.round(netDeliveryLitres / safePumpFlow)
      : 0;

  return {
    etcMm,
    grossLitres,
    effectiveRainCreditLitres,
    netDeliveryLitres,
    efficiency,
    recommendedMinutes,
  };
}

export function evaluateValveInterlock(input: ValveInterlockInput): ValveInterlockDecision {
  const reasons: string[] = [];
  let hasHold = false;
  let hasCaution = false;

  const rainProb = Number.isFinite(input.rainProbMax) ? input.rainProbMax : 0;
  const rainMm = Number.isFinite(input.todayRainMm) ? input.todayRainMm : 0;
  const windKmh = Number.isFinite(input.currentWindKmh) ? input.currentWindKmh : 0;
  const moisture = Number.isFinite(input.soilMoisturePct) ? input.soilMoisturePct : 0;
  const maxOptimalMoisture = Number.isFinite(input.optimalMoistureRange[1])
    ? input.optimalMoistureRange[1]
    : 100;
  const budgetLitres = nonNeg(input.waterBudgetLitres);

  if (rainProb >= 50) {
    hasHold = true;
    reasons.push(`Rain probability ${Math.round(rainProb)}% (>= 50% threshold)`);
  }
  if (rainMm >= 10) {
    hasHold = true;
    reasons.push(`Rainfall ${rainMm.toFixed(1)} mm (>= 10 mm threshold)`);
  }
  if (moisture > maxOptimalMoisture) {
    hasHold = true;
    reasons.push(
      `Root-zone soil moisture ${Math.round(moisture)}% exceeds optimal ceiling ${Math.round(maxOptimalMoisture)}%`
    );
  }
  if (windKmh >= 20) {
    hasCaution = true;
    reasons.push(`Wind ${Math.round(windKmh)} km/h increases drift and evaporative loss`);
  }

  const severity: ValveInterlockDecision["severity"] = hasHold
    ? "hold"
    : hasCaution
      ? "caution"
      : "ok";

  const estimatedWasteLitres =
    severity === "hold"
      ? Math.round(budgetLitres)
      : severity === "caution"
        ? Math.round(budgetLitres * 0.25)
        : 0;

  return {
    triggered: severity !== "ok",
    severity,
    reasons,
    estimatedWasteLitres,
  };
}

export function buildVernacularShiftBriefing(input: VernacularShiftBriefingInput): string {
  const {
    farmName,
    cropName,
    priorityZone,
    netLitres,
    recommendedMinutes,
    spraySafe,
    topTasks,
    language,
    t,
  } = input;

  const safeLitres = Math.max(0, Math.round(Number.isFinite(netLitres) ? netLitres : 0));
  const safeMinutes = Math.max(
    0,
    Math.round(Number.isFinite(recommendedMinutes) ? recommendedMinutes : 0)
  );

  const lines: string[] = [
    `${t("briefing.title", "FieldShield Shift Brief")} [${language.toUpperCase()}]`,
    `${t("briefing.farmLabel", "Farm")}: ${farmName}`,
    `${t("briefing.cropLabel", "Crop")}: ${cropName}`,
    `${t("briefing.priorityZone", "Priority Zone")}: ${priorityZone}`,
  ];

  if (safeLitres > 0) {
    lines.push(
      `${t("briefing.irrigationTarget", "Irrigation Target")}: ${safeLitres.toLocaleString("en-US")} L (${t("briefing.runtimeLabel", "Runtime")}: ${safeMinutes} min)`
    );
  } else {
    lines.push(
      `${t("briefing.irrigationTarget", "Irrigation Target")}: ${t("briefing.irrigationHold", "Hold irrigation — moisture/rain sufficient")}`
    );
  }

  lines.push(
    `${t("briefing.sprayStatus", "Spray Window")}: ${
      spraySafe
        ? t("briefing.spraySafe", "Safe for spraying")
        : t("briefing.sprayHold", "Hold spraying")
    }`
  );

  lines.push(`${t("briefing.tasksHeading", "Top Tasks")}:`);
  if (topTasks.length === 0) {
    lines.push(`1. ${t("briefing.noTasks", "No pending tasks")}`);
  } else {
    topTasks.forEach((task, idx) => {
      lines.push(`${idx + 1}. ${task}`);
    });
  }

  return lines.join("\n");
}
