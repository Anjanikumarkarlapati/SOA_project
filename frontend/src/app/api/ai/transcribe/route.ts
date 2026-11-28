import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const TRANSCRIBE_TIMEOUT_MS = 20_000;

const ALLOWED_AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/ogg",
  "audio/wav",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
]);

function normalizeAudioMime(raw: string): string {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (ALLOWED_AUDIO_MIMES.has(base)) return base;
  return "audio/webm";
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_multipart" }, { status: 400 });
  }

  const audioEntry = formData.get("audio");
  if (!(audioEntry instanceof Blob)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }

  if (audioEntry.size <= 0) {
    return NextResponse.json({ error: "empty_audio" }, { status: 400 });
  }

  if (audioEntry.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }

  const languageRaw = formData.get("language");
  const language =
    typeof languageRaw === "string" && languageRaw.trim()
      ? languageRaw.trim().slice(0, 16)
      : "en";

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const bytes = new Uint8Array(await audioEntry.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_BYTES) {
    return NextResponse.json(
      { error: bytes.byteLength === 0 ? "empty_audio" : "audio_too_large" },
      { status: bytes.byteLength === 0 ? 400 : 413 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIBE_TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: normalizeAudioMime(audioEntry.type || "audio/webm"),
                data: Buffer.from(bytes).toString("base64"),
              },
            },
            {
              text: `Transcribe the farmer's spoken audio faithfully in its spoken Indic/English language (expected language hint: ${language}). Return ONLY the plain transcript text with no markdown or commentary.`,
            },
          ],
        },
      ],
      config: {
        abortSignal: controller.signal,
      },
    });

    const transcript = response.text?.trim() ?? "";
    if (!transcript) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }

    return NextResponse.json({ transcript, language }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
