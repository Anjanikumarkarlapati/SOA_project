import { NextRequest, NextResponse } from "next/server";
import { INDIAN_STATES } from "@/lib/indian-locations";
import { computeTruthScore, type TruthScoreResult } from "@/lib/truth-score";
import type { TruthCitationLink } from "@/lib/truth-report-image";

export type PulseFilter = "all" | "official" | "social";
export type PulseCategory =
  | "official_scheme"
  | "weather_alert"
  | "regional_news"
  | "social_rumour";

export interface StatePulseItem {
  id: string;
  category: PulseCategory;
  title: string;
  summary: string;
  sourceName: string;
  platform: "gov" | "whatsapp" | "x" | "youtube" | "web";
  publishedLabel: string;
  locationLabel: string;
  score: TruthScoreResult;
  citations: TruthCitationLink[];
}

interface StateOverlay {
  deptName: string;
  deptUrl: string;
  stateSchemeTitle: string;
  stateSchemeSummary: string;
  stateSchemeUrl: string;
  weatherSummary: string;
  mandiSummary: string;
}

const STATE_OVERLAYS: Record<string, StateOverlay> = {
  OD: {
    deptName: "Dept. of Agriculture & FE, Odisha",
    deptUrl: "https://agri.odisha.gov.in/",
    stateSchemeTitle: "Odisha Krushak Assistance & Input Subsidy Window Open",
    stateSchemeSummary:
      "Verified DBT status and Rabi pulse/paddy seed subsidy updates are active on the official Odisha Krushak portal. Farmers should verify Aadhaar-seeded bank status directly at krushak.odisha.gov.in without paying agent fees.",
    stateSchemeUrl: "https://krushak.odisha.gov.in/",
    weatherSummary:
      "IMD Bhubaneswar coastal-delta agromet advisory notes morning mist and moderate easterly winds; schedule foliar sprays between 06:30 and 09:30 AM.",
    mandiSummary:
      "Cuttack and Puri paddy & green gram arrivals show steady e-NAM bidding; verify daily modal rates before transport.",
  },
  AP: {
    deptName: "AP Dept. of Agriculture (e-Panta)",
    deptUrl: "https://karshak.ap.gov.in/",
    stateSchemeTitle: "Andhra Pradesh e-Crop Booking & Input Relief Verification",
    stateSchemeSummary:
      "Official RBK / Rythu Seva Kendra verification for Rabi chilli, paddy, and groundnut parcels is published on karshak.ap.gov.in. Ensure crop booking matches your survey number for PMFBY and input relief.",
    stateSchemeUrl: "https://karshak.ap.gov.in/",
    weatherSummary:
      "IMD Amaravati warns of humid coastal evenings across Krishna-Guntur belt; monitor chilli thrips and avoid spraying before evening showers.",
    mandiSummary:
      "Guntur Mirchi Yard e-NAM lots show firm demand for Teja and 334 varieties; cross-check grade moisture at auction.",
  },
  PB: {
    deptName: "Punjab Agriculture & PAU Ludhiana",
    deptUrl: "https://agri.punjab.gov.in/",
    stateSchemeTitle: "Punjab CRM Machinery & PAU Wheat Advisory Active",
    stateSchemeSummary:
      "Official subsidy tracking for Happy Seeder / Super SMS and PAU Ludhiana timely-sown wheat guidance are live on agri.punjab.gov.in. Apply only through the official state portal.",
    stateSchemeUrl: "https://agri.punjab.gov.in/",
    weatherSummary:
      "IMD Chandigarh forecasts dry north-westerly mornings ideal for basal urea split and morning yellow-rust scouting.",
    mandiSummary:
      "Ludhiana and Khanna grain markets report steady wheat/basmati moisture grading under e-NAM norms.",
  },
  MH: {
    deptName: "MahaDBT Agriculture Portal",
    deptUrl: "https://mahadbt.maharashtra.gov.in/",
    stateSchemeTitle: "MahaDBT Drip Irrigation & Farm Mechanization Lottery List",
    stateSchemeSummary:
      "Official beneficiary selections for micro-irrigation and solar pump components are published strictly inside farmer logins at mahadbt.maharashtra.gov.in. Never pay third-party clearance charges.",
    stateSchemeUrl: "https://mahadbt.maharashtra.gov.in/",
    weatherSummary:
      "IMD Pune advises grape and onion growers in Nashik belt to monitor morning dew for downy mildew risk.",
    mandiSummary:
      "Lasalgaon and Pimpalgaon onion auction arrivals remain active; check APMC modal rates before loading.",
  },
  UP: {
    deptName: "UP Agriculture DBT Portal",
    deptUrl: "https://upagriculture.com/",
    stateSchemeTitle: "UP Seed Subsidy & Kisan Panjikaran Verification",
    stateSchemeSummary:
      "Registered farmers can verify certified wheat/mustard seed DBT credit and PM-KISAN land-seeding status via official UP Agriculture portals. Ignore WhatsApp PDFs asking for Aadhaar OTP.",
    stateSchemeUrl: "https://agriculture.up.gov.in/",
    weatherSummary:
      "IMD Lucknow notes cool Gangetic morning conditions; irrigate wheat at CRI stage (21 DAS) if soil moisture drops below 40%.",
    mandiSummary:
      "Meerut and Varanasi mandis report brisk mustard and potato arrivals with stable local demand.",
  },
};

function buildCuratedBulletins(
  stateCode: string,
  stateName: string,
  districtName: string
): StatePulseItem[] {
  const overlay = STATE_OVERLAYS[stateCode];
  const locationLabel = `${districtName}, ${stateName}`;

  const officialStateBulletin: StatePulseItem = {
    id: `pulse-${stateCode}-official-state`,
    category: "official_scheme",
    title:
      overlay?.stateSchemeTitle ??
      `${stateName} State Agriculture DBT & PM-KISAN e-KYC Window`,
    summary:
      overlay?.stateSchemeSummary ??
      `Official ${stateName} agriculture input support and PM-KISAN e-KYC verification are active on verified .gov.in portals. Always confirm beneficiary status directly on official portals without middleman charges.`,
    sourceName: overlay?.deptName ?? `${stateName} Dept. of Agriculture`,
    platform: "gov",
    publishedLabel: "Today · 06:00 AM",
    locationLabel,
    score: computeTruthScore({
      officialGovt: 50,
      crossSource: 20,
      recency: 15,
      groundSafety: 15,
    }),
    citations: [
      {
        title: overlay?.deptName ?? "Department of Agriculture & Farmers Welfare",
        url: overlay?.stateSchemeUrl ?? "https://agricoop.gov.in/",
      },
      {
        title: "PM-KISAN Official Portal",
        url: "https://pmkisan.gov.in/",
      },
    ],
  };

  const imdWeatherBulletin: StatePulseItem = {
    id: `pulse-${stateCode}-imd-weather`,
    category: "weather_alert",
    title: `IMD Agromet Spray & Irrigation Bulletin — ${districtName}`,
    summary:
      overlay?.weatherSummary ??
      `IMD Agromet guidance for ${districtName}, ${stateName} recommends scheduling foliar sprays during low-wind morning hours (<15 km/h) and checking local rain probability before fertilizer top-dressing.`,
    sourceName: "IMD Agromet Division (mausam.imd.gov.in)",
    platform: "gov",
    publishedLabel: "2h ago",
    locationLabel,
    score: computeTruthScore({
      officialGovt: 48,
      crossSource: 18,
      recency: 15,
      groundSafety: 15,
    }),
    citations: [
      {
        title: "IMD Agromet Advisories",
        url: "https://mausam.imd.gov.in/",
      },
    ],
  };

  const pmfbyBulletin: StatePulseItem = {
    id: `pulse-${stateCode}-pmfby-72h`,
    category: "official_scheme",
    title: "PMFBY 72-Hour Localized Calamity Reporting Reminder",
    summary:
      "Under Pradhan Mantri Fasal Bima Yojana, farmers facing localized hailstorm, landslide, or inundation damage must log intimation within 72 hours via the Crop Insurance App or CSC. Keep geo-tagged photos and parcel details ready.",
    sourceName: "PMFBY Official Portal (pmfby.gov.in)",
    platform: "gov",
    publishedLabel: "Today · 07:15 AM",
    locationLabel,
    score: computeTruthScore({
      officialGovt: 50,
      crossSource: 20,
      recency: 15,
      groundSafety: 12,
    }),
    citations: [
      {
        title: "PMFBY Official Guidelines",
        url: "https://pmfby.gov.in/",
      },
    ],
  };

  const regionalMandiBulletin: StatePulseItem = {
    id: `pulse-${stateCode}-mandi-pulse`,
    category: "regional_news",
    title: `${districtName} APMC Arrivals & e-NAM Price Pulse`,
    summary:
      overlay?.mandiSummary ??
      `Regional trader updates in ${districtName} indicate active arrivals and moisture-graded bidding. Cross-verify quoted rates against live Agmarknet and e-NAM MSP benchmarks before dispatching produce.`,
    sourceName: "Regional Mandi Network · e-NAM Check",
    platform: "web",
    publishedLabel: "4h ago",
    locationLabel,
    score: computeTruthScore({
      officialGovt: 25,
      crossSource: 16,
      recency: 15,
      groundSafety: 14,
    }),
    citations: [
      {
        title: "e-NAM National Agriculture Market",
        url: "https://enam.gov.in/",
      },
      {
        title: "Agmarknet Portal",
        url: "https://agmarknet.gov.in/",
      },
    ],
  };

  const scamRumourDebunk: StatePulseItem = {
    id: `pulse-${stateCode}-rumour-apk`,
    category: "social_rumour",
    title: `Fact-Check: Fake "PM-KISAN Bonus App.apk" & ₹499 Registration Forward`,
    summary:
      `Viral WhatsApp forwards circulating in ${districtName} groups promising instant PM-KISAN bonus via .apk files or registration fees are fraudulent. The Government of India never distributes scheme APKs on WhatsApp or charges registration fees.`,
    sourceName: "WhatsApp Rumour Shield · PIB Fact Check",
    platform: "whatsapp",
    publishedLabel: "1h ago",
    locationLabel,
    score: computeTruthScore({
      officialGovt: 0,
      crossSource: 10,
      recency: 15,
      groundSafety: 0,
      scamSignal: true,
    }),
    citations: [
      {
        title: "PM-KISAN Official Portal",
        url: "https://pmkisan.gov.in/",
      },
      {
        title: "PIB Fact Check",
        url: "https://pib.gov.in/",
      },
    ],
  };

  return [
    officialStateBulletin,
    imdWeatherBulletin,
    pmfbyBulletin,
    regionalMandiBulletin,
    scamRumourDebunk,
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawState = (searchParams.get("stateCode") || "OD").trim().toUpperCase();
  const stateObj =
    INDIAN_STATES.find((s) => s.code === rawState) ?? INDIAN_STATES[0];

  const rawDistrict = (searchParams.get("districtName") || "").trim();
  const matchedDistrict =
    stateObj.districts.find(
      (d) => d.name.toLowerCase() === rawDistrict.toLowerCase()
    ) ?? stateObj.districts[0];

  const filterParam = (searchParams.get("filter") || "all").toLowerCase();
  const filter: PulseFilter =
    filterParam === "official" || filterParam === "social" ? filterParam : "all";

  const allItems = buildCuratedBulletins(
    stateObj.code,
    stateObj.name,
    matchedDistrict?.name ?? "Statewide"
  );

  const items =
    filter === "official"
      ? allItems.filter((item) => item.score.totalPercent >= 85)
      : filter === "social"
        ? allItems.filter(
            (item) =>
              item.category === "social_rumour" ||
              item.category === "regional_news"
          )
        : allItems;

  return NextResponse.json({
    stateCode: stateObj.code,
    stateName: stateObj.name,
    districtName: matchedDistrict?.name ?? "Statewide",
    filter,
    updatedAt: new Date().toISOString(),
    items,
  });
}
