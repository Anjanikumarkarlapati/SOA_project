export interface FarmLocationProfile {
  stateCode: string;
  stateName: string;
  districtName: string;
  mandalOrBlock: string;
  lat?: number;
  lon?: number;
}

export interface IndianDistrict {
  name: string;
  lat: number;
  lon: number;
  mandals: string[];
}

export interface IndianState {
  code: string;
  name: string;
  districts: IndianDistrict[];
}

export const INDIAN_STATES: IndianState[] = [
  {
    code: "OD",
    name: "Odisha",
    districts: [
      {
        name: "Cuttack",
        lat: 20.4625,
        lon: 85.883,
        mandals: ["Cuttack Sadar", "Athagarh", "Banki", "Salepur", "Niali", "Tangi-Choudwar"],
      },
      {
        name: "Puri",
        lat: 19.8135,
        lon: 85.8312,
        mandals: ["Puri Sadar", "Pipili", "Nimapada", "Satyabadi", "Gop"],
      },
      {
        name: "Khordha",
        lat: 20.1825,
        lon: 85.6164,
        mandals: ["Bhubaneswar", "Jatni", "Balipatna", "Tangi", "Begunia"],
      },
      {
        name: "Balasore",
        lat: 21.4934,
        lon: 86.9135,
        mandals: ["Balasore Sadar", "Soro", "Jaleswar", "Bhograi", "Nilagiri"],
      },
      {
        name: "Sambalpur",
        lat: 21.4669,
        lon: 83.9812,
        mandals: ["Dhankauda", "Maneswar", "Rengali", "Kuchinda", "Rairakhol"],
      },
    ],
  },
  {
    code: "AP",
    name: "Andhra Pradesh",
    districts: [
      {
        name: "Guntur",
        lat: 16.3067,
        lon: 80.4365,
        mandals: ["Guntur East", "Tenali", "Mangalagiri", "Ponnur", "Tadikonda", "Prathipadu"],
      },
      {
        name: "Krishna",
        lat: 16.61,
        lon: 80.7214,
        mandals: ["Machilipatnam", "Gudivada", "Nuzvid", "Vuyyuru", "Kankipadu"],
      },
      {
        name: "East Godavari",
        lat: 17.0005,
        lon: 81.804,
        mandals: ["Rajahmundry", "Kakinada", "Amalapuram", "Mandapeta", "Peddapuram"],
      },
      {
        name: "Kurnool",
        lat: 15.8281,
        lon: 78.0373,
        mandals: ["Kurnool", "Adoni", "Nandyal", "Yemmiganur", "Dhone"],
      },
    ],
  },
  {
    code: "PB",
    name: "Punjab",
    districts: [
      {
        name: "Ludhiana",
        lat: 30.901,
        lon: 75.8573,
        mandals: ["Ludhiana I", "Jagraon", "Khanna", "Samrala", "Raikot"],
      },
      {
        name: "Amritsar",
        lat: 31.634,
        lon: 74.8723,
        mandals: ["Ajnala", "Baba Bakala", "Majitha", "Rayya", "Tarsikka"],
      },
      {
        name: "Patiala",
        lat: 30.3398,
        lon: 76.3869,
        mandals: ["Patiala", "Nabha", "Rajpura", "Samana", "Patran"],
      },
      {
        name: "Bathinda",
        lat: 30.211,
        lon: 74.9455,
        mandals: ["Bathinda", "Rampura Phul", "Talwandi Sabo", "Maur", "Sangat"],
      },
    ],
  },
  {
    code: "MH",
    name: "Maharashtra",
    districts: [
      {
        name: "Nashik",
        lat: 19.9975,
        lon: 73.7898,
        mandals: ["Niphad", "Dindori", "Sinnar", "Malegaon", "Igatpuri"],
      },
      {
        name: "Pune",
        lat: 18.5204,
        lon: 73.8567,
        mandals: ["Baramati", "Indapur", "Shirur", "Junnar", "Khed"],
      },
      {
        name: "Nagpur",
        lat: 21.1458,
        lon: 79.0882,
        mandals: ["Kamptee", "Katol", "Saoner", "Umred", "Ramtek"],
      },
    ],
  },
  {
    code: "UP",
    name: "Uttar Pradesh",
    districts: [
      {
        name: "Meerut",
        lat: 28.9845,
        lon: 77.7064,
        mandals: ["Meerut", "Mawana", "Sardhana", "Daurala", "Hastinapur"],
      },
      {
        name: "Varanasi",
        lat: 25.3176,
        lon: 82.9739,
        mandals: ["Kashi Vidyapeeth", "Pindra", "Chiraigaon", "Araziline", "Sevapuri"],
      },
      {
        name: "Lucknow",
        lat: 26.8467,
        lon: 80.9462,
        mandals: ["Malihabad", "Mohanlalganj", "Bakshi Ka Talab", "Sarojini Nagar"],
      },
    ],
  },
  {
    code: "MP",
    name: "Madhya Pradesh",
    districts: [
      {
        name: "Indore",
        lat: 22.7196,
        lon: 75.8577,
        mandals: ["Indore", "Mhow", "Sanwer", "Depalpur"],
      },
      {
        name: "Sehore",
        lat: 23.2032,
        lon: 77.0844,
        mandals: ["Sehore", "Ashta", "Ichhawar", "Budhni", "Nasrullaganj"],
      },
      {
        name: "Ujjain",
        lat: 23.1765,
        lon: 75.7885,
        mandals: ["Ujjain", "Barnagar", "Khachrod", "Mahidpur", "Tarana"],
      },
    ],
  },
  {
    code: "TN",
    name: "Tamil Nadu",
    districts: [
      {
        name: "Thanjavur",
        lat: 10.787,
        lon: 79.1378,
        mandals: ["Thanjavur", "Kumbakonam", "Pattukkottai", "Orathanadu", "Papanasam"],
      },
      {
        name: "Coimbatore",
        lat: 11.0168,
        lon: 76.9558,
        mandals: ["Pollachi", "Mettupalayam", "Sulur", "Kinathukadavu"],
      },
      {
        name: "Erode",
        lat: 11.341,
        lon: 77.7172,
        mandals: ["Erode", "Gobichettipalayam", "Bhavani", "Sathyamangalam"],
      },
    ],
  },
  {
    code: "KA",
    name: "Karnataka",
    districts: [
      {
        name: "Mandya",
        lat: 12.5218,
        lon: 76.8951,
        mandals: ["Mandya", "Maddur", "Malavalli", "Pandavapura", "Srirangapatna"],
      },
      {
        name: "Belagavi",
        lat: 15.8497,
        lon: 74.4977,
        mandals: ["Belagavi", "Gokak", "Athani", "Bailhongal", "Chikkodi"],
      },
      {
        name: "Mysuru",
        lat: 12.2958,
        lon: 76.6394,
        mandals: ["Mysuru", "Nanjangud", "Hunsur", "T. Narasipura"],
      },
    ],
  },
  {
    code: "GJ",
    name: "Gujarat",
    districts: [
      {
        name: "Anand",
        lat: 22.5645,
        lon: 72.9289,
        mandals: ["Anand", "Petlad", "Borsad", "Umreth", "Khambhat"],
      },
      {
        name: "Rajkot",
        lat: 22.3039,
        lon: 70.8022,
        mandals: ["Rajkot", "Gondal", "Jetpur", "Jasdan", "Dhoraji"],
      },
      {
        name: "Banaskantha",
        lat: 24.1724,
        lon: 72.4346,
        mandals: ["Palanpur", "Deesa", "Tharad", "Dhanera"],
      },
    ],
  },
  {
    code: "WB",
    name: "West Bengal",
    districts: [
      {
        name: "Purba Bardhaman",
        lat: 23.2324,
        lon: 87.8615,
        mandals: ["Bardhaman I", "Kalna", "Katwa", "Memari", "Guskara"],
      },
      {
        name: "Hooghly",
        lat: 22.8963,
        lon: 88.2461,
        mandals: ["Singur", "Tarakeswar", "Arambagh", "Dhaniakhali", "Pandua"],
      },
      {
        name: "Nadia",
        lat: 23.471,
        lon: 88.5565,
        mandals: ["Krishnanagar", "Ranaghat", "Kalyani", "Tehatta"],
      },
    ],
  },
  {
    code: "KL",
    name: "Kerala",
    districts: [
      {
        name: "Palakkad",
        lat: 10.7867,
        lon: 76.6548,
        mandals: ["Palakkad", "Alathur", "Chittur", "Ottapalam", "Mannarkkad"],
      },
      {
        name: "Wayanad",
        lat: 11.6854,
        lon: 76.132,
        mandals: ["Kalpetta", "Mananthavady", "Sulthan Bathery", "Panamaram"],
      },
      {
        name: "Thrissur",
        lat: 10.5276,
        lon: 76.2144,
        mandals: ["Thrissur", "Chalakudy", "Kodungallur", "Irinjalakuda"],
      },
    ],
  },
  {
    code: "RJ",
    name: "Rajasthan",
    districts: [
      {
        name: "Sri Ganganagar",
        lat: 29.9038,
        lon: 73.8772,
        mandals: ["Sri Ganganagar", "Suratgarh", "Raisinghnagar", "Karanpur"],
      },
      {
        name: "Kota",
        lat: 25.2138,
        lon: 75.8648,
        mandals: ["Ladpura", "Sangod", "Ramganj Mandi", "Itawa"],
      },
      {
        name: "Jaipur",
        lat: 26.9124,
        lon: 75.7873,
        mandals: ["Chomu", "Bassi", "Shahpura", "Sanganer"],
      },
    ],
  },
  {
    code: "HR",
    name: "Haryana",
    districts: [
      {
        name: "Karnal",
        lat: 29.6857,
        lon: 76.9905,
        mandals: ["Karnal", "Gharaunda", "Assandh", "Indri", "Nilokheri"],
      },
      {
        name: "Hisar",
        lat: 29.1492,
        lon: 75.7217,
        mandals: ["Hisar", "Hansi", "Barwala", "Narnaund"],
      },
      {
        name: "Kurukshetra",
        lat: 29.9695,
        lon: 76.8783,
        mandals: ["Thanesar", "Pehowa", "Shahbad", "Ladwa"],
      },
    ],
  },
  {
    code: "BR",
    name: "Bihar",
    districts: [
      {
        name: "Nalanda",
        lat: 25.1357,
        lon: 85.4437,
        mandals: ["Bihar Sharif", "Rajgir", "Hilsa", "Asthawan"],
      },
      {
        name: "Patna",
        lat: 25.5941,
        lon: 85.1376,
        mandals: ["Danapur", "Barh", "Masaurhi", "Bihta", "Phulwari Sharif"],
      },
      {
        name: "Muzaffarpur",
        lat: 26.1209,
        lon: 85.3647,
        mandals: ["Mushahri", "Kanti", "Motipur", "Sakra"],
      },
    ],
  },
  {
    code: "TS",
    name: "Telangana",
    districts: [
      {
        name: "Nizamabad",
        lat: 18.6725,
        lon: 78.0941,
        mandals: ["Nizamabad", "Bodhan", "Armoor", "Balkonda"],
      },
      {
        name: "Karimnagar",
        lat: 18.4386,
        lon: 79.1288,
        mandals: ["Karimnagar", "Huzurabad", "Choppadandi", "Manakondur"],
      },
      {
        name: "Warangal",
        lat: 17.9689,
        lon: 79.5941,
        mandals: ["Warangal", "Narsampet", "Wardhannapet", "Parakal"],
      },
    ],
  },
];

export const DEFAULT_FARM_LOCATION: FarmLocationProfile = {
  stateCode: "OD",
  stateName: "Odisha",
  districtName: "Cuttack",
  mandalOrBlock: "Cuttack Sadar",
  lat: 20.4625,
  lon: 85.883,
};

export function getDistrictsForState(stateCode: string): IndianDistrict[] {
  const normalized = stateCode.trim().toUpperCase();
  return INDIAN_STATES.find((s) => s.code === normalized)?.districts ?? [];
}

export function getMandalsForDistrict(stateCode: string, districtName: string): string[] {
  const districts = getDistrictsForState(stateCode);
  const match = districts.find(
    (d) => d.name.toLowerCase() === districtName.trim().toLowerCase()
  );
  return match?.mandals ?? [];
}

/**
 * Infers a FarmLocationProfile from a farm's address string (e.g. "Guntur, Andhra Pradesh").
 * Returns null when no known state/district matches.
 */
export function inferLocationFromAddress(address?: string | null): FarmLocationProfile | null {
  if (!address) return null;
  const norm = address.toLowerCase();
  for (const state of INDIAN_STATES) {
    for (const dist of state.districts) {
      if (norm.includes(dist.name.toLowerCase())) {
        return {
          stateCode: state.code,
          stateName: state.name,
          districtName: dist.name,
          mandalOrBlock: dist.mandals[0] ?? "",
          lat: dist.lat,
          lon: dist.lon,
        };
      }
    }
    if (norm.includes(state.name.toLowerCase())) {
      const firstDist = state.districts[0];
      return {
        stateCode: state.code,
        stateName: state.name,
        districtName: firstDist?.name ?? "",
        mandalOrBlock: firstDist?.mandals[0] ?? "",
        lat: firstDist?.lat,
        lon: firstDist?.lon,
      };
    }
  }
  return null;
}
