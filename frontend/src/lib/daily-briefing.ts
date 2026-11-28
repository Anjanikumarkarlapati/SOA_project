import { getCropById } from "@/lib/crops";
import { computeWaterBudget, evaluateValveInterlock } from "@/lib/fieldshield";
import type { LanguageCode } from "@/lib/i18n";
import type { FarmProperty } from "@/lib/property-store";

export interface DailyBriefingWeatherInput {
  todayEt0?: number;
  todayRainMm?: number;
  rainProbMax?: number;
  currentWindKmh?: number;
  currentSoilMoisturePct?: number;
  soilMoisturePct?: number;
  pumpFlowLpm?: number;
}

export interface DailyBriefingMandiInput {
  crop?: string;
  cropName?: string;
  mandiName?: string;
  apmcName?: string;
  modalPriceInr?: number;
  mspInr?: number;
  verdict?: "SELL_NOW" | "HOLD" | "WATCH";
}

export interface DailyActionBriefing {
  irrigationVerdict: {
    action: "IRRIGATE" | "HOLD" | "CAUTION";
    headline: string;
    netLitres: number;
    recommendedMinutes: number;
    estimatedWasteLitres: number;
    reasons: string[];
  };
  kyunReason: string;
  sprayWindow: {
    status: "SAFE" | "CAUTION" | "HOLD";
    startHour: string;
    endHour: string;
    windKmh: number;
  };
  marketHeadline: string;
  whatsappText: string;
  spokenScript: string;
}

interface KyunTemplate {
  sentence: (p: {
    moisture: string;
    rainProb: string;
    rainMm: string;
    windKmh: string;
    waterActionPhrase: string;
    sprayActionPhrase: string;
  }) => string;
  water: Record<"IRRIGATE" | "HOLD" | "CAUTION", string>;
  spray: Record<"SAFE" | "CAUTION" | "HOLD", string>;
}

const KYUN_TEMPLATES: Record<LanguageCode, KyunTemplate> = {
  en: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `Root-zone soil moisture is ${moisture}% with ${rainProb}% rain probability (${rainMm} mm), so FieldShield advises: ${waterActionPhrase}. Wind is ${windKmh} km/h, so spray status is ${sprayActionPhrase}.`,
    water: {
      HOLD: "hold irrigation today to prevent runoff",
      CAUTION: "irrigate carefully in short pulses",
      IRRIGATE: "run scheduled drip irrigation",
    },
    spray: {
      SAFE: "safe during 06:00–10:00",
      CAUTION: "caution — spray only before 08:30",
      HOLD: "hold spraying due to drift or rain risk",
    },
  },
  hi: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `जड़ क्षेत्र की नमी ${moisture}% और बारिश की संभावना ${rainProb}% (${rainMm} mm) है, इसलिए सलाह है: ${waterActionPhrase}। हवा की गति ${windKmh} km/h होने से छिड़काव की स्थिति ${sprayActionPhrase}।`,
    water: {
      HOLD: "आज सिंचाई रोकें ताकि पानी व्यर्थ न हो",
      CAUTION: "कम अवधि में सावधानी से सिंचाई करें",
      IRRIGATE: "सुबह निर्धारित सिंचाई चलाएं",
    },
    spray: {
      SAFE: "06:00–10:00 के बीच सुरक्षित है",
      CAUTION: "सावधान — केवल 08:30 से पहले छिड़काव करें",
      HOLD: "तेज़ हवा या बारिश के कारण रोकी गई है",
    },
  },
  pa: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `ਜੜ੍ਹਾਂ ਦੀ ਨਮੀ ${moisture}% ਅਤੇ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ${rainProb}% (${rainMm} mm) ਹੈ, ਇਸ ਲਈ ਸਲਾਹ ਹੈ: ${waterActionPhrase}। ਹਵਾ ਦੀ ਰਫ਼ਤਾਰ ${windKmh} km/h ਹੋਣ ਕਾਰਨ ਛਿੜਕਾਅ ${sprayActionPhrase}।`,
    water: {
      HOLD: "ਅੱਜ ਸਿੰਚਾਈ ਰੋਕੋ ਤਾਂ ਜੋ ਪਾਣੀ ਬਰਬਾਦ ਨਾ ਹੋਵੇ",
      CAUTION: "ਥੋੜ੍ਹੇ ਸਮੇਂ ਲਈ ਧਿਆਨ ਨਾਲ ਸਿੰਚਾਈ ਕਰੋ",
      IRRIGATE: "ਸਵੇਰੇ ਨਿਰਧਾਰਤ ਸਿੰਚਾਈ ਚਲਾਓ",
    },
    spray: {
      SAFE: "06:00–10:00 ਦੌਰਾਨ ਸੁਰੱਖਿਅਤ ਹੈ",
      CAUTION: "ਸਾਵਧਾਨ — ਸਿਰਫ਼ 08:30 ਤੋਂ ਪਹਿਲਾਂ ਛਿੜਕਾਅ ਕਰੋ",
      HOLD: "ਤੇਜ਼ ਹਵਾ ਜਾਂ ਮੀਂਹ ਕਾਰਨ ਰੋਕਿਆ ਗਿਆ ਹੈ",
    },
  },
  mr: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `मुळांजवळील ओलावा ${moisture}% आणि पावसाची शक्यता ${rainProb}% (${rainMm} mm) आहे, म्हणून सल्ला आहे: ${waterActionPhrase}। वाऱ्याचा वेग ${windKmh} km/h असल्यामुळे फवारणी ${sprayActionPhrase}।`,
    water: {
      HOLD: "आज पाणी वाया जाऊ नये म्हणून सिंचन थांबवा",
      CAUTION: "कमी वेळेत काळजीपूर्वक सिंचन करा",
      IRRIGATE: "सकाळी नियोजित सिंचन सुरू करा",
    },
    spray: {
      SAFE: "06:00–10:00 दरम्यान सुरक्षित आहे",
      CAUTION: "सावधान — फक्त 08:30 पूर्वी फवारणी करा",
      HOLD: "जोराचा वारा किंवा पावसामुळे थांबवली आहे",
    },
  },
  te: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `వేరు భాగంలో తేమ ${moisture}% మరియు వర్షం అవకాశం ${rainProb}% (${rainMm} mm) ఉంది, కాబట్టి సూచన: ${waterActionPhrase}. గాలి వేగం ${windKmh} km/h ఉన్నందున పిచికారీ ${sprayActionPhrase}.`,
    water: {
      HOLD: "నీరు వృథా కాకుండా నేడు నీటిపారుదల ఆపండి",
      CAUTION: "తక్కువ సమయంలో జాగ్రత్తగా నీరు ఇవ్వండి",
      IRRIGATE: "ఉదయం నిర్ణీత నీటిపారుదల నడపండి",
    },
    spray: {
      SAFE: "06:00–10:00 మధ్య సురక్షితం",
      CAUTION: "జాగ్రత్త — 08:30 లోపు మాత్రమే పిచికారీ చేయండి",
      HOLD: "గాలి లేదా వర్షం కారణంగా నిలిపివేయాలి",
    },
  },
  ta: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `வேர் பகுதி ஈரப்பதம் ${moisture}% மற்றும் மழை வாய்ப்பு ${rainProb}% (${rainMm} mm) உள்ளது, எனவே அறிவுரை: ${waterActionPhrase}. காற்று வேகம் ${windKmh} km/h என்பதால் மருந்து தெளிப்பு ${sprayActionPhrase}.`,
    water: {
      HOLD: "தண்ணீர் வீணாகாமல் இருக்க இன்று பாசனத்தை நிறுத்தவும்",
      CAUTION: "குறைந்த நேரத்தில் கவனமாக பாசனம் செய்யவும்",
      IRRIGATE: "காலை திட்டமிட்ட பாசனத்தை இயக்கவும்",
    },
    spray: {
      SAFE: "06:00–10:00 இடையே பாதுகாப்பானது",
      CAUTION: "எச்சரிக்கை — 08:30 முன் மட்டும் தெளிக்கவும்",
      HOLD: "காற்று அல்லது மழை காரணமாக நிறுத்தவும்",
    },
  },
  kn: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `ಬೇರು ವಲಯದ ತೇವಾಂಶ ${moisture}% ಮತ್ತು ಮಳೆಯ ಸಾಧ್ಯತೆ ${rainProb}% (${rainMm} mm) ಇದೆ, ಆದ್ದರಿಂದ ಸಲಹೆ: ${waterActionPhrase}. ಗಾಳಿಯ ವೇಗ ${windKmh} km/h ಇರುವುದರಿಂದ ಸಿಂಪಡಣೆ ${sprayActionPhrase}.`,
    water: {
      HOLD: "ನೀರು ವ್ಯರ್ಥವಾಗದಂತೆ ಇಂದು ನೀರಾವರಿ ನಿಲ್ಲಿಸಿ",
      CAUTION: "ಕಡಿಮೆ ಅವಧಿಯಲ್ಲಿ ಎಚ್ಚರಿಕೆಯಿಂದ ನೀರು ಹಾಯಿಸಿ",
      IRRIGATE: "ಬೆಳಗ್ಗೆ ನಿಗದಿತ ನೀರಾವರಿ ಚಲಾಯಿಸಿ",
    },
    spray: {
      SAFE: "06:00–10:00 ನಡುವೆ ಸುರಕ್ಷಿತವಾಗಿದೆ",
      CAUTION: "ಎಚ್ಚರಿಕೆ — 08:30 ರ ಮೊದಲು ಮಾತ್ರ ಸಿಂಪಡಿಸಿ",
      HOLD: "ಗಾಳಿ ಅಥವಾ ಮಳೆಯಿಂದಾಗಿ ತಡೆಹಿಡಿಯಲಾಗಿದೆ",
    },
  },
  bn: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `শিকড়ের আর্দ্রতা ${moisture}% এবং বৃষ্টির সম্ভাবনা ${rainProb}% (${rainMm} mm), তাই পরামর্শ: ${waterActionPhrase}। বাতাসের গতি ${windKmh} km/h হওয়ায় স্প্রে করা ${sprayActionPhrase}।`,
    water: {
      HOLD: "জল অপচয় রোধে আজ সেচ বন্ধ রাখুন",
      CAUTION: "অল্প সময়ে সতর্কতার সাথে সেচ দিন",
      IRRIGATE: "সকালে নির্ধারিত সেচ চালু করুন",
    },
    spray: {
      SAFE: "06:00–10:00 এর মধ্যে নিরাপদ",
      CAUTION: "সতর্কতা — শুধুমাত্র 08:30 এর আগে স্প্রে করুন",
      HOLD: "দমকা হাওয়া বা বৃষ্টির কারণে স্থগিত রাখা হয়েছে",
    },
  },
  gu: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `મૂળ વિસ્તારની ભેજ ${moisture}% અને વરસાદની શક્યતા ${rainProb}% (${rainMm} mm) છે, તેથી સલાહ છે: ${waterActionPhrase}. પવનની ઝડપ ${windKmh} km/h હોવાથી છંટકાવ ${sprayActionPhrase}.`,
    water: {
      HOLD: "પાણીનો બગાડ અટકાવવા આજે પિયત બંધ રાખો",
      CAUTION: "ઓછા સમયમાં સાવધાનીપૂર્વક પિયત આપો",
      IRRIGATE: "સવારે નક્કી કરેલ પિયત ચાલુ કરો",
    },
    spray: {
      SAFE: "06:00–10:00 દરમિયાન સુરક્ષિત છે",
      CAUTION: "સાવચેતી — માત્ર 08:30 પહેલાં છંટકાવ કરો",
      HOLD: "તેજ પવન કે વરસાદને કારણે રોકવામાં આવ્યો છે",
    },
  },
  or: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `ଚେର ଅଞ୍ଚଳର ଆର୍ଦ୍ରତା ${moisture}% ଏବଂ ବର୍ଷା ସମ୍ଭାବନା ${rainProb}% (${rainMm} mm) ଅଛି, ତେଣୁ ପରାମର୍ଶ: ${waterActionPhrase}। ପବନର ବେଗ ${windKmh} km/h ଥିବାରୁ ସ୍ପ୍ରେ କରିବା ${sprayActionPhrase}।`,
    water: {
      HOLD: "ପାଣି ନଷ୍ଟ ରୋକିବାକୁ ଆଜି ଜଳସେଚନ ବନ୍ଦ ରଖନ୍ତୁ",
      CAUTION: "କମ ସମୟ ପାଇଁ ସତର୍କତାର ସହ ଜଳସେଚନ କରନ୍ତୁ",
      IRRIGATE: "ସକାଳେ ନିର୍ଦ୍ଧାରିତ ଜଳସେଚନ ଚଲାନ୍ତୁ",
    },
    spray: {
      SAFE: "06:00–10:00 ମଧ୍ୟରେ ନିରାପଦ",
      CAUTION: "ସତର୍କ — କେବଳ 08:30 ପୂର୍ବରୁ ସ୍ପ୍ରେ କରନ୍ତୁ",
      HOLD: "ପ୍ରବଳ ପବନ କିମ୍ବା ବର୍ଷା ଯୋଗୁଁ ବନ୍ଦ ଅଛି",
    },
  },
  ml: {
    sentence: ({ moisture, rainProb, rainMm, windKmh, waterActionPhrase, sprayActionPhrase }) =>
      `വേരിലെ ഈർപ്പം ${moisture}% ഉം മഴ സാധ്യത ${rainProb}% (${rainMm} mm) ഉം ആണ്, അതിനാൽ നിർദ്ദേശം: ${waterActionPhrase}. കാറ്റിന്റെ വേഗം ${windKmh} km/h ആയതിനാൽ തളിക്കൽ ${sprayActionPhrase}.`,
    water: {
      HOLD: "വെള്ളം പാഴാകാതിരിക്കാൻ ഇന്ന് നനയ്ക്കൽ നിർത്തുക",
      CAUTION: "കുറഞ്ഞ സമയത്തേക്ക് ശ്രദ്ധയോടെ നനയ്ക്കുക",
      IRRIGATE: "രാവിലെ നിശ്ചിത നനയ്ക്കൽ പ്രവർത്തിപ്പിക്കുക",
    },
    spray: {
      SAFE: "06:00–10:00 നും ഇടയിൽ സുരക്ഷിതമാണ്",
      CAUTION: "ജാഗ്രത — 08:30 ന് മുമ്പ് മാത്രം തളിക്കുക",
      HOLD: "ശക്തമായ കാറ്റോ മഴയോ കാരണം നിർത്തിവച്ചിരിക്കുന്നു",
    },
  },
};

function formatRainMm(value: number): string {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
  return Number.isInteger(safe) ? String(safe) : safe.toFixed(1);
}

function resolveLang(lang?: string): LanguageCode {
  if (lang && Object.hasOwn(KYUN_TEMPLATES, lang)) {
    return lang as LanguageCode;
  }
  return "en";
}

export function buildDailyBriefing(
  property: Pick<
    FarmProperty,
    "name" | "areaHa" | "irrigationType" | "selectedCropId" | "address"
  > | null | undefined,
  weather: DailyBriefingWeatherInput | null | undefined,
  topMandi: DailyBriefingMandiInput | null | undefined,
  lang: string = "en"
): DailyActionBriefing {
  const crop = getCropById(property?.selectedCropId || "wheat");
  const areaHa = property?.areaHa && property.areaHa > 0 ? property.areaHa : 2.5;
  const irrigationType = property?.irrigationType || "drip";
  const todayEt0 = weather?.todayEt0 ?? 4.2;
  const todayRainMm = weather?.todayRainMm ?? 0;
  const rainProbMax = weather?.rainProbMax ?? 10;
  const currentWindKmh = Math.round(weather?.currentWindKmh ?? 8);
  const soilMoisturePct = Math.round(
    weather?.currentSoilMoisturePct ?? weather?.soilMoisturePct ?? 58
  );
  const pumpFlowLpm = weather?.pumpFlowLpm ?? 120;

  const budget = computeWaterBudget({
    areaHa,
    todayEt0,
    todayRainMm,
    kc: crop.kc[1] ?? 1.15,
    irrigationType,
    pumpFlowLpm,
  });

  const scheduleReferenceLitres =
    budget.netDeliveryLitres > 0
      ? budget.netDeliveryLitres
      : Math.round(budget.grossLitres / budget.efficiency);

  const interlock = evaluateValveInterlock({
    rainProbMax,
    todayRainMm,
    currentWindKmh,
    soilMoisturePct,
    optimalMoistureRange: crop.optimalSoilMoisture,
    waterBudgetLitres: scheduleReferenceLitres,
  });

  const action: "IRRIGATE" | "HOLD" | "CAUTION" =
    interlock.severity === "hold" || budget.netDeliveryLitres === 0
      ? "HOLD"
      : interlock.severity === "caution"
        ? "CAUTION"
        : "IRRIGATE";

  const netLitres = action === "HOLD" ? 0 : budget.netDeliveryLitres;
  const recommendedMinutes = action === "HOLD" ? 0 : budget.recommendedMinutes;
  const cycleMinutes =
    recommendedMinutes > 240 ? 240 : recommendedMinutes;
  const cycleCount =
    recommendedMinutes > 240 ? Math.ceil(recommendedMinutes / 240) : 1;
  const runtimeLabel =
    cycleCount > 1
      ? `${cycleMinutes} min × ${cycleCount} cycles`
      : `${recommendedMinutes} min`;

  const headline =
    action === "HOLD"
      ? `Hold irrigation · ${interlock.estimatedWasteLitres.toLocaleString("en-IN")} L conserved`
      : action === "CAUTION"
        ? `Caution pulse: ${netLitres.toLocaleString("en-IN")} L (${runtimeLabel})`
        : `Irrigate ${netLitres.toLocaleString("en-IN")} L (${runtimeLabel})`;

  const sprayStatus: "SAFE" | "CAUTION" | "HOLD" =
    rainProbMax >= 50 || todayRainMm >= 10 || currentWindKmh >= 20
      ? "HOLD"
      : currentWindKmh >= 15 || rainProbMax >= 30
        ? "CAUTION"
        : "SAFE";

  const sprayWindow = {
    status: sprayStatus,
    startHour: sprayStatus === "HOLD" ? "17:30" : "06:00",
    endHour: sprayStatus === "SAFE" ? "10:00" : sprayStatus === "CAUTION" ? "08:30" : "18:30",
    windKmh: currentWindKmh,
  };

  const marketCrop = topMandi?.cropName || topMandi?.crop || crop.name;
  const mandiName = topMandi?.mandiName || topMandi?.apmcName;
  const marketHeadline =
    mandiName && typeof topMandi?.modalPriceInr === "number"
      ? `${marketCrop}: ₹${Math.round(topMandi.modalPriceInr).toLocaleString("en-IN")}/q at ${mandiName}${
          topMandi.verdict ? ` · ${topMandi.verdict}` : ""
        }`
      : `${crop.name} mandi check ready · open Mandi Board for live APMC ₹/q`;

  const resolvedLang = resolveLang(lang);
  const template = KYUN_TEMPLATES[resolvedLang];
  const kyunReason = template.sentence({
    moisture: String(soilMoisturePct),
    rainProb: String(Math.round(rainProbMax)),
    rainMm: formatRainMm(todayRainMm),
    windKmh: String(currentWindKmh),
    waterActionPhrase: template.water[action],
    sprayActionPhrase: template.spray[sprayStatus],
  });

  const farmTitle = property?.name || "My Farm";
  const whatsappText = [
    `*${farmTitle}* (${crop.name}) — 6 AM FieldShield Brief`,
    `[Water] ${headline}`,
    `[Spray] ${sprayStatus} (${sprayWindow.startHour}–${sprayWindow.endHour}, ${currentWindKmh} km/h)`,
    `[Market] ${marketHeadline}`,
    `[Why] ${kyunReason}`,
  ].join("\n");

  const spokenScript = `${farmTitle}. ${headline}. Spray status ${sprayStatus}. ${kyunReason}`;

  return {
    irrigationVerdict: {
      action,
      headline,
      netLitres,
      recommendedMinutes,
      estimatedWasteLitres: interlock.estimatedWasteLitres,
      reasons: interlock.reasons,
    },
    kyunReason,
    sprayWindow,
    marketHeadline,
    whatsappText,
    spokenScript,
  };
}
