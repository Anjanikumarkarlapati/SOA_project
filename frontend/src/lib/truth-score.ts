export interface TruthSignals {
  /** Official government domain or scheme-portal match (0..50). */
  officialGovt: number;
  /** Corroboration across independent sources or agromet portals (0..20). */
  crossSource: number;
  /** Recency & seasonal freshness (0..15; 0 triggers recycled-forward warning). */
  recency: number;
  /** Ground safety & absence of phishing/OTP/fee traps (0..15; forced 0 on scamSignal). */
  groundSafety: number;
  /** Explicit scam indicator (APK, shortener, lookalike domain, OTP/fee demand). */
  scamSignal?: boolean;
}

export type TruthTierLabel =
  | "VERIFIED_OFFICIAL"
  | "PARTIALLY_VERIFIED"
  | "UNVERIFIED_RUMOUR";

export interface TruthScoreBreakdown {
  officialGovt: number;
  crossSource: number;
  recency: number;
  groundSafety: number;
}

export interface TruthScoreResult {
  totalPercent: number;
  tierLabel: TruthTierLabel;
  breakdown: TruthScoreBreakdown;
  scamWarning: string | null;
  recycledWarning: string | null;
}

function clampScore(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(max, Math.round(value)));
}

/**
 * Computes a deterministic 4-factor Truth Score (0..100%) for State Agri-Pulse items
 * and farmer-pasted WhatsApp/social forwards. Never guesses via LLM.
 */
export function computeTruthScore(signals: TruthSignals): TruthScoreResult {
  const officialGovt = clampScore(signals.officialGovt, 50);
  const crossSource = clampScore(signals.crossSource, 20);
  const recency = clampScore(signals.recency, 15);
  const groundSafety = signals.scamSignal ? 0 : clampScore(signals.groundSafety, 15);

  const totalPercent = clampScore(
    officialGovt + crossSource + recency + groundSafety,
    100
  );

  let tierLabel: TruthTierLabel = "UNVERIFIED_RUMOUR";
  if (totalPercent >= 85) {
    tierLabel = "VERIFIED_OFFICIAL";
  } else if (totalPercent >= 55) {
    tierLabel = "PARTIALLY_VERIFIED";
  }

  const scamWarning = signals.scamSignal
    ? "Scam risk detected (suspicious link, APK download, or unverified fee/OTP demand). Do not tap install or share Aadhaar/bank details."
    : null;

  const recycledWarning =
    recency === 0
      ? "Old or undated forward — may be recycled from a previous season."
      : null;

  return {
    totalPercent,
    tierLabel,
    breakdown: {
      officialGovt,
      crossSource,
      recency,
      groundSafety,
    },
    scamWarning,
    recycledWarning,
  };
}
