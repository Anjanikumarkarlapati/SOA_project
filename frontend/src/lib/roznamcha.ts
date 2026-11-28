import type { FarmProperty } from "@/lib/property-store";

export const ROZNAMCHA_STORAGE_KEY = "agritech-roznamcha-v1";

export type RoznamchaCategory =
  | "irrigation"
  | "spray"
  | "soil"
  | "market"
  | "weather"
  | "note";

export interface RoznamchaEntry {
  id: string;
  farmId: string;
  timestamp: string;
  category: RoznamchaCategory;
  title: string;
  details: string;
  soilMoisturePct?: number;
  rainMm?: number;
  waterLitres?: number;
  sig: string;
}

export type NewRoznamchaEntry = Omit<RoznamchaEntry, "id" | "timestamp" | "sig"> & {
  id?: string;
  timestamp?: string;
};

/**
 * Deterministic 32-bit FNV-1a integrity signature for offline Roznamcha ledger rows.
 */
export function computeRoznamchaSig(
  entry: Omit<RoznamchaEntry, "sig">
): string {
  const canonical = [
    entry.id,
    entry.farmId,
    entry.timestamp,
    entry.category,
    entry.title.trim(),
    entry.details.trim(),
    entry.soilMoisturePct ?? "",
    entry.rainMm ?? "",
    entry.waterLitres ?? "",
  ].join("|");

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `SIG-${hex}`;
}

export function verifyRoznamchaSignature(entry: RoznamchaEntry): boolean {
  const { sig, ...rest } = entry;
  return sig === computeRoznamchaSig(rest);
}

function readAllStoredEntries(): RoznamchaEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage?.getItem(ROZNAMCHA_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RoznamchaEntry[]) : [];
  } catch {
    return [];
  }
}

function writeAllStoredEntries(entries: RoznamchaEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.setItem(ROZNAMCHA_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota or restricted context errors
  }
}

export function loadRoznamchaEntries(farmId?: string): RoznamchaEntry[] {
  const all = readAllStoredEntries();
  const filtered = farmId ? all.filter((e) => e.farmId === farmId) : all;
  return [...filtered].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function appendRoznamchaEntry(input: NewRoznamchaEntry): RoznamchaEntry {
  const timestamp = input.timestamp || new Date().toISOString();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const id = input.id || `RZ-${Date.now().toString(36).toUpperCase()}-${rand}`;

  const base: Omit<RoznamchaEntry, "sig"> = {
    id,
    farmId: input.farmId,
    timestamp,
    category: input.category,
    title: input.title,
    details: input.details,
    ...(input.soilMoisturePct !== undefined ? { soilMoisturePct: input.soilMoisturePct } : {}),
    ...(input.rainMm !== undefined ? { rainMm: input.rainMm } : {}),
    ...(input.waterLitres !== undefined ? { waterLitres: input.waterLitres } : {}),
  };

  const full: RoznamchaEntry = {
    ...base,
    sig: computeRoznamchaSig(base),
  };

  const existing = readAllStoredEntries();
  writeAllStoredEntries([full, ...existing].slice(0, 200));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("agritech:roznamcha-updated"));
  }
  return full;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function exportRoznamchaPrintHtml(
  entries: RoznamchaEntry[],
  property?: Pick<FarmProperty, "name" | "address" | "selectedCropId" | "areaHa"> | null
): string {
  const farmName = escapeHtml(property?.name || "AgriTech FieldShield Farm");
  const farmMeta = escapeHtml(
    [
      property?.address,
      property?.selectedCropId ? `Crop: ${property.selectedCropId}` : "",
      property?.areaHa ? `${property.areaHa.toFixed(1)} ha` : "",
    ]
      .filter(Boolean)
      .join(" · ")
  );

  const rowsHtml = entries
    .map((e) => {
      const metrics = [
        e.waterLitres !== undefined ? `${e.waterLitres.toLocaleString("en-IN")} L` : "",
        e.soilMoisturePct !== undefined ? `Moisture ${e.soilMoisturePct}%` : "",
        e.rainMm !== undefined ? `Rain ${e.rainMm} mm` : "",
      ]
        .filter(Boolean)
        .join(" · ");

      return `<tr>
        <td>${escapeHtml(new Date(e.timestamp).toLocaleString("en-IN"))}</td>
        <td>${escapeHtml(e.category.toUpperCase())}</td>
        <td><strong>${escapeHtml(e.title)}</strong><br/><span>${escapeHtml(e.details)}</span>${
          metrics ? `<br/><small>${escapeHtml(metrics)}</small>` : ""
        }</td>
        <td><code>${escapeHtml(e.sig)}</code></td>
      </tr>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Kisan Roznamcha — ${farmName}</title>
  <style>
    body { background: #FFFFFF; color: #111111; font-family: system-ui, -apple-system, sans-serif; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #111111; }
    p.meta { font-size: 13px; color: #111111; margin: 0 0 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; color: #111111; }
    th, td { border: 1px solid #111111; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #F5F5F5; font-weight: 600; }
    code { font-family: monospace; font-size: 11px; }
  </style>
</head>
<body>
  <h1>Kisan Roznamcha — ${farmName}</h1>
  <p class="meta">${farmMeta || "Offline-signed field activity log"}</p>
  <table>
    <thead>
      <tr>
        <th>Timestamp</th>
        <th>Category</th>
        <th>Activity &amp; Readings</th>
        <th>Integrity Sig</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="4">No entries logged yet.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

export function buildRoznamchaWhatsAppDigest(
  entries: RoznamchaEntry[],
  property?: Pick<FarmProperty, "name" | "address" | "selectedCropId"> | null
): string {
  const farmName = property?.name || "AgriTech Farm";
  const header = `[Roznamcha] *Kisan Roznamcha — ${farmName}*${
    property?.address ? ` (${property.address})` : ""
  }`;

  if (entries.length === 0) {
    return `${header}\nNo field entries logged yet.`;
  }

  const lines = entries.slice(0, 10).map((e, idx) => {
    const dateLabel = new Date(e.timestamp).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
    return `${idx + 1}. [${dateLabel}] *${e.title}* — ${e.details} (${e.sig})`;
  });

  return [header, ...lines].join("\n");
}
