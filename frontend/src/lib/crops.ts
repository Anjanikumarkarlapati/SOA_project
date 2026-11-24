// lib/crops.ts — Agronomic crop catalog and recommendation engine with FAO-56 coefficients

import type { ClimateStats } from "./climate";

export type Season = "spring" | "summer" | "autumn" | "winter" | "dry" | "wet" | "any" | "Kharif" | "Rabi" | "Zaid" | "Perennial";

export interface CropProfile {
  id: string;
  name: string;
  emoji: string;
  category: "cereal" | "vegetable" | "fruit" | "legume" | "root" | "cash";
  seasons: Season[];
  tempRange: [number, number];       // °C optimal min/max
  precipRange: [number, number];     // mm/day optimal
  humidityRange: [number, number];   // %
  waterNeed: "low" | "medium" | "high";
  soilPH: [number, number];
  growDays: number;
  yieldTonPerHa: number;
  // FAO-56 crop coefficients [Kc_initial, Kc_mid, Kc_late]
  kc: [number, number, number];
  // Optimal soil moisture range [% volumetric]
  optimalSoilMoisture: [number, number];
  // Optimal soil temperature range [°C]
  optimalSoilTemp: [number, number];
  commonPests: string[];
  commonDiseases: string[];
  fertilizerTips: string;
  notes: string;
}

// 30-crop comprehensive agronomic database with FAO-56 crop coefficients
export const CROP_DATABASE: CropProfile[] = [
  {
    id: "wheat",
    name: "Wheat",
    emoji: "WH",
    category: "cereal",
    seasons: ["winter", "spring", "Rabi"],
    tempRange: [10, 25],
    precipRange: [0.5, 3.5],
    humidityRange: [40, 70],
    waterNeed: "medium",
    soilPH: [6.0, 7.5],
    growDays: 120,
    yieldTonPerHa: 4.8,
    kc: [0.4, 1.15, 0.4],
    optimalSoilMoisture: [50, 70],
    optimalSoilTemp: [12, 22],
    commonPests: ["Wheat Aphid", "Armyworm", "Termites"],
    commonDiseases: ["Yellow Rust", "Brown Rust", "Powdery Mildew", "Loose Smut"],
    fertilizerTips: "Split Nitrogen 50% at sowing (crown root initiation) and 50% at first node. Apply Zinc sulfate in deficient soils.",
    notes: "Cool-season staple; drought-tolerant once crown roots establish.",
  },
  {
    id: "rice",
    name: "Rice (Paddy)",
    emoji: "RI",
    category: "cereal",
    seasons: ["summer", "wet", "Kharif"],
    tempRange: [22, 38],
    precipRange: [4, 18],
    humidityRange: [65, 95],
    waterNeed: "high",
    soilPH: [5.5, 7.0],
    growDays: 130,
    yieldTonPerHa: 5.5,
    kc: [1.05, 1.20, 0.90],
    optimalSoilMoisture: [80, 100],
    optimalSoilTemp: [22, 32],
    commonPests: ["Yellow Stem Borer", "Brown Planthopper", "Leaf Folder", "Gall Midge"],
    commonDiseases: ["Bacterial Leaf Blight", "Blast (Magnaporthe)", "Sheath Blight"],
    fertilizerTips: "Deep placement of Urea briquettes or 3 splits: basal, tillering, and panicle initiation. Top-dress with MOP for disease resistance.",
    notes: "Requires shallow ponded water or alternate wetting & drying (AWD) in loamy-clay soils.",
  },
  {
    id: "maize",
    name: "Maize (Corn)",
    emoji: "MZ",
    category: "cereal",
    seasons: ["spring", "summer", "Kharif", "Rabi"],
    tempRange: [18, 35],
    precipRange: [1.8, 6.5],
    humidityRange: [50, 80],
    waterNeed: "medium",
    soilPH: [5.8, 7.2],
    growDays: 95,
    yieldTonPerHa: 6.8,
    kc: [0.4, 1.20, 0.60],
    optimalSoilMoisture: [55, 75],
    optimalSoilTemp: [18, 30],
    commonPests: ["Fall Armyworm", "Stem Borer", "Shoot Fly"],
    commonDiseases: ["Maydis Leaf Blight", "Turcicum Blight", "Common Rust"],
    fertilizerTips: "Heavy feeder: 120kg N, 60kg P, 40kg K per ha. Critical irrigation at knee-high and silking/tasseling stages.",
    notes: "High biomass, versatile C4 crop; very sensitive to waterlogging at seedling stage.",
  },
  {
    id: "sorghum",
    name: "Sorghum (Jowar)",
    emoji: "SG",
    category: "cereal",
    seasons: ["summer", "dry", "Kharif", "Rabi"],
    tempRange: [22, 40],
    precipRange: [0.5, 4.0],
    humidityRange: [30, 65],
    waterNeed: "low",
    soilPH: [5.5, 7.8],
    growDays: 105,
    yieldTonPerHa: 4.2,
    kc: [0.35, 1.05, 0.55],
    optimalSoilMoisture: [40, 65],
    optimalSoilTemp: [20, 32],
    commonPests: ["Shoot Fly", "Stem Borer", "Midge"],
    commonDiseases: ["Grain Mold", "Anthracnose", "Charcoal Rot"],
    fertilizerTips: "Moderate requirement: 80:40:40 NPK. Thrives with minimal supplemental irrigation.",
    notes: "Deep root system, remarkable drought resilience; stops transpiration during dry spells.",
  },
  {
    id: "barley",
    name: "Barley",
    emoji: "BL",
    category: "cereal",
    seasons: ["winter", "spring", "Rabi"],
    tempRange: [6, 22],
    precipRange: [0.5, 2.5],
    humidityRange: [40, 65],
    waterNeed: "low",
    soilPH: [6.2, 7.8],
    growDays: 100,
    yieldTonPerHa: 3.8,
    kc: [0.35, 1.15, 0.25],
    optimalSoilMoisture: [45, 65],
    optimalSoilTemp: [10, 20],
    commonPests: ["Corn Leaf Aphid", "Cutworms"],
    commonDiseases: ["Covered Smut", "Net Blotch", "Stripe Rust"],
    fertilizerTips: "Requires 60:30:20 NPK. Excess nitrogen causes lodging and degrades malting quality.",
    notes: "Cold-tolerant; higher salinity tolerance than wheat.",
  },
  {
    id: "tomato",
    name: "Tomato",
    emoji: "TM",
    category: "vegetable",
    seasons: ["spring", "summer", "autumn", "Rabi", "Zaid"],
    tempRange: [18, 32],
    precipRange: [1.2, 4.5],
    humidityRange: [50, 75],
    waterNeed: "medium",
    soilPH: [6.0, 6.8],
    growDays: 85,
    yieldTonPerHa: 42.0,
    kc: [0.6, 1.15, 0.80],
    optimalSoilMoisture: [60, 80],
    optimalSoilTemp: [18, 27],
    commonPests: ["Tomato Fruit Borer", "Whitefly", "Leafminer", "Red Spider Mite"],
    commonDiseases: ["Early Blight", "Late Blight", "Bacterial Wilt", "Tomato Leaf Curl Virus (TYLCV)"],
    fertilizerTips: "Calcium-rich nutrition prevents Blossom End Rot. Apply balanced NPK with micronutrients (Boron, Zinc).",
    notes: "High market value; staking/mulching advised to prevent fruit rot in wet soils.",
  },
  {
    id: "potato",
    name: "Potato",
    emoji: "PT",
    category: "root",
    seasons: ["spring", "autumn", "winter", "Rabi"],
    tempRange: [12, 24],
    precipRange: [1.5, 4.0],
    humidityRange: [60, 85],
    waterNeed: "medium",
    soilPH: [5.2, 6.5],
    growDays: 90,
    yieldTonPerHa: 26.0,
    kc: [0.5, 1.15, 0.75],
    optimalSoilMoisture: [65, 85],
    optimalSoilTemp: [15, 22],
    commonPests: ["Potato Tuber Moth", "Aphids", "Cutworms"],
    commonDiseases: ["Late Blight (Phytophthora)", "Early Blight", "Common Scab", "Black Scurf"],
    fertilizerTips: "High potassium demand (150kg/ha K2O) for tuber bulking. Keep soil loose and well earthed-up.",
    notes: "Cool night temperatures (<18°C) are crucial for tuber initiation.",
  },
  {
    id: "onion",
    name: "Onion",
    emoji: "ON",
    category: "vegetable",
    seasons: ["winter", "spring", "autumn", "Rabi", "Kharif"],
    tempRange: [14, 28],
    precipRange: [0.8, 3.2],
    humidityRange: [45, 75],
    waterNeed: "medium",
    soilPH: [6.0, 7.2],
    growDays: 110,
    yieldTonPerHa: 22.0,
    kc: [0.7, 1.05, 0.75],
    optimalSoilMoisture: [60, 75],
    optimalSoilTemp: [16, 25],
    commonPests: ["Onion Thrips", "Maggots"],
    commonDiseases: ["Purple Blotch (Alternaria)", "Downy Mildew", "Basal Rot (Fusarium)"],
    fertilizerTips: "Sulfur (30-40 kg/ha) increases pungency and storage shelf life. Stop irrigation 15 days before harvest.",
    notes: "Shallow fibrous root system; sensitive to weed competition and moisture stress.",
  },
  {
    id: "garlic",
    name: "Garlic",
    emoji: "GL",
    category: "vegetable",
    seasons: ["winter", "autumn", "Rabi"],
    tempRange: [10, 25],
    precipRange: [0.5, 2.5],
    humidityRange: [40, 70],
    waterNeed: "low",
    soilPH: [6.0, 7.2],
    growDays: 140,
    yieldTonPerHa: 9.0,
    kc: [0.5, 1.00, 0.70],
    optimalSoilMoisture: [50, 70],
    optimalSoilTemp: [12, 22],
    commonPests: ["Thrips", "Nematodes"],
    commonDiseases: ["Purple Blotch", "White Rot", "Stem and Bulb Nematode"],
    fertilizerTips: "Apply farmyard manure and 100:50:50 NPK with elemental sulfur.",
    notes: "High value bulb; requires cold period for bulb differentiation followed by warmer harvesting days.",
  },
  {
    id: "spinach",
    name: "Spinach",
    emoji: "SP",
    category: "vegetable",
    seasons: ["spring", "autumn", "winter", "Rabi"],
    tempRange: [6, 22],
    precipRange: [0.8, 3.0],
    humidityRange: [50, 80],
    waterNeed: "medium",
    soilPH: [6.2, 7.5],
    growDays: 45,
    yieldTonPerHa: 12.0,
    kc: [0.7, 1.00, 0.95],
    optimalSoilMoisture: [60, 80],
    optimalSoilTemp: [10, 20],
    commonPests: ["Leafminer", "Aphids", "Caterpillars"],
    commonDiseases: ["Downy Mildew", "Anthracnose", "Damping-Off"],
    fertilizerTips: "Frequent split application of Nitrogen (foliar urea spray 1-2%) after each cutting.",
    notes: "Fast multi-cut crop; bolts quickly when daytime temps exceed 26°C.",
  },
  {
    id: "beans",
    name: "Green Beans",
    emoji: "GB",
    category: "legume",
    seasons: ["spring", "summer", "autumn", "Zaid"],
    tempRange: [16, 30],
    precipRange: [1.0, 4.0],
    humidityRange: [50, 80],
    waterNeed: "medium",
    soilPH: [6.0, 7.0],
    growDays: 60,
    yieldTonPerHa: 14.0,
    kc: [0.4, 1.15, 0.90],
    optimalSoilMoisture: [55, 75],
    optimalSoilTemp: [18, 26],
    commonPests: ["Bean Pod Borer", "Aphids", "Whitefly"],
    commonDiseases: ["Anthracnose", "Bean Common Mosaic Virus", "Rust"],
    fertilizerTips: "Symbiotic Rhizobium legume inoculant fixes atmospheric nitrogen. Basal DAP + Potash adequate.",
    notes: "Excellent short-duration rotation crop; improves soil nitrogen bank.",
  },
  {
    id: "soybean",
    name: "Soybean",
    emoji: "SB",
    category: "legume",
    seasons: ["summer", "Kharif"],
    tempRange: [20, 35],
    precipRange: [1.8, 5.5],
    humidityRange: [55, 85],
    waterNeed: "medium",
    soilPH: [6.0, 7.0],
    growDays: 110,
    yieldTonPerHa: 2.8,
    kc: [0.4, 1.15, 0.50],
    optimalSoilMoisture: [55, 75],
    optimalSoilTemp: [20, 30],
    commonPests: ["Girdle Beetle", "Semilooper", "Stem Fly", "Spodoptera"],
    commonDiseases: ["Yellow Mosaic Virus", "Collar Rot", "Rust"],
    fertilizerTips: "Seed treatment with Rhizobium japonicum + PSB. Apply 20kg N, 60kg P2O5, 40kg K2O, 20kg Sulfur per ha.",
    notes: "Premier oilseed and protein crop; pod-filling stage is sensitive to drought.",
  },
  {
    id: "chickpea",
    name: "Chickpea (Gram)",
    emoji: "CH",
    category: "legume",
    seasons: ["winter", "dry", "Rabi"],
    tempRange: [10, 30],
    precipRange: [0.3, 2.0],
    humidityRange: [30, 65],
    waterNeed: "low",
    soilPH: [6.0, 8.0],
    growDays: 105,
    yieldTonPerHa: 2.0,
    kc: [0.4, 1.00, 0.35],
    optimalSoilMoisture: [40, 60],
    optimalSoilTemp: [15, 25],
    commonPests: ["Helicoverpa Pod Borer", "Cutworm"],
    commonDiseases: ["Fusarium Wilt", "Ascochyta Blight", "Dry Root Rot"],
    fertilizerTips: "Requires minimal nitrogen; apply 40kg P2O5 with Rhizobium seed inoculation.",
    notes: "Drought-hardy champion; excess moisture during flowering causes flower drop and vegetative overgrowth.",
  },
  {
    id: "cotton",
    name: "Cotton",
    emoji: "CT",
    category: "cash",
    seasons: ["summer", "Kharif"],
    tempRange: [24, 40],
    precipRange: [1.2, 5.0],
    humidityRange: [40, 70],
    waterNeed: "medium",
    soilPH: [6.0, 8.0],
    growDays: 165,
    yieldTonPerHa: 2.4,
    kc: [0.35, 1.20, 0.65],
    optimalSoilMoisture: [50, 70],
    optimalSoilTemp: [22, 34],
    commonPests: ["Pink Bollworm", "Whitefly", "Jassids", "Thrips"],
    commonDiseases: ["Bacterial Blight", "Grey Mildew", "Root Rot"],
    fertilizerTips: "Apply 120:60:60 NPK in 3 splits. Foliar spray of Magnesium Sulfate & Potassium Nitrate during boll formation.",
    notes: "Long frost-free growing season needed; square and boll formation stages require steady moisture.",
  },
  {
    id: "sugarcane",
    name: "Sugarcane",
    emoji: "SC",
    category: "cash",
    seasons: ["summer", "wet", "Perennial"],
    tempRange: [24, 38],
    precipRange: [3.5, 12.0],
    humidityRange: [65, 90],
    waterNeed: "high",
    soilPH: [6.0, 7.8],
    growDays: 360,
    yieldTonPerHa: 85.0,
    kc: [0.4, 1.25, 0.75],
    optimalSoilMoisture: [65, 85],
    optimalSoilTemp: [24, 34],
    commonPests: ["Early Shoot Borer", "Top Borer", "Pyrilla", "White Grub"],
    commonDiseases: ["Red Rot (Colletotrichum)", "Smut", "Grassy Shoot"],
    fertilizerTips: "Heavy feeder: 250kg N, 100kg P, 120kg K per ha in splits. Earthing-up at 90-120 days prevents lodging.",
    notes: "Perennial grass yielding high biomass; trash mulching between rows saves 30% irrigation water.",
  },
  {
    id: "turmeric",
    name: "Turmeric",
    emoji: "TR",
    category: "root",
    seasons: ["summer", "wet", "Kharif"],
    tempRange: [20, 35],
    precipRange: [2.5, 8.0],
    humidityRange: [65, 90],
    waterNeed: "high",
    soilPH: [5.5, 7.2],
    growDays: 260,
    yieldTonPerHa: 14.0,
    kc: [0.5, 1.10, 0.70],
    optimalSoilMoisture: [65, 85],
    optimalSoilTemp: [22, 30],
    commonPests: ["Shoot Borer", "Scale Insects"],
    commonDiseases: ["Rhizome Rot (Pythium)", "Leaf Spot (Colletotrichum)", "Leaf Blotch"],
    fertilizerTips: "Liberal organic manure (25t/ha) plus 150:60:100 NPK. Green leaf mulching at planting, 45, and 90 days.",
    notes: "High value medicinal spice; shade-tolerant; requires well-drained sandy loam ridges.",
  },
  {
    id: "mango",
    name: "Mango Orchard",
    emoji: "MG",
    category: "fruit",
    seasons: ["dry", "summer", "Perennial"],
    tempRange: [22, 42],
    precipRange: [0.5, 3.5],
    humidityRange: [40, 75],
    waterNeed: "low",
    soilPH: [5.5, 7.5],
    growDays: 130,
    yieldTonPerHa: 16.0,
    kc: [0.6, 0.85, 0.70],
    optimalSoilMoisture: [45, 65],
    optimalSoilTemp: [22, 32],
    commonPests: ["Mango Hopper", "Fruit Fly (Bactrocera)", "Stem Borer"],
    commonDiseases: ["Powdery Mildew", "Anthracnose", "Malformation"],
    fertilizerTips: "Post-harvest NPK ring application per tree. Stop watering 2-3 months before flowering to trigger bloom.",
    notes: "Distinct dry stress period triggers prolific floral panicle initiation.",
  },
  {
    id: "banana",
    name: "Banana",
    emoji: "BN",
    category: "fruit",
    seasons: ["wet", "summer", "Perennial"],
    tempRange: [22, 36],
    precipRange: [3.5, 10.0],
    humidityRange: [70, 95],
    waterNeed: "high",
    soilPH: [6.0, 7.2],
    growDays: 300,
    yieldTonPerHa: 50.0,
    kc: [0.5, 1.10, 1.00],
    optimalSoilMoisture: [70, 90],
    optimalSoilTemp: [22, 32],
    commonPests: ["Banana Pseudostem Weevil", "Rhizome Weevil", "Aphid (vector of BBTV)"],
    commonDiseases: ["Panama Wilt (Fusarium R4T)", "Sigatoka Leaf Spot", "Bunchy Top"],
    fertilizerTips: "High potassium consumer: 200g N, 60g P, 300g K per plant via fertigation in 16-20 splits.",
    notes: "Heavy water and fertilizer requirement; propping with bamboo poles essential as bunches mature.",
  },
  {
    id: "watermelon",
    name: "Watermelon",
    emoji: "WM",
    category: "fruit",
    seasons: ["summer", "spring", "Zaid"],
    tempRange: [22, 38],
    precipRange: [1.0, 4.0],
    humidityRange: [50, 75],
    waterNeed: "medium",
    soilPH: [6.0, 7.0],
    growDays: 85,
    yieldTonPerHa: 38.0,
    kc: [0.4, 1.00, 0.75],
    optimalSoilMoisture: [55, 75],
    optimalSoilTemp: [22, 32],
    commonPests: ["Fruit Fly", "Red Pumpkin Beetle", "Aphids"],
    commonDiseases: ["Downy Mildew", "Powdery Mildew", "Fusarium Wilt"],
    fertilizerTips: "Apply 100:60:60 NPK. Cut back irrigation 7-10 days before harvest to concentrate natural brix sugars.",
    notes: "Warm sunny days and cool dry nights produce sweetest fruit; needs well-drained sandy loam.",
  },
  {
    id: "cabbage",
    name: "Cabbage / Cauliflower",
    emoji: "CB",
    category: "vegetable",
    seasons: ["autumn", "winter", "spring", "Rabi"],
    tempRange: [10, 22],
    precipRange: [0.8, 3.0],
    humidityRange: [55, 80],
    waterNeed: "medium",
    soilPH: [6.0, 7.5],
    growDays: 90,
    yieldTonPerHa: 32.0,
    kc: [0.7, 1.05, 0.95],
    optimalSoilMoisture: [60, 80],
    optimalSoilTemp: [12, 22],
    commonPests: ["Diamondback Moth (DBM)", "Cabbage Aphid", "Tobacco Caterpillar"],
    commonDiseases: ["Black Rot (Xanthomonas)", "Clubroot", "Alternaria Leaf Spot"],
    fertilizerTips: "Boron (10-15 kg/ha borax) and Molybdenum prevent browning and whiptail. High nitrogen split feeder.",
    notes: "Cool-season brassica; uniform soil moisture prevents head splitting.",
  },
  {
    id: "carrot",
    name: "Carrot",
    emoji: "CR",
    category: "root",
    seasons: ["spring", "autumn", "winter", "Rabi"],
    tempRange: [8, 24],
    precipRange: [0.8, 2.5],
    humidityRange: [50, 75],
    waterNeed: "low",
    soilPH: [6.0, 7.0],
    growDays: 85,
    yieldTonPerHa: 25.0,
    kc: [0.45, 1.05, 0.90],
    optimalSoilMoisture: [50, 70],
    optimalSoilTemp: [12, 20],
    commonPests: ["Carrot Rust Fly", "Nematodes"],
    commonDiseases: ["Alternaria Blight", "Cercospora", "Cavity Spot"],
    fertilizerTips: "Avoid fresh manure which causes forked, deformed roots. Apply balanced NPK with potassium.",
    notes: "Deep, stone-free loose loam gives straight, smooth cylindrical roots.",
  },
  {
    id: "groundnut",
    name: "Groundnut (Peanut)",
    emoji: "GN",
    category: "legume",
    seasons: ["summer", "dry", "Kharif", "Zaid"],
    tempRange: [22, 35],
    precipRange: [1.0, 4.0],
    humidityRange: [40, 75],
    waterNeed: "low",
    soilPH: [5.8, 7.2],
    growDays: 115,
    yieldTonPerHa: 2.8,
    kc: [0.4, 1.15, 0.60],
    optimalSoilMoisture: [45, 65],
    optimalSoilTemp: [22, 30],
    commonPests: ["Leaf Miner", "Spodoptera", "White Grub"],
    commonDiseases: ["Tikka Leaf Spot", "Collar Rot", "Rust"],
    fertilizerTips: "Gypsum application (400 kg/ha at pegging) is mandatory for calcium uptake into underground pods.",
    notes: "Pegging and pod development stages are most critical for light, friable soil and moisture.",
  },
  {
    id: "mustard",
    name: "Mustard / Rapeseed",
    emoji: "MR",
    category: "cash",
    seasons: ["winter", "autumn", "Rabi"],
    tempRange: [8, 25],
    precipRange: [0.5, 2.0],
    humidityRange: [40, 70],
    waterNeed: "low",
    soilPH: [6.0, 7.5],
    growDays: 90,
    yieldTonPerHa: 2.0,
    kc: [0.35, 1.15, 0.35],
    optimalSoilMoisture: [40, 60],
    optimalSoilTemp: [12, 22],
    commonPests: ["Mustard Aphid (Lipaphis)", "Sawfly", "Painted Bug"],
    commonDiseases: ["White Rust (Albugo)", "Alternaria Blight", "Downy Mildew"],
    fertilizerTips: "Sulfur (30 kg/ha) increases oil content by 2-3%. Two irrigations (flowering and siliqua stage) double yield.",
    notes: "Winter cash oilseed; highly sensitive to aphid swarms during cloudy, humid weather.",
  },
];

export interface CropScore {
  crop: CropProfile;
  score: number; // 0–100
  breakdown: {
    season: number;
    temp: number;
    water: number;
    humidity: number;
  };
  suitability: "Excellent" | "Good" | "Fair" | "Poor";
  warnings: string[];
}

function score0to10(val: number, min: number, max: number): number {
  if (val >= min && val <= max) return 10;
  const mid = (min + max) / 2;
  const range = (max - min) / 2;
  const dist = Math.abs(val - mid) - range;
  return Math.max(0, 10 - (dist / Math.max(range, 1)) * 10);
}

export function recommendCrops(
  climate: ClimateStats,
  season: Season,
  targetSeason?: Season
): CropScore[] {
  const activeSeason = targetSeason ?? season;

  return CROP_DATABASE.map((crop): CropScore => {
    const warnings: string[] = [];

    // Season match score
    const seasonMatch = crop.seasons.includes(activeSeason) || crop.seasons.includes("any");
    const seasonScore = seasonMatch ? 10 : 4;
    if (!seasonMatch) {
      warnings.push(`Optimal sowing in ${crop.seasons.join(" / ")}`);
    }

    // Temperature score
    const tempScore = score0to10(climate.avgTempC, crop.tempRange[0], crop.tempRange[1]);
    if (tempScore < 5) {
      warnings.push(`Current avg temp ${climate.avgTempC.toFixed(1)}°C outside optimal ${crop.tempRange[0]}–${crop.tempRange[1]}°C`);
    }

    // Water/precipitation score
    const waterScore = score0to10(climate.avgPrecipMm, crop.precipRange[0], crop.precipRange[1]);
    if (waterScore < 6 && (crop.waterNeed === "high" || crop.waterNeed === "medium")) {
      warnings.push("Supplemental irrigation required to meet crop evapotranspiration");
    }

    // Humidity score
    const humScore = score0to10(climate.avgHumidity, crop.humidityRange[0], crop.humidityRange[1]);

    // Weighted composite
    const raw = seasonScore * 0.30 + tempScore * 0.35 + waterScore * 0.25 + humScore * 0.10;
    const total = Math.round(raw * 10);

    const penalty = climate.riskLevel === "HIGH" ? 12 : climate.riskLevel === "MODERATE" ? 5 : 0;
    const score = Math.max(5, Math.min(100, total - penalty));

    const suitability: CropScore["suitability"] =
      score >= 75 ? "Excellent" :
      score >= 55 ? "Good" :
      score >= 35 ? "Fair" : "Poor";

    return {
      crop,
      score,
      breakdown: {
        season: Math.round(seasonScore * 10),
        temp: Math.round(tempScore * 10),
        water: Math.round(waterScore * 10),
        humidity: Math.round(humScore * 10),
      },
      suitability,
      warnings,
    };
  }).sort((a, b) => b.score - a.score);
}

export function getCropById(id: string): CropProfile {
  return CROP_DATABASE.find((c) => c.id === id) || CROP_DATABASE[0];
}

// ─── Sensor recommendations ───────────────────────────────────────────────────
export interface SensorRecommendation {
  type: string;
  label: string;
  priority: "required" | "recommended" | "optional";
  reason: string;
}

export function recommendSensors(
  climate: ClimateStats,
  crops: CropScore[],
  waterNeed?: string
): SensorRecommendation[] {
  const recs: SensorRecommendation[] = [
    { type: "SOIL_MOISTURE", label: "Soil Moisture Sensor", priority: "required", reason: "Essential for irrigation scheduling" },
    { type: "SOIL_TEMP", label: "Soil Temperature", priority: "required", reason: "Critical for germination and root health" },
    { type: "WEATHER", label: "Weather Station", priority: "recommended", reason: "Local microclimate data for precision farming" },
  ];

  if (climate.avgHumidity > 75 || crops[0]?.crop.waterNeed === "high") {
    recs.push({ type: "HUMIDITY", label: "Air Humidity Sensor", priority: "recommended", reason: "Disease prevention in humid conditions" });
  }
  if (crops.some((c) => c.crop.soilPH[0] < 6.0)) {
    recs.push({ type: "PH", label: "Soil pH Sensor", priority: "recommended", reason: "pH-sensitive crops detected in your selection" });
  }
  if (climate.riskLevel === "HIGH" || climate.avgWindKmh > 30) {
    recs.push({ type: "WIND", label: "Anemometer (Wind)", priority: "optional", reason: "High wind risk detected in your area" });
  }
  if (waterNeed === "high" || climate.avgTempC > 32) {
    recs.push({ type: "FLOW", label: "Flow Meter (Irrigation)", priority: "recommended", reason: "Track water usage for hot/dry conditions" });
  }
  recs.push({ type: "LIGHT", label: "PAR / Light Sensor", priority: "optional", reason: "Optimize planting density and shading" });
  return recs;
}
