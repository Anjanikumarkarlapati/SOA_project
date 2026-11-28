import { INDIAN_STATES, getDistrictsForState } from "@/lib/indian-locations";

export type BreakEvenVerdict = "SELL_NOW" | "HOLD" | "WATCH";

export interface BreakEvenResult {
  breakEvenPerQuintal: number;
  netModalPerQuintal: number;
  profitPerQuintal: number;
  marginPercent: number;
  verdict: BreakEvenVerdict;
}

export interface MspBenchmark {
  crop: string;
  season: "Kharif" | "Rabi" | "Horticulture";
  mspInr: number | null;
  unit: "₹/quintal";
  note: string;
}

export interface MandiRateRow extends Record<string, unknown> {
  id: string;
  stateCode: string;
  districtName: string;
  mandiName: string;
  source: "e-NAM" | "AGMARKNET APMC";
  crop: string;
  variety: string;
  minPriceInr: number;
  modalPriceInr: number;
  maxPriceInr: number;
  mspInr: number | null;
  mspDeltaInr: number | null;
  arrivalTonnes: number;
  distanceKm: number;
  updatedAt: string;
}

export const MSP_BENCHMARKS_2025_26: MspBenchmark[] = [
  { crop: "Paddy", season: "Kharif", mspInr: 2369, unit: "₹/quintal", note: "Common Grade (2025-26)" },
  { crop: "Wheat", season: "Rabi", mspInr: 2425, unit: "₹/quintal", note: "FAQ (2025-26)" },
  { crop: "Maize", season: "Kharif", mspInr: 2400, unit: "₹/quintal", note: "FAQ (2025-26)" },
  { crop: "Mustard", season: "Rabi", mspInr: 5950, unit: "₹/quintal", note: "Rapeseed & Mustard (2025-26)" },
  { crop: "Cotton", season: "Kharif", mspInr: 7710, unit: "₹/quintal", note: "Medium Staple (2025-26)" },
  { crop: "Groundnut", season: "Kharif", mspInr: 7263, unit: "₹/quintal", note: "In shell (2025-26)" },
  { crop: "Soybean", season: "Kharif", mspInr: 5328, unit: "₹/quintal", note: "Yellow (2025-26)" },
  { crop: "Tur/Arhar", season: "Kharif", mspInr: 8000, unit: "₹/quintal", note: "FAQ (2025-26)" },
  { crop: "Onion", season: "Horticulture", mspInr: null, unit: "₹/quintal", note: "Market-linked (TOP)" },
  { crop: "Tomato", season: "Horticulture", mspInr: null, unit: "₹/quintal", note: "Market-linked (TOP)" },
  { crop: "Potato", season: "Horticulture", mspInr: null, unit: "₹/quintal", note: "Market-linked (TOP)" },
];

const BASE_CROP_BANDS: Record<
  string,
  { variety: string; modal: number; spread: number; arrivals: number }
> = {
  Paddy: { variety: "Swarna / Common", modal: 2420, spread: 140, arrivals: 64 },
  Wheat: { variety: "HD-2967 / Sharbati", modal: 2560, spread: 130, arrivals: 82 },
  Maize: { variety: "Hybrid Yellow", modal: 2340, spread: 150, arrivals: 38 },
  Mustard: { variety: "Black Sarson", modal: 6180, spread: 260, arrivals: 29 },
  Cotton: { variety: "MCU-5 / Shankar-6", modal: 7940, spread: 340, arrivals: 44 },
  Groundnut: { variety: "G-20 Bold", modal: 7180, spread: 320, arrivals: 25 },
  Soybean: { variety: "JS-335 Yellow", modal: 5190, spread: 240, arrivals: 51 },
  "Tur/Arhar": { variety: "Red Whole FAQ", modal: 8280, spread: 380, arrivals: 19 },
  Onion: { variety: "Nasik Red", modal: 2150, spread: 420, arrivals: 96 },
  Tomato: { variety: "Desi / Hybrid", modal: 1840, spread: 360, arrivals: 58 },
  Potato: { variety: "Jyoti / Kufri", modal: 1620, spread: 240, arrivals: 110 },
};

const STATE_CROP_AFFINITY: Record<string, string[]> = {
  OD: ["Paddy", "Groundnut", "Tur/Arhar", "Maize", "Mustard", "Onion", "Tomato", "Potato", "Cotton"],
  AP: ["Paddy", "Cotton", "Groundnut", "Maize", "Tur/Arhar", "Tomato", "Onion"],
  PB: ["Wheat", "Paddy", "Cotton", "Maize", "Potato", "Mustard", "Onion"],
  MH: ["Onion", "Cotton", "Soybean", "Tur/Arhar", "Tomato", "Maize", "Wheat"],
  UP: ["Wheat", "Paddy", "Potato", "Mustard", "Maize", "Tur/Arhar", "Onion"],
  MP: ["Soybean", "Wheat", "Mustard", "Maize", "Tur/Arhar", "Onion", "Potato"],
  TN: ["Paddy", "Groundnut", "Cotton", "Maize", "Tomato", "Onion"],
  KA: ["Maize", "Tur/Arhar", "Groundnut", "Paddy", "Cotton", "Tomato", "Onion"],
  GJ: ["Groundnut", "Cotton", "Onion", "Potato", "Wheat", "Mustard"],
  WB: ["Paddy", "Potato", "Mustard", "Tomato", "Maize", "Onion"],
  KL: ["Paddy", "Tomato", "Onion", "Potato"],
  RJ: ["Mustard", "Wheat", "Cotton", "Soybean", "Groundnut", "Onion"],
  HR: ["Wheat", "Paddy", "Mustard", "Cotton", "Potato"],
  BR: ["Paddy", "Wheat", "Maize", "Potato", "Onion", "Tomato"],
  TS: ["Paddy", "Cotton", "Maize", "Tur/Arhar", "Groundnut", "Soybean", "Tomato"],
};

const STATE_PRICE_MODIFIERS: Record<string, number> = {
  OD: 0.98,
  AP: 1.03,
  PB: 1.02,
  MH: 1.04,
  UP: 0.99,
  MP: 0.97,
  TN: 1.05,
  KA: 1.02,
  GJ: 1.03,
  WB: 1.01,
  KL: 1.08,
  RJ: 1.0,
  HR: 1.02,
  BR: 0.97,
  TS: 1.02,
};

function finiteOrZero(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

export function formatInr(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";
  const rounded = Math.round(amount);
  const absFormatted = Math.abs(rounded).toLocaleString("en-IN");
  return rounded < 0 ? `-₹${absFormatted}` : `₹${absFormatted}`;
}

export function calculateBreakEven(
  inputCostPerAcre: number,
  expectedYieldQuintals: number,
  modalPriceInr: number,
  transportPerQuintal: number
): BreakEvenResult {
  const safeCost = Math.max(0, finiteOrZero(inputCostPerAcre));
  const safeYield = finiteOrZero(expectedYieldQuintals);
  const safeModal = Math.max(0, finiteOrZero(modalPriceInr));
  const safeTransport = Math.max(0, finiteOrZero(transportPerQuintal));
  const netModalPerQuintal = Math.round(Math.max(0, safeModal - safeTransport));

  if (safeYield <= 0) {
    return {
      breakEvenPerQuintal: 0,
      netModalPerQuintal,
      profitPerQuintal: 0,
      marginPercent: 0,
      verdict: "HOLD",
    };
  }

  const breakEvenPerQuintal = Math.round(safeCost / safeYield);
  const profitPerQuintal = netModalPerQuintal - breakEvenPerQuintal;
  const marginPercent =
    breakEvenPerQuintal > 0
      ? Math.round((profitPerQuintal / breakEvenPerQuintal) * 1000) / 10
      : netModalPerQuintal > 0
        ? 100
        : 0;

  const healthyThreshold = Math.max(100, Math.round(breakEvenPerQuintal * 0.1));
  const verdict: BreakEvenVerdict =
    profitPerQuintal >= healthyThreshold
      ? "SELL_NOW"
      : profitPerQuintal >= 0
        ? "WATCH"
        : "HOLD";

  return {
    breakEvenPerQuintal,
    netModalPerQuintal,
    profitPerQuintal,
    marginPercent,
    verdict,
  };
}

function deterministicOffset(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997;
  }
  return ((hash % 11) - 5) * 15;
}

export function getMandiRatesForLocation(
  stateCode: string,
  districtName?: string,
  crop?: string
): MandiRateRow[] {
  const normalizedState = stateCode.trim().toUpperCase() || "OD";
  const stateObj = INDIAN_STATES.find((s) => s.code === normalizedState) ?? INDIAN_STATES[0];
  const districts = getDistrictsForState(stateObj.code);
  const requestedDistrict = districtName?.trim();
  const primaryDistrict =
    districts.find((d) => d.name.toLowerCase() === requestedDistrict?.toLowerCase())?.name ??
    districts[0]?.name ??
    "Cuttack";
  const secondaryDistrict = districts.find((d) => d.name !== primaryDistrict)?.name ?? primaryDistrict;

  const modifier = STATE_PRICE_MODIFIERS[stateObj.code] ?? 1;
  const preferredCrops = STATE_CROP_AFFINITY[stateObj.code] ?? Object.keys(BASE_CROP_BANDS);
  const allCropNames = [
    ...preferredCrops,
    ...Object.keys(BASE_CROP_BANDS).filter((c) => !preferredCrops.includes(c)),
  ];

  const normalizedCrop = crop?.trim();
  const cropsToBuild =
    normalizedCrop && normalizedCrop.toUpperCase() !== "ALL"
      ? allCropNames.filter((c) => c.toLowerCase() === normalizedCrop.toLowerCase())
      : allCropNames;

  const targetCrops = cropsToBuild.length > 0 ? cropsToBuild : allCropNames;
  const updatedAt = new Date().toISOString().slice(0, 10) + "T06:00:00.000Z";
  const rows: MandiRateRow[] = [];

  targetCrops.forEach((cropName, idx) => {
    const band = BASE_CROP_BANDS[cropName] ?? BASE_CROP_BANDS.Paddy;
    const mspObj = MSP_BENCHMARKS_2025_26.find((b) => b.crop === cropName);
    const mspInr = mspObj?.mspInr ?? null;

    const districtForRow = idx % 3 === 2 ? secondaryDistrict : primaryDistrict;
    const isEnam = idx % 2 === 0;
    const jitter = deterministicOffset(`${stateObj.code}-${districtForRow}-${cropName}`);
    const modalPriceInr = Math.max(
      400,
      Math.round((band.modal * modifier + jitter) / 5) * 5
    );
    const minPriceInr = Math.max(300, modalPriceInr - band.spread);
    const maxPriceInr = modalPriceInr + Math.round(band.spread * 0.95);
    const yardSuffix = isEnam ? "e-NAM Mandi Yard" : "APMC Krishi Yard";

    rows.push({
      id: `${stateObj.code}-${districtForRow.replace(/\s+/g, "-")}-${cropName.replace(/[^a-zA-Z0-9]/g, "")}`,
      stateCode: stateObj.code,
      districtName: districtForRow,
      mandiName: `${districtForRow} ${yardSuffix}`,
      source: isEnam ? "e-NAM" : "AGMARKNET APMC",
      crop: cropName,
      variety: band.variety,
      minPriceInr,
      modalPriceInr,
      maxPriceInr,
      mspInr,
      mspDeltaInr: mspInr !== null ? modalPriceInr - mspInr : null,
      arrivalTonnes: Math.max(8, band.arrivals + ((idx * 7) % 25) - 10),
      distanceKm: districtForRow === primaryDistrict ? 6 + (idx % 4) * 4 : 34 + (idx % 3) * 8,
      updatedAt,
    });
  });

  if (normalizedCrop && normalizedCrop.toUpperCase() !== "ALL" && rows.length === 1) {
    const base = rows[0];
    const altModal = Math.round((base.modalPriceInr * 1.03) / 5) * 5;
    rows.push({
      ...base,
      id: `${base.id}-regional`,
      districtName: secondaryDistrict,
      mandiName: `${secondaryDistrict} ${base.source === "e-NAM" ? "APMC Yard" : "e-NAM Hub"}`,
      source: base.source === "e-NAM" ? "AGMARKNET APMC" : "e-NAM",
      minPriceInr: Math.max(300, altModal - 160),
      modalPriceInr: altModal,
      maxPriceInr: altModal + 180,
      mspDeltaInr: base.mspInr !== null ? altModal - base.mspInr : null,
      distanceKm: 38,
    });
  }

  return rows;
}
