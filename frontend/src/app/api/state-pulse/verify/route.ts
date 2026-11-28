import { NextRequest, NextResponse } from "next/server";
import { INDIAN_STATES } from "@/lib/indian-locations";
import { validatePublicSocialUrl, type SocialPlatform } from "@/lib/url-safety";
import { computeTruthScore, type TruthSignals } from "@/lib/truth-score";
import {
  buildTruthReportPayload,
  type TruthCitationLink,
} from "@/lib/truth-report-image";

const MAX_FETCH_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 2;

interface VerifyRequestBody {
  url?: string;
  text?: string;
  stateCode?: string;
  districtName?: string;
  language?: string;
}

interface ExtractedMetadata {
  title: string | null;
  description: string | null;
  publishedTime: string | null;
  metadataSource: "oembed" | "reddit_json" | "opengraph" | "heuristic_fallback";
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string | null {
  const escaped = attrValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern1 = new RegExp(
    `<meta[^>]*${attrName}=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const pattern2 = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*${attrName}=["']${escaped}["'][^>]*>`,
    "i"
  );
  const match = html.match(pattern1) ?? html.match(pattern2);
  return match?.[1] ? decodeHtmlEntities(match[1]) : null;
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      const remaining = MAX_FETCH_BYTES - total;
      if (remaining <= 0) break;
      chunks.push(value.byteLength > remaining ? value.slice(0, remaining) : value);
      total += Math.min(value.byteLength, remaining);
      if (total >= MAX_FETCH_BYTES) {
        void reader.cancel().catch(() => {});
        break;
      }
    }
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

async function safeFetchWithRedirectGuard(targetUrl: URL): Promise<Response | null> {
  let currentUrl = targetUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const res = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "User-Agent": "AgriTech-TruthShield/1.0 (+https://agricoop.gov.in)",
        Accept: "text/html,application/json,application/xhtml+xml;q=0.9",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return null;
      let resolved: URL;
      try {
        resolved = new URL(location, currentUrl);
      } catch {
        return null;
      }
      const recheck = validatePublicSocialUrl(resolved.toString());
      if (!recheck.ok || recheck.scamRisk) {
        return null;
      }
      currentUrl = recheck.url;
      continue;
    }

    return res;
  }

  return null;
}

async function fetchPublicMetadata(
  targetUrl: URL,
  platform: SocialPlatform
): Promise<ExtractedMetadata> {
  try {
    if (platform === "youtube") {
      const oembedUrl = new URL("https://www.youtube.com/oembed");
      oembedUrl.searchParams.set("url", targetUrl.toString());
      oembedUrl.searchParams.set("format", "json");
      const res = await safeFetchWithRedirectGuard(oembedUrl);
      if (res && res.ok) {
        const jsonText = await readLimitedText(res);
        const parsed = JSON.parse(jsonText) as { title?: string; author_name?: string };
        return {
          title: parsed.title ?? null,
          description: parsed.author_name ? `YouTube channel: ${parsed.author_name}` : null,
          publishedTime: null,
          metadataSource: "oembed",
        };
      }
    }

    if (platform === "reddit" && targetUrl.hostname.includes("reddit.com")) {
      const jsonUrl = new URL(targetUrl.toString());
      if (!jsonUrl.pathname.endsWith(".json")) {
        jsonUrl.pathname = `${jsonUrl.pathname.replace(/\/+$/, "")}.json`;
      }
      const res = await safeFetchWithRedirectGuard(jsonUrl);
      if (res && res.ok) {
        const jsonText = await readLimitedText(res);
        const parsed = JSON.parse(jsonText) as Array<{
          data?: { children?: Array<{ data?: { title?: string; selftext?: string; created_utc?: number } }> };
        }>;
        const post = parsed?.[0]?.data?.children?.[0]?.data;
        if (post?.title) {
          return {
            title: post.title,
            description: post.selftext ? post.selftext.slice(0, 280) : null,
            publishedTime: post.created_utc
              ? new Date(post.created_utc * 1000).toISOString()
              : null,
            metadataSource: "reddit_json",
          };
        }
      }
    }

    const res = await safeFetchWithRedirectGuard(targetUrl);
    if (!res || !res.ok) {
      return {
        title: null,
        description: null,
        publishedTime: null,
        metadataSource: "heuristic_fallback",
      };
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return {
        title: null,
        description: null,
        publishedTime: null,
        metadataSource: "heuristic_fallback",
      };
    }

    const html = await readLimitedText(res);
    const ogTitle = extractMetaContent(html, "property", "og:title");
    const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = ogTitle ?? (titleTagMatch?.[1] ? decodeHtmlEntities(titleTagMatch[1]) : null);
    const description =
      extractMetaContent(html, "property", "og:description") ??
      extractMetaContent(html, "name", "description");
    const publishedTime =
      extractMetaContent(html, "property", "article:published_time") ??
      extractMetaContent(html, "name", "publish-date");

    if (!title && !description) {
      return {
        title: null,
        description: null,
        publishedTime: null,
        metadataSource: "heuristic_fallback",
      };
    }

    return {
      title,
      description,
      publishedTime,
      metadataSource: "opengraph",
    };
  } catch {
    return {
      title: null,
      description: null,
      publishedTime: null,
      metadataSource: "heuristic_fallback",
    };
  }
}

const SCAM_TEXT_PATTERNS = [
  /\.apk\b/i,
  /\b(send|share|enter)\s+(your\s+)?(otp|pin|cvv|aadhaar\s*otp)\b/i,
  /\b(registration|processing|verification)\s+fee\b/i,
  /\bpay\s*(?:rs\.?|₹|inr)\s*\d+/i,
  /\bfree\s+(tractor|solar\s*pump|fertilizer|urea)\b/i,
  /\bbit\.ly\/|tinyurl\.com\/|t\.co\//i,
  /\bpm-?kisan-[a-z0-9-]+\.(com|in|xyz|top|online|site)\b/i,
  /\bguaranteed\s+(?:₹|rs\.?)\s*\d+\s+today\b/i,
];

const OFFICIAL_DOMAIN_TEXT_PATTERNS = [
  /\.gov\.in\b/i,
  /\.nic\.in\b/i,
  /\bpmkisan\.gov\.in\b/i,
  /\bpmfby\.gov\.in\b/i,
  /\benam\.gov\.in\b/i,
  /\bmausam\.imd\.gov\.in\b/i,
  /\bagmarknet\.gov\.in\b/i,
];

function detectStaleRecycledContent(combinedText: string, publishedTime: string | null): boolean {
  if (publishedTime) {
    const publishedMs = Date.parse(publishedTime);
    if (!Number.isNaN(publishedMs)) {
      const ageDays = (Date.now() - publishedMs) / (1000 * 60 * 60 * 24);
      if (ageDays > 180) return true;
    }
  }
  const hasOldYear = /\b(2019|2020|2021|2022|2023|2024)\b/.test(combinedText);
  const hasCurrentYear = /\b(2025|2026)\b/.test(combinedText);
  if (hasOldYear && !hasCurrentYear) return true;
  if (/\bforwarded many times\b/i.test(combinedText)) return true;
  return false;
}

function selectOfficialCitations(combinedText: string, checkedUrl?: URL): TruthCitationLink[] {
  const cites: TruthCitationLink[] = [];
  if (checkedUrl && (checkedUrl.hostname.endsWith(".gov.in") || checkedUrl.hostname.endsWith(".nic.in"))) {
    cites.push({ title: `Official Portal (${checkedUrl.hostname})`, url: checkedUrl.toString() });
  }
  if (/pm-?kisan|installment|dbt|e-?kyc/i.test(combinedText)) {
    cites.push({ title: "PM-KISAN Official Portal", url: "https://pmkisan.gov.in/" });
  }
  if (/pmfby|crop\s*insurance|hailstorm|72\s*hour|claim/i.test(combinedText)) {
    cites.push({ title: "PMFBY Crop Insurance Portal", url: "https://pmfby.gov.in/" });
  }
  if (/mandi|msp|rate|price|quintal|e-?nam/i.test(combinedText)) {
    cites.push({ title: "e-NAM & Agmarknet MSP Rates", url: "https://enam.gov.in/" });
  }
  if (/rain|storm|cyclone|wind|heatwave|imd|weather/i.test(combinedText)) {
    cites.push({ title: "IMD Agromet Advisories", url: "https://mausam.imd.gov.in/" });
  }
  if (cites.length === 0) {
    cites.push({ title: "Ministry of Agriculture & Farmers Welfare", url: "https://agricoop.gov.in/" });
    cites.push({ title: "PIB Fact Check", url: "https://pib.gov.in/" });
  }
  return cites.slice(0, 3);
}

export async function POST(request: NextRequest) {
  let body: VerifyRequestBody;
  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  const rawText = (body.text ?? "").trim();

  if (!rawUrl && !rawText) {
    return NextResponse.json(
      { error: "Please paste a link or WhatsApp/social forward text to verify." },
      { status: 400 }
    );
  }

  let validatedUrl: ReturnType<typeof validatePublicSocialUrl> | null = null;
  if (rawUrl) {
    validatedUrl = validatePublicSocialUrl(rawUrl);
    if (!validatedUrl.ok) {
      return NextResponse.json({ error: validatedUrl.reason }, { status: 400 });
    }
  }

  const stateObj =
    INDIAN_STATES.find((s) => s.code === (body.stateCode ?? "OD").toUpperCase()) ??
    INDIAN_STATES[0];
  const districtName =
    (body.districtName ?? "").trim() || stateObj.districts[0]?.name || "Statewide";
  const locationLabel = `${districtName}, ${stateObj.name}`;

  const platform: SocialPlatform = validatedUrl?.ok ? validatedUrl.platform : "whatsapp";
  const urlWarnings = validatedUrl?.ok ? validatedUrl.warnings : [];
  const urlScamRisk = validatedUrl?.ok ? validatedUrl.scamRisk : false;

  const metadata: ExtractedMetadata =
    validatedUrl?.ok && !urlScamRisk
      ? await fetchPublicMetadata(validatedUrl.url, platform)
      : {
          title: null,
          description: null,
          publishedTime: null,
          metadataSource: "heuristic_fallback",
        };

  const combinedText = [rawUrl, rawText, metadata.title ?? "", metadata.description ?? ""]
    .filter(Boolean)
    .join(" ");

  const textScamMatch = SCAM_TEXT_PATTERNS.some((re) => re.test(combinedText));
  const scamSignal = urlScamRisk || textScamMatch;

  const mentionsOfficialDomain = OFFICIAL_DOMAIN_TEXT_PATTERNS.some((re) =>
    re.test(combinedText)
  );
  const mentionsKnownScheme = /\b(pm-?kisan|pmfby|pmksy|e-?nam|imd|kvk|msp|agristack)\b/i.test(
    combinedText
  );

  let officialGovt = 0;
  if (!scamSignal) {
    if (platform === "gov") {
      officialGovt = 50;
    } else if (mentionsOfficialDomain) {
      officialGovt = 38;
    } else if (mentionsKnownScheme) {
      officialGovt = 18;
    }
  }

  let crossSource = 6;
  if (!scamSignal) {
    if (platform === "gov") {
      crossSource = 20;
    } else if (metadata.metadataSource !== "heuristic_fallback" && mentionsOfficialDomain) {
      crossSource = 16;
    } else if (metadata.metadataSource !== "heuristic_fallback") {
      crossSource = 12;
    } else if (rawText.length >= 30 && mentionsKnownScheme) {
      crossSource = 10;
    }
  }

  const isStale = detectStaleRecycledContent(combinedText, metadata.publishedTime);
  const recency = isStale
    ? 0
    : metadata.publishedTime || /\b(2026|today|tonight|morning|imd)\b/i.test(combinedText)
      ? 15
      : 10;

  const groundSafety = scamSignal ? 0 : platform === "gov" ? 15 : 12;

  const signals: TruthSignals = {
    officialGovt,
    crossSource,
    recency,
    groundSafety,
    scamSignal,
  };
  const score = computeTruthScore(signals);
  const citations = selectOfficialCitations(
    combinedText,
    validatedUrl?.ok ? validatedUrl.url : undefined
  );

  const warnings = [...urlWarnings];
  if (textScamMatch && warnings.length === 0) {
    warnings.push(
      "Forward text contains high-risk phishing cues (APK file, fee demand, OTP request, or shortened link)."
    );
  }
  if (score.recycledWarning) {
    warnings.push(score.recycledWarning);
  }

  const title =
    metadata.title ??
    (rawText ? rawText.slice(0, 72) : validatedUrl?.ok ? validatedUrl.url.hostname : "Forwarded Claim");

  let summary: string;
  if (score.tierLabel === "VERIFIED_OFFICIAL") {
    summary = `Verified ${score.totalPercent}% against official government domain standards for ${locationLabel}. Safe to act on and share using the official ${citations[0]?.url ?? ".gov.in"} citation.`;
  } else if (score.tierLabel === "PARTIALLY_VERIFIED") {
    summary = `Partially verified (${score.totalPercent}%) — this ${platform} update could not be fully confirmed from an official .gov.in notice. Cross-check with ${citations[0]?.url ?? "your local KVK"} before spraying, selling, or applying.`;
  } else if (scamSignal) {
    summary = `High scam risk (${score.totalPercent}% Unverified Rumour) detected on this ${platform} link or forward. Do not install .apk files, pay registration fees, or share Aadhaar/bank OTPs; verify only on ${citations[0]?.url ?? "https://pmkisan.gov.in/"}.`;
  } else {
    summary = `Unverified rumour (${score.totalPercent}%) — lacks official .gov.in corroboration or relies on unverified social claims. Confirm directly via ${citations[0]?.url ?? "https://agricoop.gov.in/"} or Kisan Call Centre 1800-180-1551.`;
  }

  const reportPayload = buildTruthReportPayload({
    title,
    checkedInput: rawUrl || rawText.slice(0, 120),
    platform,
    locationLabel,
    score,
    summary,
    citations,
  });

  return NextResponse.json({
    score,
    platform,
    scamRisk: scamSignal,
    warnings,
    fetchedTitle: metadata.title,
    fetchedDescription: metadata.description,
    metadataSource: metadata.metadataSource,
    summary,
    citations,
    reportPayload,
  });
}
