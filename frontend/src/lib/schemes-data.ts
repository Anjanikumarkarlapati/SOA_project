export type FarmerCategory = "small_marginal" | "other";

export interface PmksyEstimate {
  baseSystemCostInr: number;
  subsidyPercent: number;
  centralSharePercent: number;
  stateTopUpPercent: number;
  subsidyAmountInr: number;
  netFarmerCostInr: number;
}

export interface PmfbyDeadlineStatus {
  deadlineIso: string;
  remainingMs: number;
  remainingHours: number;
  isExpired: boolean;
  isUrgent: boolean;
}

export interface PmfbyLossEvidencePack {
  id: string;
  farmId: string;
  cropName: string;
  lossCause: string;
  incidentIso: string;
  lat: number;
  lon: number;
  mediaIds: string[];
  notes?: string;
  createdAt: string;
  synced: boolean;
}

export interface AgristackChecklistItem {
  id: string;
  title: string;
  description: string;
  requiredDoc: string;
}

export interface AgriSchemeEntry {
  id: string;
  name: string;
  scope: "central" | "state";
  stateCode?: string;
  category: "income_insurance" | "water_soil" | "agristack_credit";
  benefitSummary: string;
  eligibility: string;
  helpline: string;
  officialUrl: string;
}

const PMFBY_STORAGE_KEY = "agritech-pmfby-v1";
const BASE_DRIP_COST_PER_ACRE_INR = 45_000;
const PMFBY_WINDOW_MS = 72 * 3600_000;

const STATE_PMKSY_TOPUPS: Record<string, { small_marginal: number; other: number }> = {
  AP: { small_marginal: 35, other: 25 },
  TS: { small_marginal: 35, other: 25 },
  TN: { small_marginal: 35, other: 30 },
  KA: { small_marginal: 35, other: 25 },
  GJ: { small_marginal: 25, other: 20 },
  MH: { small_marginal: 25, other: 20 },
  HR: { small_marginal: 25, other: 15 },
  OD: { small_marginal: 20, other: 15 },
  RJ: { small_marginal: 20, other: 15 },
  BR: { small_marginal: 20, other: 15 },
  KL: { small_marginal: 20, other: 15 },
  MP: { small_marginal: 15, other: 10 },
  UP: { small_marginal: 15, other: 10 },
  WB: { small_marginal: 15, other: 10 },
  PB: { small_marginal: 0, other: 0 },
};

export function estimatePmksySubsidy(
  landAcres: number,
  farmerCategory: FarmerCategory,
  stateCode: string
): PmksyEstimate {
  const safeAcres = Number.isFinite(landAcres) && landAcres > 0 ? landAcres : 0;
  const centralSharePercent = farmerCategory === "small_marginal" ? 55 : 45;
  const normalizedState = stateCode.trim().toUpperCase();
  const topUpTable = STATE_PMKSY_TOPUPS[normalizedState];
  const rawTopUp = topUpTable ? topUpTable[farmerCategory] : 0;
  const maxAllowed = 90;
  const stateTopUpPercent = Math.max(0, Math.min(rawTopUp, maxAllowed - centralSharePercent));
  const subsidyPercent = centralSharePercent + stateTopUpPercent;

  const baseSystemCostInr = Math.round(safeAcres * BASE_DRIP_COST_PER_ACRE_INR);
  const subsidyAmountInr = Math.round((baseSystemCostInr * subsidyPercent) / 100);
  const netFarmerCostInr = Math.max(0, baseSystemCostInr - subsidyAmountInr);

  return {
    baseSystemCostInr,
    subsidyPercent,
    centralSharePercent,
    stateTopUpPercent,
    subsidyAmountInr,
    netFarmerCostInr,
  };
}

export function computePmfbyDeadline(
  incidentIso: string,
  nowMs: number = Date.now()
): PmfbyDeadlineStatus {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const parsedIncident = Date.parse(incidentIso);
  const incidentMs = Number.isFinite(parsedIncident) ? parsedIncident : safeNow;
  const deadlineMs = incidentMs + PMFBY_WINDOW_MS;
  const remainingMs = Math.max(0, deadlineMs - safeNow);
  const remainingHours = Math.round((remainingMs / 3600_000) * 10) / 10;
  const isExpired = safeNow >= deadlineMs;
  const isUrgent = !isExpired && remainingMs < 24 * 3600_000;

  return {
    deadlineIso: new Date(deadlineMs).toISOString(),
    remainingMs,
    remainingHours,
    isExpired,
    isUrgent,
  };
}

function sanitizePack(pack: PmfbyLossEvidencePack): PmfbyLossEvidencePack {
  return {
    id: String(pack.id),
    farmId: String(pack.farmId),
    cropName: String(pack.cropName),
    lossCause: String(pack.lossCause),
    incidentIso: String(pack.incidentIso),
    lat: Number.isFinite(pack.lat) ? pack.lat : 0,
    lon: Number.isFinite(pack.lon) ? pack.lon : 0,
    mediaIds: Array.isArray(pack.mediaIds)
      ? pack.mediaIds.map(String).filter((id) => !id.startsWith("data:"))
      : [],
    notes: pack.notes ? String(pack.notes) : undefined,
    createdAt: String(pack.createdAt),
    synced: Boolean(pack.synced),
  };
}

export function loadPmfbyPacks(farmId?: string): PmfbyLossEvidencePack[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PMFBY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const packs = parsed
      .filter((item): item is PmfbyLossEvidencePack => Boolean(item && typeof item.id === "string"))
      .map(sanitizePack);
    return farmId ? packs.filter((p) => p.farmId === farmId) : packs;
  } catch {
    return [];
  }
}

export function savePmfbyPack(pack: PmfbyLossEvidencePack): PmfbyLossEvidencePack[] {
  const clean = sanitizePack(pack);
  if (typeof window === "undefined") return [clean];
  const existing = loadPmfbyPacks();
  const next = [clean, ...existing.filter((p) => p.id !== clean.id)].slice(0, 50);
  try {
    window.localStorage.setItem(PMFBY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage quota errors; IndexedDB retains blobs
  }
  return next;
}

export const AGRISTACK_CHECKLIST_ITEMS: AgristackChecklistItem[] = [
  {
    id: "agristack-farmer-id",
    title: "Generate 11-digit AgriStack Farmer ID",
    description: "Link Aadhaar with state Bhulekh/land records at CSC or state Farmer Registry.",
    requiredDoc: "Aadhaar + Mobile OTP",
  },
  {
    id: "agristack-ror-verify",
    title: "Verify Khata / Survey Plot (RoR)",
    description: "Confirm digital Record of Rights area matches actual sown parcel boundary.",
    requiredDoc: "Patta / 7-12 / Khatauni",
  },
  {
    id: "agristack-ekyc-dbt",
    title: "Complete Aadhaar e-KYC & NPCI DBT Seeding",
    description: "Required for uninterrupted PM-KISAN ₹2,000 tranches and PMFBY claim payouts.",
    requiredDoc: "Bank Passbook (NPCI active)",
  },
  {
    id: "agristack-soil-health",
    title: "Attach Soil Health Card Profile",
    description: "Link NPK + pH test lab ID to unlock balanced urea/DAP subsidy advisories.",
    requiredDoc: "SHC Sample ID",
  },
  {
    id: "agristack-kcc-crop",
    title: "Update Seasonal Digital Crop Survey (e-Panta / Girdawari)",
    description: "Confirm current Kharif/Rabi crop so KCC 4% interest subvention and MSP sales qualify.",
    requiredDoc: "Sown Crop Photo / Survey ID",
  },
];

const CENTRAL_SCHEMES: AgriSchemeEntry[] = [
  {
    id: "pm-kisan",
    name: "PM-KISAN Samman Nidhi",
    scope: "central",
    category: "income_insurance",
    benefitSummary: "₹6,000/year in three ₹2,000 DBT instalments for cultivable landholders.",
    eligibility: "Landholding farmer families with completed Aadhaar e-KYC & DBT bank seeding.",
    helpline: "155261 / 1800-11-5526",
    officialUrl: "https://pmkisan.gov.in",
  },
  {
    id: "pmfby",
    name: "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
    scope: "central",
    category: "income_insurance",
    benefitSummary: "Crop loss cover (2% Kharif, 1.5% Rabi, 5% commercial); 72-hr localized loss window.",
    eligibility: "Loanee & non-loanee farmers including sharecroppers and tenant cultivators.",
    helpline: "14447",
    officialUrl: "https://pmfby.gov.in",
  },
  {
    id: "kcc",
    name: "Kisan Credit Card (KCC) & Modified Interest Subvention",
    scope: "central",
    category: "agristack_credit",
    benefitSummary: "Short-term crop loans up to ₹3 lakh at effective 4% p.a. on timely repayment.",
    eligibility: "Farmers, tenant cultivators, and FPO members with AgriStack / land records.",
    helpline: "1800-180-1551",
    officialUrl: "https://www.myscheme.gov.in",
  },
  {
    id: "pmksy",
    name: "PMKSY — Per Drop More Crop (Micro-Irrigation)",
    scope: "central",
    category: "water_soil",
    benefitSummary: "55% central subsidy for small/marginal farmers and 45% for other farmers on drip/sprinkler.",
    eligibility: "Farmers installing approved drip or sprinkler sets on registered parcels.",
    helpline: "1800-180-1551",
    officialUrl: "https://pmksy.gov.in",
  },
  {
    id: "soil-health-card",
    name: "Soil Health Card (SHC) Mission",
    scope: "central",
    category: "water_soil",
    benefitSummary: "Free 12-parameter soil nutrient & pH testing with crop-wise fertilizer dosage.",
    eligibility: "All farm holdings across India; samples collected per 2-year cycle.",
    helpline: "1800-180-1551",
    officialUrl: "https://soilhealth.dac.gov.in",
  },
  {
    id: "agristack",
    name: "AgriStack 11-Digit Digital Farmer Registry",
    scope: "central",
    category: "agristack_credit",
    benefitSummary: "Single verified digital Farmer ID for paperless KCC, MSP procurement, and PM-KISAN.",
    eligibility: "All cultivators with Aadhaar and state land/crop registry verification.",
    helpline: "1800-180-1551",
    officialUrl: "https://agristack.gov.in",
  },
];

const STATE_SCHEMES: Record<string, AgriSchemeEntry[]> = {
  OD: [
    {
      id: "od-cm-kisan",
      name: "CM-KISAN (Odisha) / KALIA Assistance",
      scope: "state",
      stateCode: "OD",
      category: "income_insurance",
      benefitSummary: "₹4,000/year in two instalments (₹2,000 Kharif + ₹2,000 Rabi) plus Krushak Samridhi paddy bonus.",
      eligibility: "Small, marginal, and landless agricultural households in Odisha.",
      helpline: "1800-345-7100",
      officialUrl: "https://cmkisan.odisha.gov.in",
    },
    {
      id: "od-go-sugam",
      name: "Odisha GO-SUGAM Micro-Irrigation & Mechanization",
      scope: "state",
      stateCode: "OD",
      category: "water_soil",
      benefitSummary: "Up to 75% combined drip/sprinkler support with 20% state top-up over PMKSY.",
      eligibility: "Odisha farmers registered on Krushak Odisha portal.",
      helpline: "155333",
      officialUrl: "https://sugam.odisha.gov.in",
    },
  ],
  AP: [
    {
      id: "ap-annadata-sukhibhava",
      name: "Annadata Sukhibhava & AP Crop Insurance",
      scope: "state",
      stateCode: "AP",
      category: "income_insurance",
      benefitSummary: "State investment support paired with e-Karshak / PMFBY crop loss coverage.",
      eligibility: "Andhra Pradesh landowners & CCRC tenant cultivators with e-Panta crop booking.",
      helpline: "155251",
      officialUrl: "https://karshak.ap.gov.in",
    },
    {
      id: "ap-apmip",
      name: "APMIP Micro-Irrigation Subsidy Top-Up",
      scope: "state",
      stateCode: "AP",
      category: "water_soil",
      benefitSummary: "Up to 90% total subsidy for SC/ST & small/marginal farmers in Andhra Pradesh.",
      eligibility: "AP farmers with borewell/canal source registered via Rythu Seva Kendra.",
      helpline: "155251",
      officialUrl: "https://apmip.ap.gov.in",
    },
  ],
  PB: [
    {
      id: "pb-dsr-incentive",
      name: "Punjab Direct Seeding of Rice (DSR) & Stubble Incentive",
      scope: "state",
      stateCode: "PB",
      category: "water_soil",
      benefitSummary: "₹1,500/acre water-saving incentive for DSR paddy and CRM machinery subsidy.",
      eligibility: "Punjab farmers verified on Anaaj Kharid & AgriMachineryPB portals.",
      helpline: "1800-180-1551",
      officialUrl: "https://agri.punjab.gov.in",
    },
  ],
  MH: [
    {
      id: "mh-namo-shetkari",
      name: "Namo Shetkari Mahasanman Nidhi Yojana",
      scope: "state",
      stateCode: "MH",
      category: "income_insurance",
      benefitSummary: "Additional ₹6,000/year state DBT over PM-KISAN (total ₹12,000/year).",
      eligibility: "PM-KISAN eligible farmers in Maharashtra via MahaDBT.",
      helpline: "1800-120-8040",
      officialUrl: "https://mahadbt.maharashtra.gov.in",
    },
  ],
  MP: [
    {
      id: "mp-kisan-kalyan",
      name: "Mukhyamantri Kisan Kalyan Yojana",
      scope: "state",
      stateCode: "MP",
      category: "income_insurance",
      benefitSummary: "₹6,000/year state support in addition to PM-KISAN.",
      eligibility: "PM-KISAN beneficiaries in Madhya Pradesh.",
      helpline: "181",
      officialUrl: "https://saara.mp.gov.in",
    },
  ],
  WB: [
    {
      id: "wb-krishak-bandhu",
      name: "Krishak Bandhu & Bangla Shasya Bima",
      scope: "state",
      stateCode: "WB",
      category: "income_insurance",
      benefitSummary: "₹4,000–₹10,000/year input assistance plus 100% state-paid crop insurance premium.",
      eligibility: "Recorded farmers and bargadars in West Bengal.",
      helpline: "1800-103-1029",
      officialUrl: "https://krishakbandhu.net",
    },
  ],
};

export function getSchemesCatalog(stateCode: string): AgriSchemeEntry[] {
  const normalized = stateCode.trim().toUpperCase() || "OD";
  const stateEntries = STATE_SCHEMES[normalized] ?? [
    {
      id: `${normalized.toLowerCase()}-state-agri`,
      name: `${normalized} State Horticulture & Micro-Irrigation Top-Up`,
      scope: "state",
      stateCode: normalized,
      category: "water_soil",
      benefitSummary: "State DBT top-up over central PMKSY micro-irrigation and seed-kit subsidies.",
      eligibility: `Registered cultivators in ${normalized} with AgriStack Farmer ID.`,
      helpline: "1800-180-1551",
      officialUrl: "https://agricoop.gov.in",
    },
  ];
  return [...CENTRAL_SCHEMES, ...stateEntries];
}
