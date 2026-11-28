import type { TruthScoreResult, TruthTierLabel } from "@/lib/truth-score";

export interface TruthCitationLink {
  title: string;
  url: string;
}

export interface TruthReportCardData {
  title: string;
  checkedInput: string;
  platform: string;
  locationLabel: string;
  score: TruthScoreResult;
  summary: string;
  citations: TruthCitationLink[];
  checkedAtIso: string;
  whatsappSummaryText: string;
}

export interface BuildTruthReportInput {
  title: string;
  checkedInput: string;
  platform: string;
  locationLabel: string;
  score: TruthScoreResult;
  summary: string;
  citations: TruthCitationLink[];
  checkedAtIso?: string;
}

// Valid 1x1 transparent PNG bytes used strictly as a deterministic fallback when Canvas 2D is unavailable (e.g., jsdom tests).
const FALLBACK_PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
  0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
  0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
  0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

export function formatTruthTierText(tier: TruthTierLabel): string {
  switch (tier) {
    case "VERIFIED_OFFICIAL":
      return "VERIFIED TRUE";
    case "PARTIALLY_VERIFIED":
      return "PARTIALLY VERIFIED";
    case "UNVERIFIED_RUMOUR":
      return "UNVERIFIED RUMOUR";
  }
}

function tierColorHex(tier: TruthTierLabel): string {
  switch (tier) {
    case "VERIFIED_OFFICIAL":
      return "#485C11";
    case "PARTIALLY_VERIFIED":
      return "#9A6300";
    case "UNVERIFIED_RUMOUR":
      return "#B3261E";
  }
}

export function buildTruthReportPayload(
  input: BuildTruthReportInput
): TruthReportCardData {
  const checkedAtIso = input.checkedAtIso ?? new Date().toISOString();
  const verdict = formatTruthTierText(input.score.tierLabel);
  const topCitation = input.citations[0]?.url ?? "https://agricoop.gov.in/";
  const whatsappSummaryText = [
    `*AgriTech FieldShield Truth Check* (${input.locationLabel})`,
    `Verdict: ${verdict} (${input.score.totalPercent}%)`,
    `Claim: ${input.title}`,
    input.summary,
    input.score.scamWarning ? `Warning: ${input.score.scamWarning}` : null,
    `Official Source: ${topCitation}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: input.title,
    checkedInput: input.checkedInput,
    platform: input.platform,
    locationLabel: input.locationLabel,
    score: input.score,
    summary: input.summary,
    citations: input.citations,
    checkedAtIso,
    whatsappSummaryText,
  };
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Generates a 1080x1080 shareable PNG fact-check card using HTML5 Canvas.
 * Falls back cleanly to a minimal valid PNG Blob when Canvas 2D is unavailable.
 */
export async function renderTruthReportPng(
  report: TruthReportCardData
): Promise<Blob> {
  if (typeof document === "undefined") {
    return new Blob([FALLBACK_PNG_BYTES], { type: "image/png" });
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1080;

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    ctx = null;
  }

  if (!ctx) {
    return new Blob([FALLBACK_PNG_BYTES], { type: "image/png" });
  }

  const statusHex = tierColorHex(report.score.tierLabel);
  const verdictLabel = formatTruthTierText(report.score.tierLabel);

  // Outer bezel + crisp alabaster card
  ctx.fillStyle = "#F2F4EE";
  ctx.fillRect(0, 0, 1080, 1080);

  drawRoundedRect(ctx, 40, 40, 1000, 1000, 32);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#E9E9E9";
  ctx.stroke();

  // Top botanical accent bar
  drawRoundedRect(ctx, 72, 72, 936, 76, 18);
  ctx.fillStyle = "#485C11";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = '600 26px "DM Sans", sans-serif';
  ctx.fillText("AGRI-PULSE TRUTH SHIELD · FACT-CHECK CARD", 104, 120);

  // Location & date
  ctx.fillStyle = "#6F6F6F";
  ctx.font = '500 24px "DM Sans", sans-serif';
  const dateShort = report.checkedAtIso.slice(0, 10);
  ctx.fillText(
    `${report.locationLabel} · ${report.platform.toUpperCase()} · ${dateShort}`,
    76,
    198
  );

  // Score hero row
  ctx.fillStyle = statusHex;
  ctx.font = '700 108px "DM Mono", monospace';
  ctx.fillText(`${report.score.totalPercent}%`, 76, 322);

  drawRoundedRect(ctx, 360, 246, 420, 64, 32);
  ctx.fillStyle = statusHex;
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = '700 28px "DM Sans", sans-serif';
  ctx.fillText(verdictLabel, 396, 288);

  // Title & checked link/claim
  ctx.fillStyle = "#000000";
  ctx.font = '700 36px "Crimson Text", Georgia, serif';
  const titleLines = wrapCanvasText(ctx, report.title, 920, 2);
  titleLines.forEach((line, idx) => {
    ctx!.fillText(line, 76, 404 + idx * 44);
  });

  drawRoundedRect(ctx, 76, 488, 928, 76, 14);
  ctx.fillStyle = "#F7F8F5";
  ctx.fill();
  ctx.strokeStyle = "#E9E9E9";
  ctx.stroke();

  ctx.fillStyle = "#6F6F6F";
  ctx.font = '500 22px "DM Mono", monospace';
  const inputClipped =
    report.checkedInput.length > 68
      ? `${report.checkedInput.slice(0, 65)}...`
      : report.checkedInput;
  ctx.fillText(`Checked: ${inputClipped}`, 98, 535);

  // Summary
  ctx.fillStyle = "#222222";
  ctx.font = '400 28px "DM Sans", sans-serif';
  const summaryLines = wrapCanvasText(ctx, report.summary, 920, 3);
  summaryLines.forEach((line, idx) => {
    ctx!.fillText(line, 76, 622 + idx * 38);
  });

  // 4-factor breakdown bars
  const factors: Array<[string, number, number]> = [
    ["Official Govt Source", report.score.breakdown.officialGovt, 50],
    ["Cross-Source Match", report.score.breakdown.crossSource, 20],
    ["Recency & Freshness", report.score.breakdown.recency, 15],
    ["Ground Safety", report.score.breakdown.groundSafety, 15],
  ];

  factors.forEach(([label, val, max], idx) => {
    const y = 762 + idx * 48;
    ctx!.fillStyle = "#000000";
    ctx!.font = '500 22px "DM Sans", sans-serif';
    ctx!.fillText(label, 76, y);

    ctx!.fillStyle = "#6F6F6F";
    ctx!.font = '500 22px "DM Mono", monospace';
    ctx!.fillText(`${val}/${max}`, 370, y);

    drawRoundedRect(ctx!, 470, y - 18, 530, 18, 9);
    ctx!.fillStyle = "#E9E9E9";
    ctx!.fill();

    const fillW = Math.max(0, Math.round((val / max) * 530));
    if (fillW > 0) {
      drawRoundedRect(ctx!, 470, y - 18, fillW, 18, 9);
      ctx!.fillStyle = statusHex;
      ctx!.fill();
    }
  });

  // Citation footer
  const citeText = report.citations[0]
    ? `Official Ref: ${report.citations[0].url}`
    : "Verify on official .gov.in portals before forwarding";
  ctx.fillStyle = "#485C11";
  ctx.font = '500 22px "DM Mono", monospace';
  ctx.fillText(citeText.slice(0, 74), 76, 998);

  return new Promise<Blob>((resolve) => {
    if (typeof canvas.toBlob !== "function") {
      resolve(new Blob([FALLBACK_PNG_BYTES], { type: "image/png" }));
      return;
    }
    canvas.toBlob((blob) => {
      resolve(blob ?? new Blob([FALLBACK_PNG_BYTES], { type: "image/png" }));
    }, "image/png");
  });
}

export function triggerPngDownload(blob: Blob, filename = "agritech-truth-report.png") {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

/**
 * Shares the 1080x1080 PNG report directly via Web Share API when file sharing
 * is supported (mobile WhatsApp), or downloads the PNG + opens wa.me summary.
 */
export async function shareTruthReportToWhatsApp(
  report: TruthReportCardData,
  blob: Blob
): Promise<"shared" | "fallback"> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      const file = new File([blob], "agritech-truth-report.png", { type: "image/png" });
      const canShareFiles =
        typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({
          title: report.title,
          text: report.whatsappSummaryText,
          files: [file],
        });
        return "shared";
      }
    } catch {
      // Fall through to PNG download + wa.me text share if user/browser rejects file share
    }
  }

  triggerPngDownload(blob);
  if (typeof window !== "undefined") {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(report.whatsappSummaryText)}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  }
  return "fallback";
}
