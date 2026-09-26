// Shared with web/src/lib/farm - keep the two copies in step.
/*
 * Reference data for the India farm assistant: crops, locations, soils, irrigation methods
 * and the sensor catalogue. Everything the onboarding wizard offers and the automation engine
 * computes from lives here, so the demo runs with no backend and no API key.
 *
 * Crop coefficients (Kc) and stage lengths follow FAO-56 Table 11/12, adjusted to typical
 * Indian season lengths. Climate normals are rounded IMD 1991-2020 monthly means for a
 * representative station in each zone - good enough to plan with, not a forecast.
 */

export type CropGroup =
  | 'Cereals'
  | 'Millets'
  | 'Pulses'
  | 'Oilseeds'
  | 'Cash crops'
  | 'Vegetables'
  | 'Fruits'
  | 'Spices'
  | 'Plantation'

export type Season = 'Kharif' | 'Rabi' | 'Zaid' | 'Perennial'

export interface CropProfile {
  id: string
  name: string
  /** Local name most farmers will recognise, in Devanagari. */
  local: string
  group: CropGroup
  seasons: Season[]
  /** FAO-56 crop coefficient at the initial, mid-season and end stage. */
  kc: [number, number, number]
  /** Days in the initial, development, mid-season and late stage. */
  stages: [number, number, number, number]
  /** Effective root depth at full growth, metres. */
  rootDepth: number
  /** Fraction of available soil water the crop can use before it is stressed (FAO-56 p). */
  depletion: number
  /** Air temperature band the crop grows best in, degrees C. */
  temp: [number, number]
  /** Grown in standing water: the engine keeps a ponded depth instead of a moisture band. */
  ponded?: boolean
  /** Prone to fungal disease in humid weather, so a leaf wetness sensor is worth it. */
  fungal?: boolean
  perennial?: boolean
}

export const CROPS: CropProfile[] = [
  // Cereals
  { id: 'rice', name: 'Rice (Paddy)', local: 'धान', group: 'Cereals', seasons: ['Kharif', 'Rabi'], kc: [1.05, 1.2, 0.9], stages: [30, 30, 60, 30], rootDepth: 0.5, depletion: 0.2, temp: [20, 35], ponded: true, fungal: true },
  { id: 'wheat', name: 'Wheat', local: 'गेहूँ', group: 'Cereals', seasons: ['Rabi'], kc: [0.4, 1.15, 0.3], stages: [20, 30, 50, 30], rootDepth: 1.2, depletion: 0.55, temp: [12, 25] },
  { id: 'maize', name: 'Maize (Corn)', local: 'मक्का', group: 'Cereals', seasons: ['Kharif', 'Rabi', 'Zaid'], kc: [0.3, 1.2, 0.5], stages: [20, 35, 40, 30], rootDepth: 1.0, depletion: 0.55, temp: [18, 32] },
  { id: 'barley', name: 'Barley', local: 'जौ', group: 'Cereals', seasons: ['Rabi'], kc: [0.3, 1.15, 0.25], stages: [20, 25, 50, 30], rootDepth: 1.0, depletion: 0.55, temp: [12, 25] },
  // Millets
  { id: 'jowar', name: 'Jowar (Sorghum)', local: 'ज्वार', group: 'Millets', seasons: ['Kharif', 'Rabi'], kc: [0.3, 1.0, 0.55], stages: [20, 35, 40, 30], rootDepth: 1.2, depletion: 0.55, temp: [25, 35] },
  { id: 'bajra', name: 'Bajra (Pearl millet)', local: 'बाजरा', group: 'Millets', seasons: ['Kharif', 'Zaid'], kc: [0.3, 1.0, 0.3], stages: [15, 25, 40, 25], rootDepth: 1.0, depletion: 0.6, temp: [25, 38] },
  { id: 'ragi', name: 'Ragi (Finger millet)', local: 'रागी', group: 'Millets', seasons: ['Kharif', 'Rabi'], kc: [0.3, 1.0, 0.3], stages: [20, 30, 40, 25], rootDepth: 0.8, depletion: 0.55, temp: [20, 32] },
  // Pulses
  { id: 'chana', name: 'Chickpea (Chana)', local: 'चना', group: 'Pulses', seasons: ['Rabi'], kc: [0.4, 1.0, 0.35], stages: [20, 30, 40, 20], rootDepth: 0.8, depletion: 0.5, temp: [15, 28] },
  { id: 'tur', name: 'Pigeon pea (Arhar / Tur)', local: 'अरहर', group: 'Pulses', seasons: ['Kharif'], kc: [0.4, 1.15, 0.35], stages: [20, 40, 70, 40], rootDepth: 1.0, depletion: 0.55, temp: [20, 35] },
  { id: 'moong', name: 'Green gram (Moong)', local: 'मूँग', group: 'Pulses', seasons: ['Kharif', 'Zaid'], kc: [0.4, 1.05, 0.6], stages: [15, 25, 25, 10], rootDepth: 0.6, depletion: 0.45, temp: [25, 35] },
  { id: 'urad', name: 'Black gram (Urad)', local: 'उड़द', group: 'Pulses', seasons: ['Kharif', 'Zaid'], kc: [0.4, 1.05, 0.6], stages: [15, 25, 25, 15], rootDepth: 0.6, depletion: 0.45, temp: [25, 35] },
  { id: 'masoor', name: 'Lentil (Masoor)', local: 'मसूर', group: 'Pulses', seasons: ['Rabi'], kc: [0.4, 1.1, 0.3], stages: [20, 30, 60, 20], rootDepth: 0.6, depletion: 0.5, temp: [15, 27] },
  // Oilseeds
  { id: 'groundnut', name: 'Groundnut (Peanut)', local: 'मूँगफली', group: 'Oilseeds', seasons: ['Kharif', 'Rabi'], kc: [0.4, 1.15, 0.6], stages: [25, 35, 45, 25], rootDepth: 0.6, depletion: 0.5, temp: [22, 33] },
  { id: 'mustard', name: 'Mustard (Sarson)', local: 'सरसों', group: 'Oilseeds', seasons: ['Rabi'], kc: [0.35, 1.0, 0.35], stages: [20, 30, 40, 25], rootDepth: 1.0, depletion: 0.6, temp: [10, 25] },
  { id: 'soybean', name: 'Soybean', local: 'सोयाबीन', group: 'Oilseeds', seasons: ['Kharif'], kc: [0.4, 1.15, 0.5], stages: [15, 25, 50, 20], rootDepth: 0.8, depletion: 0.5, temp: [20, 32] },
  { id: 'sunflower', name: 'Sunflower', local: 'सूरजमुखी', group: 'Oilseeds', seasons: ['Kharif', 'Rabi', 'Zaid'], kc: [0.35, 1.1, 0.35], stages: [25, 35, 45, 25], rootDepth: 1.0, depletion: 0.45, temp: [20, 30] },
  { id: 'sesame', name: 'Sesame (Til)', local: 'तिल', group: 'Oilseeds', seasons: ['Kharif', 'Zaid'], kc: [0.35, 1.1, 0.25], stages: [20, 30, 40, 20], rootDepth: 1.0, depletion: 0.6, temp: [25, 35] },
  { id: 'castor', name: 'Castor', local: 'अरंडी', group: 'Oilseeds', seasons: ['Kharif'], kc: [0.35, 1.15, 0.55], stages: [25, 40, 65, 50], rootDepth: 1.2, depletion: 0.5, temp: [20, 33] },
  // Cash crops
  { id: 'cotton', name: 'Cotton', local: 'कपास', group: 'Cash crops', seasons: ['Kharif'], kc: [0.35, 1.2, 0.6], stages: [30, 50, 55, 45], rootDepth: 1.2, depletion: 0.65, temp: [21, 35] },
  { id: 'sugarcane', name: 'Sugarcane', local: 'गन्ना', group: 'Cash crops', seasons: ['Perennial'], kc: [0.4, 1.25, 0.75], stages: [35, 60, 190, 80], rootDepth: 1.2, depletion: 0.65, temp: [20, 35] },
  { id: 'jute', name: 'Jute', local: 'पटसन', group: 'Cash crops', seasons: ['Kharif'], kc: [0.5, 1.15, 0.9], stages: [20, 30, 50, 20], rootDepth: 0.9, depletion: 0.4, temp: [24, 37] },
  { id: 'tobacco', name: 'Tobacco', local: 'तम्बाकू', group: 'Cash crops', seasons: ['Rabi'], kc: [0.5, 1.1, 0.8], stages: [20, 30, 30, 30], rootDepth: 0.8, depletion: 0.5, temp: [20, 30] },
  // Vegetables
  { id: 'potato', name: 'Potato', local: 'आलू', group: 'Vegetables', seasons: ['Rabi'], kc: [0.5, 1.15, 0.75], stages: [25, 30, 45, 30], rootDepth: 0.5, depletion: 0.35, temp: [15, 24], fungal: true },
  { id: 'onion', name: 'Onion', local: 'प्याज़', group: 'Vegetables', seasons: ['Rabi', 'Kharif'], kc: [0.7, 1.05, 0.75], stages: [15, 25, 70, 40], rootDepth: 0.4, depletion: 0.3, temp: [13, 28], fungal: true },
  { id: 'tomato', name: 'Tomato', local: 'टमाटर', group: 'Vegetables', seasons: ['Rabi', 'Kharif', 'Zaid'], kc: [0.6, 1.15, 0.8], stages: [30, 40, 40, 25], rootDepth: 0.8, depletion: 0.4, temp: [18, 30], fungal: true },
  { id: 'brinjal', name: 'Brinjal (Baingan)', local: 'बैंगन', group: 'Vegetables', seasons: ['Kharif', 'Rabi', 'Zaid'], kc: [0.6, 1.05, 0.9], stages: [30, 40, 40, 20], rootDepth: 0.8, depletion: 0.45, temp: [20, 32] },
  { id: 'chilli', name: 'Chilli (Mirchi)', local: 'मिर्च', group: 'Vegetables', seasons: ['Kharif', 'Rabi'], kc: [0.6, 1.05, 0.9], stages: [30, 35, 40, 20], rootDepth: 0.6, depletion: 0.3, temp: [20, 32], fungal: true },
  { id: 'okra', name: 'Okra (Bhindi)', local: 'भिंडी', group: 'Vegetables', seasons: ['Kharif', 'Zaid'], kc: [0.5, 1.05, 0.9], stages: [20, 30, 30, 20], rootDepth: 0.6, depletion: 0.45, temp: [22, 35] },
  { id: 'cabbage', name: 'Cabbage (Patta gobhi)', local: 'पत्ता गोभी', group: 'Vegetables', seasons: ['Rabi'], kc: [0.7, 1.05, 0.95], stages: [30, 40, 50, 15], rootDepth: 0.5, depletion: 0.45, temp: [12, 24] },
  { id: 'cauliflower', name: 'Cauliflower (Phool gobhi)', local: 'फूलगोभी', group: 'Vegetables', seasons: ['Rabi'], kc: [0.7, 1.05, 0.95], stages: [30, 35, 40, 15], rootDepth: 0.5, depletion: 0.45, temp: [12, 25] },
  { id: 'cucumber', name: 'Cucumber (Kheera)', local: 'खीरा', group: 'Vegetables', seasons: ['Zaid', 'Kharif'], kc: [0.6, 1.0, 0.75], stages: [20, 30, 40, 15], rootDepth: 0.7, depletion: 0.5, temp: [20, 32], fungal: true },
  { id: 'peas', name: 'Green peas (Matar)', local: 'मटर', group: 'Vegetables', seasons: ['Rabi'], kc: [0.5, 1.15, 1.1], stages: [20, 30, 35, 15], rootDepth: 0.7, depletion: 0.35, temp: [10, 24] },
  // Fruits
  { id: 'banana', name: 'Banana', local: 'केला', group: 'Fruits', seasons: ['Perennial'], kc: [0.5, 1.1, 1.0], stages: [120, 90, 120, 35], rootDepth: 0.7, depletion: 0.35, temp: [20, 35], fungal: true, perennial: true },
  { id: 'mango', name: 'Mango', local: 'आम', group: 'Fruits', seasons: ['Perennial'], kc: [0.6, 0.85, 0.75], stages: [60, 90, 150, 65], rootDepth: 1.5, depletion: 0.6, temp: [24, 35], perennial: true },
  { id: 'grapes', name: 'Grapes', local: 'अंगूर', group: 'Fruits', seasons: ['Perennial'], kc: [0.3, 0.85, 0.45], stages: [20, 40, 120, 60], rootDepth: 1.0, depletion: 0.35, temp: [15, 35], fungal: true, perennial: true },
  { id: 'pomegranate', name: 'Pomegranate (Anar)', local: 'अनार', group: 'Fruits', seasons: ['Perennial'], kc: [0.5, 0.9, 0.65], stages: [60, 90, 150, 65], rootDepth: 1.0, depletion: 0.5, temp: [25, 38], perennial: true },
  { id: 'citrus', name: 'Citrus (Orange / Kinnow)', local: 'संतरा', group: 'Fruits', seasons: ['Perennial'], kc: [0.7, 0.65, 0.7], stages: [60, 90, 120, 95], rootDepth: 1.2, depletion: 0.5, temp: [15, 33], perennial: true },
  { id: 'papaya', name: 'Papaya', local: 'पपीता', group: 'Fruits', seasons: ['Perennial'], kc: [0.6, 1.0, 0.9], stages: [60, 90, 150, 65], rootDepth: 0.8, depletion: 0.35, temp: [22, 35], fungal: true, perennial: true },
  { id: 'guava', name: 'Guava (Amrood)', local: 'अमरूद', group: 'Fruits', seasons: ['Perennial'], kc: [0.55, 0.85, 0.7], stages: [60, 90, 150, 65], rootDepth: 1.2, depletion: 0.5, temp: [20, 35], perennial: true },
  // Spices
  { id: 'turmeric', name: 'Turmeric (Haldi)', local: 'हल्दी', group: 'Spices', seasons: ['Kharif'], kc: [0.5, 1.05, 0.75], stages: [30, 60, 120, 40], rootDepth: 0.5, depletion: 0.4, temp: [20, 32] },
  { id: 'ginger', name: 'Ginger (Adrak)', local: 'अदरक', group: 'Spices', seasons: ['Kharif'], kc: [0.5, 1.05, 0.75], stages: [30, 60, 110, 40], rootDepth: 0.4, depletion: 0.4, temp: [20, 30], fungal: true },
  { id: 'garlic', name: 'Garlic (Lahsun)', local: 'लहसुन', group: 'Spices', seasons: ['Rabi'], kc: [0.7, 1.0, 0.7], stages: [20, 30, 70, 20], rootDepth: 0.4, depletion: 0.3, temp: [12, 25] },
  { id: 'cumin', name: 'Cumin (Jeera)', local: 'जीरा', group: 'Spices', seasons: ['Rabi'], kc: [0.4, 1.0, 0.5], stages: [20, 30, 40, 20], rootDepth: 0.5, depletion: 0.5, temp: [12, 28], fungal: true },
  { id: 'coriander', name: 'Coriander (Dhaniya)', local: 'धनिया', group: 'Spices', seasons: ['Rabi'], kc: [0.5, 1.0, 0.8], stages: [20, 25, 30, 15], rootDepth: 0.5, depletion: 0.4, temp: [15, 28] },
  // Plantation
  { id: 'coconut', name: 'Coconut', local: 'नारियल', group: 'Plantation', seasons: ['Perennial'], kc: [1.0, 1.0, 1.0], stages: [60, 90, 150, 65], rootDepth: 1.0, depletion: 0.65, temp: [22, 34], perennial: true },
  { id: 'tea', name: 'Tea', local: 'चाय', group: 'Plantation', seasons: ['Perennial'], kc: [0.95, 1.0, 1.0], stages: [60, 90, 150, 65], rootDepth: 0.9, depletion: 0.4, temp: [18, 30], fungal: true, perennial: true },
  { id: 'coffee', name: 'Coffee', local: 'कॉफ़ी', group: 'Plantation', seasons: ['Perennial'], kc: [0.9, 0.95, 0.95], stages: [60, 90, 150, 65], rootDepth: 1.0, depletion: 0.4, temp: [15, 28], fungal: true, perennial: true },
  { id: 'pepper', name: 'Black pepper', local: 'काली मिर्च', group: 'Plantation', seasons: ['Perennial'], kc: [0.9, 0.95, 0.95], stages: [60, 90, 150, 65], rootDepth: 0.6, depletion: 0.4, temp: [20, 32], fungal: true, perennial: true },
]

export const CROP_GROUPS: CropGroup[] = [
  'Cereals',
  'Millets',
  'Pulses',
  'Oilseeds',
  'Cash crops',
  'Vegetables',
  'Fruits',
  'Spices',
  'Plantation',
]

export function cropById(id: string) {
  return CROPS.find((c) => c.id === id)
}

/* ---------- Climate ---------- */

export type ClimateZone =
  | 'north-plains'
  | 'arid-west'
  | 'central'
  | 'west-semiarid'
  | 'deccan'
  | 'east-humid'
  | 'coastal-south'
  | 'west-coast'
  | 'northeast'
  | 'himalayan'

interface ClimateNormals {
  label: string
  /** Monthly mean daily max / min air temperature, degrees C, Jan..Dec. */
  tmax: number[]
  tmin: number[]
  /** Monthly rainfall, mm, Jan..Dec. */
  rain: number[]
  /** Monthly mean relative humidity, percent. */
  rh: number[]
}

export const CLIMATE: Record<ClimateZone, ClimateNormals> = {
  'north-plains': {
    label: 'Indo-Gangetic plains (hot summers, cool winters)',
    tmax: [20, 23, 29, 36, 40, 39, 35, 34, 34, 32, 27, 22],
    tmin: [7, 9, 14, 20, 25, 28, 27, 27, 25, 19, 12, 8],
    rain: [20, 25, 20, 10, 20, 70, 220, 220, 120, 15, 5, 10],
    rh: [70, 62, 50, 35, 35, 50, 75, 80, 72, 60, 62, 70],
  },
  'arid-west': {
    label: 'Arid / semi-arid Thar region',
    tmax: [23, 26, 32, 38, 41, 40, 36, 34, 35, 34, 29, 24],
    tmin: [8, 11, 16, 22, 27, 28, 27, 26, 24, 19, 13, 9],
    rain: [5, 6, 4, 4, 12, 50, 160, 150, 60, 8, 3, 3],
    rh: [50, 42, 32, 25, 30, 45, 65, 72, 60, 40, 40, 48],
  },
  central: {
    label: 'Central India plateau',
    tmax: [25, 28, 33, 38, 41, 36, 30, 29, 31, 31, 28, 25],
    tmin: [10, 12, 17, 22, 26, 26, 24, 23, 22, 18, 13, 10],
    rain: [15, 15, 10, 5, 10, 140, 330, 320, 190, 40, 10, 5],
    rh: [60, 50, 38, 28, 30, 58, 82, 86, 78, 62, 58, 60],
  },
  'west-semiarid': {
    label: 'Western semi-arid (Gujarat, Maharashtra interior)',
    tmax: [29, 32, 36, 39, 40, 35, 31, 30, 31, 33, 31, 29],
    tmin: [12, 14, 19, 23, 26, 25, 24, 23, 23, 20, 15, 12],
    rain: [3, 1, 2, 3, 10, 150, 250, 200, 150, 40, 10, 3],
    rh: [45, 40, 35, 38, 50, 68, 80, 82, 75, 55, 45, 45],
  },
  deccan: {
    label: 'Deccan plateau',
    tmax: [29, 32, 35, 37, 38, 33, 30, 29, 30, 30, 29, 28],
    tmin: [15, 17, 20, 23, 25, 23, 22, 22, 21, 20, 17, 15],
    rain: [5, 5, 10, 20, 40, 110, 160, 170, 170, 110, 30, 5],
    rh: [55, 48, 42, 42, 48, 65, 74, 76, 74, 68, 62, 58],
  },
  'east-humid': {
    label: 'Eastern humid plains (Bihar, Bengal, Odisha)',
    tmax: [24, 27, 33, 36, 36, 34, 32, 32, 32, 31, 29, 25],
    tmin: [11, 14, 19, 23, 25, 26, 26, 26, 25, 22, 16, 12],
    rain: [15, 20, 25, 40, 100, 250, 320, 300, 250, 120, 20, 10],
    rh: [70, 62, 52, 55, 65, 78, 85, 86, 84, 76, 70, 70],
  },
  'coastal-south': {
    label: 'Southern tropical (Tamil Nadu, coastal Andhra)',
    tmax: [29, 31, 33, 35, 37, 36, 35, 34, 33, 32, 30, 29],
    tmin: [21, 22, 24, 27, 28, 27, 26, 26, 25, 24, 23, 21],
    rain: [25, 10, 5, 15, 50, 50, 80, 120, 120, 280, 350, 140],
    rh: [72, 68, 66, 68, 62, 58, 62, 66, 70, 78, 80, 76],
  },
  'west-coast': {
    label: 'Humid west coast (Kerala, Konkan, Goa)',
    tmax: [32, 32, 33, 33, 32, 29, 28, 28, 29, 30, 31, 32],
    tmin: [22, 23, 25, 26, 26, 24, 23, 24, 24, 24, 23, 22],
    rain: [10, 15, 30, 110, 250, 650, 650, 400, 250, 300, 160, 40],
    rh: [68, 70, 72, 74, 78, 86, 88, 87, 84, 82, 76, 70],
  },
  northeast: {
    label: 'North-east humid subtropical',
    tmax: [23, 25, 29, 30, 31, 31, 32, 32, 31, 30, 27, 24],
    tmin: [10, 12, 16, 20, 23, 25, 25, 25, 24, 21, 15, 11],
    rain: [15, 30, 70, 160, 280, 330, 350, 300, 250, 130, 20, 10],
    rh: [78, 72, 66, 74, 80, 85, 86, 86, 85, 82, 80, 80],
  },
  himalayan: {
    label: 'Himalayan hill region',
    tmax: [12, 14, 19, 24, 28, 30, 28, 27, 26, 23, 19, 14],
    tmin: [0, 2, 6, 10, 14, 17, 18, 18, 15, 9, 4, 1],
    rain: [70, 80, 80, 50, 50, 120, 250, 250, 120, 30, 15, 35],
    rh: [65, 62, 58, 50, 50, 65, 82, 85, 78, 62, 58, 62],
  },
}

/* ---------- Locations ---------- */

export interface District {
  name: string
  lat: number
  lon: number
  zone: ClimateZone
}

export interface StateInfo {
  name: string
  districts: District[]
}

const d = (name: string, lat: number, lon: number, zone: ClimateZone): District => ({ name, lat, lon, zone })

export const STATES: StateInfo[] = [
  { name: 'Andhra Pradesh', districts: [d('Guntur', 16.31, 80.44, 'coastal-south'), d('Krishna (Vijayawada)', 16.51, 80.65, 'coastal-south'), d('Anantapur', 14.68, 77.6, 'deccan'), d('Kurnool', 15.83, 78.04, 'deccan'), d('East Godavari', 16.99, 82.25, 'coastal-south')] },
  { name: 'Arunachal Pradesh', districts: [d('Papum Pare (Itanagar)', 27.08, 93.61, 'northeast'), d('East Siang (Pasighat)', 28.07, 95.33, 'northeast')] },
  { name: 'Assam', districts: [d('Kamrup', 26.14, 91.74, 'northeast'), d('Nagaon', 26.35, 92.68, 'northeast'), d('Jorhat', 26.75, 94.2, 'northeast'), d('Dibrugarh', 27.48, 94.91, 'northeast')] },
  { name: 'Bihar', districts: [d('Patna', 25.59, 85.14, 'east-humid'), d('Muzaffarpur', 26.12, 85.39, 'east-humid'), d('Bhagalpur', 25.24, 86.98, 'east-humid'), d('Purnia', 25.78, 87.47, 'east-humid')] },
  { name: 'Chhattisgarh', districts: [d('Raipur', 21.25, 81.63, 'central'), d('Durg', 21.19, 81.28, 'central'), d('Bilaspur', 22.08, 82.14, 'central')] },
  { name: 'Goa', districts: [d('North Goa', 15.49, 73.83, 'west-coast'), d('South Goa', 15.27, 73.96, 'west-coast')] },
  { name: 'Gujarat', districts: [d('Ahmedabad', 23.02, 72.57, 'west-semiarid'), d('Rajkot', 22.3, 70.8, 'west-semiarid'), d('Banaskantha', 24.17, 72.43, 'west-semiarid'), d('Surat', 21.17, 72.83, 'west-semiarid'), d('Junagadh', 21.52, 70.46, 'west-semiarid')] },
  { name: 'Haryana', districts: [d('Karnal', 29.69, 76.99, 'north-plains'), d('Hisar', 29.15, 75.72, 'north-plains'), d('Sirsa', 29.53, 75.03, 'north-plains'), d('Kurukshetra', 29.97, 76.85, 'north-plains')] },
  { name: 'Himachal Pradesh', districts: [d('Shimla', 31.1, 77.17, 'himalayan'), d('Kangra', 32.1, 76.27, 'himalayan'), d('Kullu', 31.96, 77.11, 'himalayan'), d('Una', 31.47, 76.27, 'north-plains')] },
  { name: 'Jharkhand', districts: [d('Ranchi', 23.34, 85.31, 'east-humid'), d('Hazaribagh', 23.99, 85.36, 'east-humid'), d('Dumka', 24.27, 87.25, 'east-humid')] },
  { name: 'Karnataka', districts: [d('Belagavi', 15.85, 74.5, 'deccan'), d('Mandya', 12.52, 76.9, 'deccan'), d('Raichur', 16.2, 77.36, 'deccan'), d('Dharwad', 15.46, 75.01, 'deccan'), d('Dakshina Kannada', 12.87, 74.88, 'west-coast'), d('Kodagu (Coorg)', 12.42, 75.74, 'west-coast')] },
  { name: 'Kerala', districts: [d('Palakkad', 10.78, 76.65, 'west-coast'), d('Thrissur', 10.53, 76.21, 'west-coast'), d('Wayanad', 11.69, 76.08, 'west-coast'), d('Idukki', 9.85, 76.97, 'west-coast'), d('Alappuzha (Kuttanad)', 9.49, 76.33, 'west-coast')] },
  { name: 'Madhya Pradesh', districts: [d('Indore', 22.72, 75.86, 'central'), d('Bhopal', 23.26, 77.41, 'central'), d('Jabalpur', 23.18, 79.99, 'central'), d('Ujjain', 23.18, 75.78, 'central'), d('Hoshangabad (Narmadapuram)', 22.75, 77.72, 'central')] },
  { name: 'Maharashtra', districts: [d('Nashik', 20.0, 73.79, 'west-semiarid'), d('Pune', 18.52, 73.86, 'west-semiarid'), d('Nagpur', 21.15, 79.09, 'central'), d('Chhatrapati Sambhajinagar', 19.88, 75.34, 'west-semiarid'), d('Kolhapur', 16.7, 74.24, 'west-semiarid'), d('Ratnagiri', 16.99, 73.3, 'west-coast')] },
  { name: 'Manipur', districts: [d('Imphal West', 24.82, 93.94, 'northeast'), d('Thoubal', 24.64, 94.01, 'northeast')] },
  { name: 'Meghalaya', districts: [d('East Khasi Hills', 25.58, 91.89, 'northeast'), d('West Garo Hills', 25.51, 90.22, 'northeast')] },
  { name: 'Mizoram', districts: [d('Aizawl', 23.73, 92.72, 'northeast'), d('Lunglei', 22.88, 92.73, 'northeast')] },
  { name: 'Nagaland', districts: [d('Kohima', 25.67, 94.11, 'northeast'), d('Dimapur', 25.91, 93.73, 'northeast')] },
  { name: 'Odisha', districts: [d('Cuttack', 20.46, 85.88, 'east-humid'), d('Sambalpur', 21.47, 83.97, 'east-humid'), d('Ganjam', 19.39, 84.88, 'east-humid'), d('Bargarh', 21.33, 83.62, 'east-humid')] },
  { name: 'Punjab', districts: [d('Ludhiana', 30.9, 75.85, 'north-plains'), d('Amritsar', 31.63, 74.87, 'north-plains'), d('Bathinda', 30.21, 74.95, 'north-plains'), d('Patiala', 30.34, 76.39, 'north-plains'), d('Sangrur', 30.25, 75.84, 'north-plains')] },
  { name: 'Rajasthan', districts: [d('Jaipur', 26.91, 75.79, 'arid-west'), d('Jodhpur', 26.24, 73.02, 'arid-west'), d('Sri Ganganagar', 29.9, 73.88, 'arid-west'), d('Kota', 25.21, 75.86, 'central'), d('Bikaner', 28.02, 73.31, 'arid-west')] },
  { name: 'Sikkim', districts: [d('Gangtok (East Sikkim)', 27.33, 88.61, 'himalayan'), d('Namchi (South Sikkim)', 27.17, 88.36, 'himalayan')] },
  { name: 'Tamil Nadu', districts: [d('Thanjavur', 10.79, 79.14, 'coastal-south'), d('Coimbatore', 11.02, 76.96, 'coastal-south'), d('Madurai', 9.93, 78.12, 'coastal-south'), d('Salem', 11.66, 78.15, 'coastal-south'), d('Tiruchirappalli', 10.8, 78.69, 'coastal-south'), d('The Nilgiris', 11.41, 76.7, 'himalayan')] },
  { name: 'Telangana', districts: [d('Warangal', 17.97, 79.59, 'deccan'), d('Nalgonda', 17.05, 79.27, 'deccan'), d('Karimnagar', 18.44, 79.13, 'deccan'), d('Nizamabad', 18.67, 78.09, 'deccan'), d('Khammam', 17.25, 80.15, 'deccan')] },
  { name: 'Tripura', districts: [d('West Tripura (Agartala)', 23.83, 91.28, 'northeast')] },
  { name: 'Uttar Pradesh', districts: [d('Lucknow', 26.85, 80.95, 'north-plains'), d('Meerut', 28.98, 77.71, 'north-plains'), d('Varanasi', 25.32, 82.97, 'north-plains'), d('Gorakhpur', 26.76, 83.37, 'north-plains'), d('Agra', 27.18, 78.01, 'north-plains'), d('Bareilly', 28.37, 79.43, 'north-plains')] },
  { name: 'Uttarakhand', districts: [d('Dehradun', 30.32, 78.03, 'himalayan'), d('Udham Singh Nagar', 28.98, 79.4, 'north-plains'), d('Nainital', 29.38, 79.46, 'himalayan'), d('Haridwar', 29.95, 78.16, 'north-plains')] },
  { name: 'West Bengal', districts: [d('Purba Bardhaman', 23.23, 87.86, 'east-humid'), d('Nadia', 23.47, 88.56, 'east-humid'), d('Murshidabad', 24.18, 88.27, 'east-humid'), d('Darjeeling', 27.04, 88.26, 'himalayan'), d('Hooghly', 22.9, 88.39, 'east-humid')] },
  // Union territories
  { name: 'Andaman and Nicobar Islands', districts: [d('South Andaman', 11.62, 92.73, 'west-coast')] },
  { name: 'Chandigarh', districts: [d('Chandigarh', 30.73, 76.78, 'north-plains')] },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', districts: [d('Dadra and Nagar Haveli', 20.27, 73.02, 'west-semiarid'), d('Daman', 20.4, 72.83, 'west-semiarid')] },
  { name: 'Delhi', districts: [d('North West Delhi', 28.71, 77.07, 'north-plains'), d('South West Delhi', 28.58, 77.03, 'north-plains')] },
  { name: 'Jammu and Kashmir', districts: [d('Jammu', 32.73, 74.86, 'north-plains'), d('Srinagar', 34.08, 74.8, 'himalayan'), d('Anantnag', 33.73, 75.15, 'himalayan')] },
  { name: 'Ladakh', districts: [d('Leh', 34.15, 77.58, 'himalayan'), d('Kargil', 34.56, 76.13, 'himalayan')] },
  { name: 'Lakshadweep', districts: [d('Kavaratti', 10.57, 72.64, 'west-coast')] },
  { name: 'Puducherry', districts: [d('Puducherry', 11.94, 79.81, 'coastal-south'), d('Karaikal', 10.92, 79.84, 'coastal-south')] },
]

/** Nearest district to a GPS fix, for the "use my location" button. */
export function nearestDistrict(lat: number, lon: number): { state: string; district: District } {
  let best = { state: STATES[0].name, district: STATES[0].districts[0] }
  let bestDist = Infinity
  for (const state of STATES) {
    for (const district of state.districts) {
      const dist = (district.lat - lat) ** 2 + ((district.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2
      if (dist < bestDist) {
        bestDist = dist
        best = { state: state.name, district }
      }
    }
  }
  return best
}

/* ---------- Soil and irrigation ---------- */

export interface SoilProfile {
  id: string
  name: string
  hint: string
  /** Volumetric water content at field capacity and wilting point, percent. */
  fieldCapacity: number
  wiltingPoint: number
  /** Daily deep percolation under ponded rice, mm. */
  percolation: number
}

export const SOILS: SoilProfile[] = [
  { id: 'alluvial', name: 'Alluvial (loam)', hint: 'Indo-Gangetic plains, river deltas', fieldCapacity: 30, wiltingPoint: 13, percolation: 4 },
  { id: 'black', name: 'Black cotton soil (Regur)', hint: 'Maharashtra, MP, Gujarat, Telangana', fieldCapacity: 40, wiltingPoint: 22, percolation: 2 },
  { id: 'red', name: 'Red soil (sandy loam)', hint: 'Tamil Nadu, Karnataka, Odisha, Jharkhand', fieldCapacity: 22, wiltingPoint: 10, percolation: 6 },
  { id: 'laterite', name: 'Laterite', hint: 'Kerala, Konkan, Western Ghats, NE hills', fieldCapacity: 25, wiltingPoint: 12, percolation: 6 },
  { id: 'sandy', name: 'Sandy / desert soil', hint: 'Western Rajasthan, coastal sands', fieldCapacity: 12, wiltingPoint: 5, percolation: 10 },
  { id: 'clay-loam', name: 'Clay loam', hint: 'Heavy, slow-draining fields', fieldCapacity: 36, wiltingPoint: 18, percolation: 2 },
  { id: 'mountain', name: 'Mountain / forest soil', hint: 'Himalayan and hill slopes', fieldCapacity: 30, wiltingPoint: 14, percolation: 5 },
]

export function soilById(id: string) {
  return SOILS.find((s) => s.id === id) ?? SOILS[0]
}

export type IrrigationMethod = 'drip' | 'sprinkler' | 'flood'

export const IRRIGATION: Record<IrrigationMethod, { name: string; efficiency: number; acresPerZone: number; hint: string }> = {
  drip: { name: 'Drip', efficiency: 0.9, acresPerZone: 1, hint: 'Water at the root, ~90% efficient' },
  sprinkler: { name: 'Sprinkler', efficiency: 0.75, acresPerZone: 2, hint: 'Overhead spray, ~75% efficient' },
  flood: { name: 'Flood / furrow (canal or borewell)', efficiency: 0.55, acresPerZone: 2.5, hint: 'Traditional channels, ~55% efficient' },
}

export const ACRE_M2 = 4046.86

/* ---------- Sensors ---------- */

export type SensorPriority = 'Essential' | 'Recommended' | 'Optional'

export interface SensorItem {
  id: string
  name: string
  measures: string
  why: string
  /** Indicative Indian market price per unit, rupees. */
  unitPrice: number
  quantity: number
  priority: SensorPriority
  placement: string
}
