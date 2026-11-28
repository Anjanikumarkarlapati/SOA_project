import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Modality } from "@google/genai";

const TTS_TIMEOUT_MS = 20_000;
const MAX_TTS_TEXT_CHARS = 2000;

function wrapPcmAsWav(pcmBytes: Uint8Array, sampleRate = 24000, channels = 1): Uint8Array {
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const wavBuffer = new ArrayBuffer(44 + pcmBytes.byteLength);
  const view = new DataView(wavBuffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) {
      view.setUint8(offset + i, s.charCodeAt(i));
    }
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.byteLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM fmt chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, pcmBytes.byteLength, true);

  new Uint8Array(wavBuffer, 44).set(pcmBytes);
  return new Uint8Array(wavBuffer);
}

function isRiffWav(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  );
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown; language?: unknown };
  try {
    body = (await req.json()) as { text?: unknown; language?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const rawText = typeof body.text === "string" ? body.text.trim() : "";
  if (!rawText) {
    return NextResponse.json({ error: "missing_text" }, { status: 400 });
  }

  const text = rawText.slice(0, MAX_TTS_TEXT_CHARS);
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim().slice(0, 16)
      : "en";

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Read the following agricultural advisory clearly and calmly in language "${language}":\n\n${text}`,
            },
          ],
        },
      ],
      config: {
        abortSignal: controller.signal,
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          languageCode: language,
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const inlineAudio = parts.find((p) => p.inlineData?.data)?.inlineData;
    const base64Audio = inlineAudio?.data ?? response.data;

    if (!base64Audio) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }

    const rawBytes = new Uint8Array(Buffer.from(base64Audio, "base64"));
    if (rawBytes.byteLength === 0) {
      return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
    }

    const wavBytes = isRiffWav(rawBytes) ? rawBytes : wrapPcmAsWav(rawBytes);

    return new NextResponse(Buffer.from(wavBytes), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
