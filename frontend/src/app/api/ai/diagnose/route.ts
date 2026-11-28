import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { sniffImageMime } from "@/lib/image-sniff";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const DIAGNOSE_TIMEOUT_MS = 25_000;
const KVK_HELPLINE = "1800-180-1551";

const ipRequestTimestamps = new Map<string, number[]>();

export interface DiagnosisMedicine {
  name: string;
  dosagePerAcre: string;
  harvestWaitDays: number;
}

export interface CropDiagnosisResponse {
  isHealthy: boolean;
  healthStatus: "HEALTHY" | "NOT HEALTHY";
  confidencePercent: number;
  summary: string;
  problems: string[];
  organicRemedies: string[];
  recommendedMedicines: DiagnosisMedicine[];
  spraySafetyNote: string;
  kvkReferral: boolean;
  helpline?: string;
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

function checkRateLimit(ip: string, now = Date.now()): boolean {
  const existing = ipRequestTimestamps.get(ip) ?? [];
  const fresh = existing.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX_REQUESTS) {
    ipRequestTimestamps.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  ipRequestTimestamps.set(ip, fresh);
  return true;
}

function isAuthorizationHeaderWellFormed(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  if (auth === null) return true;
  if (auth.length === 0 || auth.length > 4096) return false;
  if (auth.toLowerCase().startsWith("bearer ") && auth.slice(7).trim().length === 0) {
    return false;
  }
  return true;
}

function sanitizeText(value: FormDataEntryValue | null, fallback: string, maxLen = 120): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

export async function POST(req: NextRequest) {
  if (!isAuthorizationHeaderWellFormed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many diagnosis requests. Wait 1 minute." },
      { status: 429 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const imageEntry = formData.get("image");
  if (!(imageEntry instanceof Blob)) {
    return NextResponse.json({ error: "missing_image" }, { status: 400 });
  }

  if (imageEntry.size <= 0) {
    return NextResponse.json({ error: "empty_image" }, { status: 400 });
  }

  if (imageEntry.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await imageEntry.arrayBuffer());
  if (bytes.byteLength === 0) {
    return NextResponse.json({ error: "empty_image" }, { status: 400 });
  }
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "image_too_large" }, { status: 413 });
  }

  const sniffedMime = sniffImageMime(bytes);
  if (!sniffedMime) {
    return NextResponse.json(
      { error: "invalid_image_type", message: "Only JPEG, PNG, WebP, or HEIC images are accepted." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const cropName = sanitizeText(formData.get("cropName") ?? formData.get("crop"), "Crop leaf", 80);
  const language = sanitizeText(formData.get("language") ?? formData.get("locale"), "en", 16);
  const propertyId = sanitizeText(formData.get("propertyId"), "default", 80);
  const windKmh = sanitizeText(formData.get("windKmh"), "", 24);
  const rainProb = sanitizeText(formData.get("rainProb"), "", 24);

  const weatherContext =
    windKmh || rainProb
      ? `Local weather context: wind ${windKmh || "unknown"} km/h, rain probability ${rainProb || "unknown"}%.`
      : "No live wind/rain telemetry attached; include general drift/rain wash-off spray safety guidance.";

  const prompt = [
    `You are an Indian Krishi Vigyan Kendra (KVK) crop plant pathologist.`,
    `Inspect the uploaded leaf/plant photo for crop "${cropName}" (parcel "${propertyId}").`,
    `Respond in language code "${language}" (keep medicine active ingredient names clear).`,
    weatherContext,
    `Be honest: if the leaf is healthy, set isHealthy=true and healthStatus="HEALTHY".`,
    `If image quality is blurry or uncertain, reflect lower confidencePercent (<60).`,
    `Provide actionable organic remedies and, only when needed, Indian-registered medicines with realistic per-acre dosage and harvest waiting period (days).`,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DIAGNOSE_TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: sniffedMime,
                data: Buffer.from(bytes).toString("base64"),
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        abortSignal: controller.signal,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isHealthy: { type: Type.BOOLEAN },
            healthStatus: { type: Type.STRING, enum: ["HEALTHY", "NOT HEALTHY"] },
            confidencePercent: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            problems: { type: Type.ARRAY, items: { type: Type.STRING } },
            organicRemedies: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendedMedicines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  dosagePerAcre: { type: Type.STRING },
                  harvestWaitDays: { type: Type.NUMBER },
                },
                required: ["name", "dosagePerAcre", "harvestWaitDays"],
              },
            },
            spraySafetyNote: { type: Type.STRING },
          },
          required: [
            "isHealthy",
            "healthStatus",
            "confidencePercent",
            "summary",
            "problems",
            "organicRemedies",
            "recommendedMedicines",
            "spraySafetyNote",
          ],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }

    const parsed = JSON.parse(rawText) as Partial<CropDiagnosisResponse>;
    const confidencePercent = Math.max(
      0,
      Math.min(100, Math.round(Number(parsed.confidencePercent ?? 0)))
    );
    const isHealthy = Boolean(parsed.isHealthy);
    const kvkReferral = confidencePercent < 60;

    const payload: CropDiagnosisResponse = {
      isHealthy,
      healthStatus: isHealthy ? "HEALTHY" : "NOT HEALTHY",
      confidencePercent,
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      problems: Array.isArray(parsed.problems) ? parsed.problems.map(String) : [],
      organicRemedies: Array.isArray(parsed.organicRemedies)
        ? parsed.organicRemedies.map(String)
        : [],
      recommendedMedicines: Array.isArray(parsed.recommendedMedicines)
        ? parsed.recommendedMedicines.map((med) => ({
            name: String(med?.name ?? ""),
            dosagePerAcre: String(med?.dosagePerAcre ?? ""),
            harvestWaitDays: Math.max(0, Math.round(Number(med?.harvestWaitDays ?? 0))),
          }))
        : [],
      spraySafetyNote:
        typeof parsed.spraySafetyNote === "string" ? parsed.spraySafetyNote : "",
      kvkReferral,
      ...(kvkReferral ? { helpline: KVK_HELPLINE } : {}),
    };

    return NextResponse.json(payload, { status: 200 });
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
