// src/lib/media-manifest.ts — Audited, strictly human-free project media registry
export type MediaAssetId =
  | "hero-field"
  | "aerial-farm"
  | "soil-sensing"
  | "crop-canopy"
  | "irrigation-drip"
  | "logo-mark";

export type MediaId = MediaAssetId;

export interface MediaAssetSpec {
  id: MediaAssetId;
  src: string;
  fallbackSrc: string;
  width: number;
  height: number;
  aspectRatio: string;
  objectPosition: string;
  altKey: string;
  fallbackAlt: string;
  alt: string;
  creditNote: string;
  usage: string;
  illustrative: boolean;
  containsHumans: false;
}

export const MEDIA_MANIFEST: Record<MediaAssetId, MediaAssetSpec> = {
  "hero-field": {
    id: "hero-field",
    src: "/images/hero-field.jpg",
    fallbackSrc: "/images/hero-field.jpg",
    width: 1408,
    height: 768,
    aspectRatio: "16 / 9",
    objectPosition: "center 45%",
    altKey: "media.heroFieldAlt",
    fallbackAlt:
      "Solar-powered microclimate weather station installed across misty golden-hour wheat hills",
    alt: "Solar-powered microclimate weather station installed across misty golden-hour wheat hills",
    creditNote: "SPECIMEN · GOLDEN-HOUR MICROCLIMATE RIDGE",
    usage: "Landing hero and Login split-screen Offset Slab showcase",
    illustrative: true,
    containsHumans: false,
  },
  "aerial-farm": {
    id: "aerial-farm",
    src: "/images/aerial-farm.jpg",
    fallbackSrc: "/images/aerial-farm.jpg",
    width: 1408,
    height: 768,
    aspectRatio: "16 / 9",
    objectPosition: "center center",
    altKey: "media.aerialFarmAlt",
    fallbackAlt:
      "Aerial view of irrigated center-pivot parcels and cultivated crop rows along a river corridor",
    alt: "Aerial view of irrigated center-pivot parcels and cultivated crop rows along a river corridor",
    creditNote: "SPECIMEN · ALLUVIAL BASIN AERIAL SURVEY",
    usage: "Dashboard NDVI aerial survey and Properties illustrative cover",
    illustrative: true,
    containsHumans: false,
  },
  "soil-sensing": {
    id: "soil-sensing",
    src: "/images/soil-sensing.jpg",
    fallbackSrc: "/images/soil-sensing.jpg",
    width: 1200,
    height: 900,
    aspectRatio: "4 / 3",
    objectPosition: "center 50%",
    altKey: "media.soilSensingAlt",
    fallbackAlt:
      "Matte-black dielectric soil-moisture probe with status indicator beside a dew-covered seedling in dark loam",
    alt: "Matte-black dielectric soil-moisture probe with status indicator beside a dew-covered seedling in dark loam",
    creditNote: "SPECIMEN · IN-SITU DIELECTRIC ROOT PROBE",
    usage: "Sensors hardware placement guide and Root-Zone Soil telemetry card",
    illustrative: true,
    containsHumans: false,
  },
  "crop-canopy": {
    id: "crop-canopy",
    src: "/images/crop-canopy.webp",
    fallbackSrc: "/images/hero-field.jpg",
    width: 1200,
    height: 800,
    aspectRatio: "3 / 2",
    objectPosition: "center 40%",
    altKey: "media.cropCanopyAlt",
    fallbackAlt:
      "Sunlit golden-green cultivated wheat ears and terraced crop furrows in morning mist",
    alt: "Sunlit golden-green cultivated wheat ears and terraced crop furrows in morning mist",
    creditNote: "SPECIMEN · GOLDEN-HOUR CROP CANOPY",
    usage: "Crop Recommendations scouting banner and FarmerRecommendationCard header",
    illustrative: true,
    containsHumans: false,
  },
  "irrigation-drip": {
    id: "irrigation-drip",
    src: "/images/irrigation-drip.webp",
    fallbackSrc: "/images/soil-sensing.jpg",
    width: 1200,
    height: 800,
    aspectRatio: "3 / 2",
    objectPosition: "center 50%",
    altKey: "media.irrigationDripAlt",
    fallbackAlt:
      "Precision drip-irrigation emitter lines with water droplets along young crop rows in mineral loam",
    alt: "Precision drip-irrigation emitter lines with water droplets along young crop rows in mineral loam",
    creditNote: "SPECIMEN · ROOT-ZONE DRIP EMITTER",
    usage: "Signup showcase panel and Irrigation valve configuration header",
    illustrative: true,
    containsHumans: false,
  },
  "logo-mark": {
    id: "logo-mark",
    src: "/logo-mark.svg",
    fallbackSrc: "/logo-mark.svg",
    width: 64,
    height: 64,
    aspectRatio: "1 / 1",
    objectPosition: "center center",
    altKey: "media.logoMarkAlt",
    fallbackAlt: "AgriTech Furrow-Leaf and sensor node emblem",
    alt: "AgriTech Furrow-Leaf and sensor node emblem",
    creditNote: "AGRITECH CREST",
    usage: "Brand identity mark and LiquidMetal shader mask",
    illustrative: false,
    containsHumans: false,
  },
};
