export type FpoParcelStatus = "SAFE" | "CAUTION" | "HOLD";

export interface FpoParcelInput {
  id: string;
  farmerName: string;
  village: string;
  cropName: string;
  areaHa: number;
  waterSavedLitres: number;
  soilMoisturePct: number;
  windKmh: number;
  rainProbPct: number;
  status?: FpoParcelStatus;
  anomalyNote?: string;
}

export interface FpoAnomaly {
  parcelId: string;
  farmerName: string;
  village: string;
  cropName: string;
  status: "CAUTION" | "HOLD";
  reason: string;
}

export interface FpoResolvedParcel extends FpoParcelInput {
  resolvedStatus: FpoParcelStatus;
  resolvedReason: string;
}

export interface FpoBroadcastSummary {
  parcelCount: number;
  cappedCount: number;
  totalAreaHa: number;
  totalWaterSavedLitres: number;
  healthyCount: number;
  cautionCount: number;
  holdCount: number;
  anomalies: FpoAnomaly[];
  parcels: FpoResolvedParcel[];
  whatsappBroadcastText: string;
  generatedAtIso: string;
}

export const MAX_FPO_PARCELS = 50;

const LANG_GREETINGS: Record<string, { header: string; savedLabel: string; holdLabel: string; cautionLabel: string; safeLabel: string; crewAction: string }> = {
  hi: {
    header: "FPO सुबह FieldShield बुलेटिन",
    savedLabel: "कुल जल बचत",
    holdLabel: "रोक (HOLD)",
    cautionLabel: "सावधानी (CAUTION)",
    safeLabel: "सुरक्षित (SAFE)",
    crewAction: "HOLD पार्सल पर वाल्व और छिड़काव रोकें; सामान्य पार्सल पर 06:00 बजे शेड्यूल चलाएं।",
  },
  or: {
    header: "FPO ସକାଳ FieldShield ବୁଲେଟିନ୍",
    savedLabel: "ମୋଟ ଜଳ ସଞ୍ଚୟ",
    holdLabel: "ରୋକ (HOLD)",
    cautionLabel: "ସତର୍କତା (CAUTION)",
    safeLabel: "ସୁରକ୍ଷିତ (SAFE)",
    crewAction: "HOLD ଜମିରେ ସ୍ପ୍ରେ ଏବଂ ଜଳସେଚନ ବନ୍ଦ ରଖନ୍ତୁ।",
  },
  te: {
    header: "FPO ఉదయం FieldShield బులెటిన్",
    savedLabel: "మొత్తం నీటి పొదుపు",
    holdLabel: "నిలిపివేత (HOLD)",
    cautionLabel: "జాగ్రత్త (CAUTION)",
    safeLabel: "సురక్షితం (SAFE)",
    crewAction: "HOLD ప్లాట్లలో స్ప్రే మరియు నీటిపారుదల ఆపండి.",
  },
};

function resolveParcelStatus(parcel: FpoParcelInput): {
  resolvedStatus: FpoParcelStatus;
  resolvedReason: string;
} {
  if (parcel.status) {
    const defaultNote =
      parcel.status === "HOLD"
        ? `Rain ${Math.round(parcel.rainProbPct)}% / moisture ${Math.round(parcel.soilMoisturePct)}%`
        : parcel.status === "CAUTION"
          ? `Wind ${Math.round(parcel.windKmh)} km/h / moisture ${Math.round(parcel.soilMoisturePct)}%`
          : "Optimal root-zone & wind window";
    return {
      resolvedStatus: parcel.status,
      resolvedReason: parcel.anomalyNote?.trim() || defaultNote,
    };
  }

  if (parcel.rainProbPct >= 50 || parcel.soilMoisturePct > 85) {
    const reasons: string[] = [];
    if (parcel.rainProbPct >= 50) reasons.push(`Rain ${Math.round(parcel.rainProbPct)}%`);
    if (parcel.soilMoisturePct > 85) reasons.push(`Moisture ${Math.round(parcel.soilMoisturePct)}%`);
    return {
      resolvedStatus: "HOLD",
      resolvedReason: parcel.anomalyNote?.trim() || `${reasons.join(" · ")} — hold valve & spray`,
    };
  }

  if (parcel.windKmh >= 20 || parcel.soilMoisturePct < 30) {
    const reasons: string[] = [];
    if (parcel.windKmh >= 20) reasons.push(`Wind ${Math.round(parcel.windKmh)} km/h`);
    if (parcel.soilMoisturePct < 30) reasons.push(`Dry soil ${Math.round(parcel.soilMoisturePct)}%`);
    return {
      resolvedStatus: "CAUTION",
      resolvedReason: parcel.anomalyNote?.trim() || `${reasons.join(" · ")} — adjust timing`,
    };
  }

  return {
    resolvedStatus: "SAFE",
    resolvedReason: parcel.anomalyNote?.trim() || "Normal moisture & low drift",
  };
}

/**
 * Pools up to 50 FPO member parcels into morning water-saved totals,
 * anomaly alerts, and a concise WhatsApp crew broadcast message.
 */
export function buildFpoBroadcastSummary(
  parcels: FpoParcelInput[],
  lang = "en"
): FpoBroadcastSummary {
  const capped = parcels.slice(0, MAX_FPO_PARCELS);
  const resolved: FpoResolvedParcel[] = [];
  const anomalies: FpoAnomaly[] = [];

  let totalWaterSavedLitres = 0;
  let totalAreaHa = 0;
  let healthyCount = 0;
  let cautionCount = 0;
  let holdCount = 0;

  for (const parcel of capped) {
    const safeWater =
      Number.isFinite(parcel.waterSavedLitres) && parcel.waterSavedLitres > 0
        ? Math.round(parcel.waterSavedLitres)
        : 0;
    const safeArea =
      Number.isFinite(parcel.areaHa) && parcel.areaHa > 0 ? parcel.areaHa : 0;

    totalWaterSavedLitres += safeWater;
    totalAreaHa += safeArea;

    const { resolvedStatus, resolvedReason } = resolveParcelStatus(parcel);
    resolved.push({
      ...parcel,
      waterSavedLitres: safeWater,
      areaHa: safeArea,
      resolvedStatus,
      resolvedReason,
    });

    if (resolvedStatus === "SAFE") {
      healthyCount += 1;
    } else if (resolvedStatus === "CAUTION") {
      cautionCount += 1;
      anomalies.push({
        parcelId: parcel.id,
        farmerName: parcel.farmerName,
        village: parcel.village,
        cropName: parcel.cropName,
        status: "CAUTION",
        reason: resolvedReason,
      });
    } else {
      holdCount += 1;
      anomalies.push({
        parcelId: parcel.id,
        farmerName: parcel.farmerName,
        village: parcel.village,
        cropName: parcel.cropName,
        status: "HOLD",
        reason: resolvedReason,
      });
    }
  }

  const locale = LANG_GREETINGS[lang] ?? {
    header: "FPO Morning FieldShield Brief",
    savedLabel: "Pooled Water Saved",
    holdLabel: "HOLD",
    cautionLabel: "CAUTION",
    safeLabel: "SAFE",
    crewAction: "Hold valves & spraying on HOLD parcels; run 06:00 AM schedule on SAFE plots.",
  };

  const anomalyLines = anomalies
    .slice(0, 5)
    .map((a) => `- [${a.status}] ${a.farmerName} (${a.village}, ${a.cropName}): ${a.reason}`);

  const lines: string[] = [
    `*${locale.header}* (${capped.length} parcels · ${totalAreaHa.toFixed(1)} ha)`,
    `${locale.savedLabel}: ${totalWaterSavedLitres.toLocaleString("en-IN")} L`,
    `${locale.safeLabel}: ${healthyCount} · ${locale.cautionLabel}: ${cautionCount} · ${locale.holdLabel}: ${holdCount}`,
  ];

  if (anomalyLines.length > 0) {
    lines.push("Alerts:");
    lines.push(...anomalyLines);
    if (anomalies.length > 5) {
      lines.push(`+ ${anomalies.length - 5} more alert(s) in FPO board`);
    }
  }

  lines.push(locale.crewAction);

  return {
    parcelCount: capped.length,
    cappedCount: capped.length,
    totalAreaHa: Number(totalAreaHa.toFixed(2)),
    totalWaterSavedLitres,
    healthyCount,
    cautionCount,
    holdCount,
    anomalies,
    parcels: resolved,
    whatsappBroadcastText: lines.join("\n"),
    generatedAtIso: new Date().toISOString(),
  };
}

export interface PropertySeedInput {
  id: string;
  name: string;
  selectedCropId?: string;
  areaHa?: number;
  region?: string;
  country?: string;
}

const DEMO_FARMER_NAMES = [
  "Sita Devi",
  "Ramesh Das",
  "Harpreet Kaur",
  "Lakshmi Narayana",
  "Bikash Mohanty",
  "Anita Patel",
  "Suresh Reddy",
  "Kamala Behera",
  "Gurmeet Singh",
  "Padma Rao",
];

const DEMO_VILLAGES = [
  "Salepur",
  "Athagarh",
  "Tenali",
  "Mangalagiri",
  "Banki",
  "Niali",
  "Ponnur",
  "Jagraon",
];

const DEMO_CROPS = ["Rice (Paddy)", "Wheat", "Chilli", "Cotton", "Tomato", "Turmeric"];

/**
 * Seeds a 50-parcel FPO cluster starting from the farmer's live properties
 * plus deterministic demo member parcels when fewer than targetCount exist.
 */
export function buildDemoFpoClusterParcels(
  userProperties: PropertySeedInput[],
  targetCount = MAX_FPO_PARCELS
): FpoParcelInput[] {
  const cap = Math.min(MAX_FPO_PARCELS, Math.max(1, targetCount));
  const result: FpoParcelInput[] = userProperties.slice(0, cap).map((prop, index) => ({
    id: prop.id,
    farmerName: prop.name,
    village: prop.country || prop.region || "Home Cluster",
    cropName: prop.selectedCropId || "Rice (Paddy)",
    areaHa: prop.areaHa && prop.areaHa > 0 ? prop.areaHa : 1.8,
    waterSavedLitres: 2600 + index * 350,
    soilMoisturePct: 58,
    windKmh: 9,
    rainProbPct: 18,
  }));

  for (let i = result.length; i < cap; i++) {
    const idx = i + 1;
    const isHold = idx % 11 === 0;
    const isCaution = !isHold && idx % 7 === 0;
    result.push({
      id: `FPO-PARCEL-${String(idx).padStart(2, "0")}`,
      farmerName: `${DEMO_FARMER_NAMES[i % DEMO_FARMER_NAMES.length]} #${idx}`,
      village: DEMO_VILLAGES[i % DEMO_VILLAGES.length],
      cropName: DEMO_CROPS[i % DEMO_CROPS.length],
      areaHa: Number((1.1 + ((i * 3) % 19) * 0.15).toFixed(1)),
      waterSavedLitres: 1400 + ((i * 275) % 2800),
      soilMoisturePct: isHold ? 88 : isCaution ? 27 : 54 + (i % 18),
      windKmh: isHold ? 14 : isCaution ? 23 : 7 + (i % 9),
      rainProbPct: isHold ? 68 : isCaution ? 28 : 12 + (i % 20),
    });
  }

  return result;
}
