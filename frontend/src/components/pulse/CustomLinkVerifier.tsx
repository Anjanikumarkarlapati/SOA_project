"use client";

import React, { useEffect, useRef, useState } from "react";
import { Banner } from "@astryxdesign/core/Banner";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Card } from "@astryxdesign/core/Card";
import { Citation } from "@astryxdesign/core/Citation";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { InputGroup, InputGroupText } from "@astryxdesign/core/InputGroup";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar, type ProgressBarVariant } from "@astryxdesign/core/ProgressBar";
import { Stack } from "@astryxdesign/core/Stack";
import { StatusDot, type StatusDotVariant } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { TextInput } from "@astryxdesign/core/TextInput";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Download,
  Link2,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { useLanguage } from "@/lib/i18n";
import { computeTruthScore, type TruthScoreResult, type TruthTierLabel } from "@/lib/truth-score";
import {
  buildTruthReportPayload,
  renderTruthReportPng,
  shareTruthReportToWhatsApp,
  triggerPngDownload,
  type TruthCitationLink,
  type TruthReportCardData,
} from "@/lib/truth-report-image";
import { validatePublicSocialUrl } from "@/lib/url-safety";

export const TRUTH_HISTORY_STORAGE_KEY = "agritech-truth-history-v1";

export interface VerifyResponsePayload {
  score: TruthScoreResult;
  platform: string;
  scamRisk: boolean;
  warnings: string[];
  fetchedTitle: string | null;
  fetchedDescription: string | null;
  metadataSource: string;
  summary: string;
  citations: TruthCitationLink[];
  reportPayload: TruthReportCardData;
}

export interface TruthHistoryEntry {
  id: string;
  checkedAtIso: string;
  title: string;
  inputPreview: string;
  platform: string;
  totalPercent: number;
  tierLabel: TruthTierLabel;
  summary: string;
}

export interface CustomLinkVerifierProps {
  stateCode: string;
  stateName: string;
  districtName: string;
  prefillUrl?: string;
  prefillText?: string;
}

function getTierPresentation(tier: TruthTierLabel): {
  label: string;
  dotVariant: StatusDotVariant;
  progressVariant: ProgressBarVariant;
  icon: React.ReactNode;
} {
  switch (tier) {
    case "VERIFIED_OFFICIAL":
      return {
        label: "Verified True",
        dotVariant: "success",
        progressVariant: "success",
        icon: <CheckCircle2 className="w-3 h-3" aria-hidden="true" />,
      };
    case "PARTIALLY_VERIFIED":
      return {
        label: "Partially Verified",
        dotVariant: "warning",
        progressVariant: "warning",
        icon: <AlertTriangle className="w-3 h-3" aria-hidden="true" />,
      };
    case "UNVERIFIED_RUMOUR":
      return {
        label: "Unverified Rumour",
        dotVariant: "error",
        progressVariant: "error",
        icon: <ShieldAlert className="w-3 h-3" aria-hidden="true" />,
      };
  }
}

function runOfflineFallbackVerify(
  urlInput: string,
  textInput: string,
  locationLabel: string
): VerifyResponsePayload | { error: string } {
  const trimmedUrl = urlInput.trim();
  const trimmedText = textInput.trim();

  let platform = "whatsapp";
  let scamRisk = false;
  const warnings: string[] = [];

  if (trimmedUrl) {
    const check = validatePublicSocialUrl(trimmedUrl);
    if (!check.ok) {
      return { error: check.reason };
    }
    platform = check.platform;
    scamRisk = check.scamRisk;
    warnings.push(...check.warnings);
  }

  const combined = `${trimmedUrl} ${trimmedText}`;
  const textScam =
    /\.apk\b|send\s+otp|registration\s+fee|pay\s*₹|bit\.ly\/|tinyurl\.com\/|pmkisan-/i.test(
      combined
    );
  const hasScam = scamRisk || textScam;
  const isOfficial = platform === "gov" && !hasScam;

  const score = computeTruthScore({
    officialGovt: isOfficial ? 50 : /\.gov\.in\b/i.test(combined) && !hasScam ? 35 : 0,
    crossSource: isOfficial ? 20 : 8,
    recency: /\b(2020|2021|2022|2023|2024)\b/.test(combined) ? 0 : 12,
    groundSafety: hasScam ? 0 : isOfficial ? 15 : 12,
    scamSignal: hasScam,
  });

  if (score.recycledWarning) warnings.push(score.recycledWarning);

  const citations: TruthCitationLink[] = [
    { title: "PM-KISAN Official Portal", url: "https://pmkisan.gov.in/" },
    { title: "Ministry of Agriculture & Farmers Welfare", url: "https://agricoop.gov.in/" },
  ];

  const title = trimmedText ? trimmedText.slice(0, 72) : trimmedUrl;
  const summary =
    score.tierLabel === "VERIFIED_OFFICIAL"
      ? `Offline check verified official .gov.in domain standards for ${locationLabel}. Safe to follow using the official portal citation.`
      : hasScam
        ? `Offline Truth Shield flagged high scam risk (${score.totalPercent}%). Do not install .apk files or share Aadhaar/bank OTPs.`
        : `Offline check scored ${score.totalPercent}% (${score.tierLabel.replace("_", " ")}). Cross-check on pmkisan.gov.in or KVK helpline 1800-180-1551 when online.`;

  const reportPayload = buildTruthReportPayload({
    title,
    checkedInput: trimmedUrl || trimmedText.slice(0, 120),
    platform,
    locationLabel,
    score,
    summary,
    citations,
  });

  return {
    score,
    platform,
    scamRisk: hasScam,
    warnings,
    fetchedTitle: null,
    fetchedDescription: null,
    metadataSource: "offline_local_shield",
    summary,
    citations,
    reportPayload,
  };
}

export function CustomLinkVerifier({
  stateCode,
  stateName,
  districtName,
  prefillUrl = "",
  prefillText = "",
}: CustomLinkVerifierProps) {
  const { language } = useLanguage();
  const [urlInput, setUrlInput] = useState(prefillUrl);
  const [textInput, setTextInput] = useState(prefillText);
  const [submitting, setSubmitting] = useState(false);
  const [pngAction, setPngAction] = useState<
    "idle" | "sharing" | "downloading" | "shared" | "downloaded"
  >("idle");
  const pngResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponsePayload | null>(null);
  const [history, setHistory] = useState<TruthHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(TRUTH_HISTORY_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as TruthHistoryEntry[];
        if (Array.isArray(parsed)) {
          setHistory(parsed.slice(0, 15));
        }
      } catch {
        // Ignore malformed local history
      }
    });
    return () => {
      cancelled = true;
      if (pngResetTimerRef.current) {
        clearTimeout(pngResetTimerRef.current);
      }
    };
  }, []);

  const locationLabel = `${districtName || "Statewide"}, ${stateName}`;

  const persistHistory = (entry: TruthHistoryEntry) => {
    setHistory((prev) => {
      const next = [entry, ...prev.filter((item) => item.id !== entry.id)].slice(0, 15);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(TRUTH_HISTORY_STORAGE_KEY, JSON.stringify(next));
        } catch {
          // Storage quota exceeded or restricted
        }
      }
      return next;
    });
  };

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);

    const trimmedUrl = urlInput.trim();
    const trimmedText = textInput.trim();

    if (!trimmedUrl && !trimmedText) {
      setErrorMsg("Paste a social link (WhatsApp, Instagram, Reddit, X, YouTube) or forward message.");
      return;
    }

    if (trimmedUrl) {
      const precheck = validatePublicSocialUrl(trimmedUrl);
      if (!precheck.ok) {
        setErrorMsg(precheck.reason);
        return;
      }
    }

    setSubmitting(true);
    try {
      let payload: VerifyResponsePayload | null = null;
      if (typeof navigator === "undefined" || navigator.onLine !== false) {
        const res = await fetch("/api/state-pulse/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: trimmedUrl || undefined,
            text: trimmedText || undefined,
            stateCode,
            districtName,
            language,
          }),
        });

        const data = (await res.json()) as VerifyResponsePayload & { error?: string };
        if (!res.ok) {
          setErrorMsg(data.error ?? "Unable to verify this link.");
          return;
        }
        payload = data;
      } else {
        const offlineRes = runOfflineFallbackVerify(trimmedUrl, trimmedText, locationLabel);
        if ("error" in offlineRes) {
          setErrorMsg(offlineRes.error);
          return;
        }
        payload = offlineRes;
      }

      setResult(payload);
      persistHistory({
        id: `${Date.now()}`,
        checkedAtIso: payload.reportPayload.checkedAtIso,
        title: payload.reportPayload.title,
        inputPreview: trimmedUrl || trimmedText.slice(0, 80),
        platform: payload.platform,
        totalPercent: payload.score.totalPercent,
        tierLabel: payload.score.tierLabel,
        summary: payload.summary,
      });
    } catch {
      const offlineRes = runOfflineFallbackVerify(trimmedUrl, trimmedText, locationLabel);
      if ("error" in offlineRes) {
        setErrorMsg(offlineRes.error);
        return;
      }
      setResult(offlineRes);
      persistHistory({
        id: `${Date.now()}`,
        checkedAtIso: offlineRes.reportPayload.checkedAtIso,
        title: offlineRes.reportPayload.title,
        inputPreview: trimmedUrl || trimmedText.slice(0, 80),
        platform: offlineRes.platform,
        totalPercent: offlineRes.score.totalPercent,
        tierLabel: offlineRes.score.tierLabel,
        summary: offlineRes.summary,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const schedulePngIdleReset = () => {
    if (pngResetTimerRef.current) {
      clearTimeout(pngResetTimerRef.current);
    }
    pngResetTimerRef.current = setTimeout(() => {
      setPngAction("idle");
      pngResetTimerRef.current = null;
    }, 2000);
  };

  const handleDownloadReport = async () => {
    if (!result) return;
    setPngAction("downloading");
    try {
      const blob = await renderTruthReportPng(result.reportPayload);
      triggerPngDownload(blob, `truth-shield-${result.score.totalPercent}.png`);
      setPngAction("downloaded");
      schedulePngIdleReset();
      toast("Downloaded 1080x1080 Fact-Check PNG", "success");
    } catch {
      setPngAction("idle");
      toast("Could not generate PNG report on this device", "error");
    }
  };

  const handleShareWhatsApp = async () => {
    if (!result) return;
    setPngAction("sharing");
    try {
      const blob = await renderTruthReportPng(result.reportPayload);
      const mode = await shareTruthReportToWhatsApp(result.reportPayload, blob);
      setPngAction("shared");
      schedulePngIdleReset();
      toast(
        mode === "shared"
          ? "Fact-Check PNG shared"
          : "PNG downloaded — opening WhatsApp summary",
        "success"
      );
    } catch {
      setPngAction("idle");
      toast("Unable to open share sheet", "error");
    }
  };

  const presentation = result ? getTierPresentation(result.score.tierLabel) : null;

  return (
    <Stack direction="vertical" gap={4}>
      <BezelCard elevated>
        <form onSubmit={handleVerify}>
          <Stack direction="vertical" gap={4}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <span className="type-eyebrow" style={{ color: "var(--text-muted)" }}>
                  Truth Shield · {locationLabel}
                </span>
                <Heading level={2} weight="normal" className="type-section-title mt-1">
                  Verify Link or WhatsApp Forward
                </Heading>
                <Text type="supporting" className="mt-1 block">
                  Paste any WhatsApp, Instagram, Reddit, X, YouTube, or .gov.in link to score
                  authenticity against official portals and block APK/phishing traps.
                </Text>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  label="Test Official Link"
                  onClick={() => {
                    setUrlInput("https://pmkisan.gov.in/");
                    setTextInput("PM-KISAN e-KYC and beneficiary status verification portal 2026.");
                    setErrorMsg(null);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  label="Test Fake APK Forward"
                  onClick={() => {
                    setUrlInput("https://pmkisan-yojana.com/bonus-app.apk");
                    setTextInput(
                      "Urgent: Install PM Kisan bonus app.apk and pay ₹499 registration fee to get ₹6000 today!"
                    );
                    setErrorMsg(null);
                  }}
                />
              </div>
            </div>

            <InputGroup label="Social or Official Link">
              <InputGroupText>
                <Link2 className="w-4 h-4" aria-hidden="true" />
              </InputGroupText>
              <TextInput
                label="Social or Official Link"
                isLabelHidden
                type="url"
                value={urlInput}
                onChange={(val) => setUrlInput(val)}
                placeholder="https://wa.me/... or https://pmkisan.gov.in/"
                hasClear
                width="100%"
              />
            </InputGroup>

            <TextArea
              label="WhatsApp / Social Forward Text (Optional)"
              value={textInput}
              onChange={(val) => setTextInput(val)}
              placeholder="Paste the forwarded message, crop alert, or subsidy claim text..."
              rows={3}
              width="100%"
            />

            {errorMsg && (
              <Banner
                status="error"
                title="Blocked or Invalid Input"
                description={errorMsg}
                collapsible={false}
              />
            )}

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Text type="supporting" className="type-caption">
                Deterministic 4-factor scoring · Never uses an LLM to guess Truth %
              </Text>
              <Button
                type="submit"
                variant="primary"
                loading={submitting}
                icon={<ShieldCheck className="w-4 h-4" aria-hidden="true" />}
                label="Verify Truth Score"
              />
            </div>
          </Stack>
        </form>
      </BezelCard>

      {result && presentation && (
        <Card variant="default" padding={5} data-testid="truth-verify-result">
          <Stack direction="vertical" gap={4}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <StatusDot
                  variant={presentation.dotVariant}
                  label={presentation.label}
                  icon={presentation.icon}
                />
                <span className="font-semibold text-base" style={{ color: "var(--text-primary)" }}>
                  {presentation.label}
                </span>
                <span className="type-caption" style={{ color: "var(--text-muted)" }}>
                  · {result.platform.toUpperCase()} ·{" "}
                  {result.platform === "gov" && result.metadataSource === "heuristic_fallback"
                    ? "Official .gov.in domain verified (portal blocked preview)"
                    : result.metadataSource.replace(/_/g, " ")}
                </span>
              </div>
              <span className="type-kpi" style={{ color: "var(--text-primary)" }}>
                {result.score.totalPercent}%
              </span>
            </div>

            <ProgressBar
              value={result.score.totalPercent}
              max={100}
              label="Truth Score Confidence"
              hasValueLabel
              variant={presentation.progressVariant}
            />

            {result.score.scamWarning && (
              <Banner
                status="error"
                title="Scam / Phishing Warning"
                description={result.score.scamWarning}
                collapsible={false}
              />
            )}

            {result.score.recycledWarning && (
              <Banner
                status="warning"
                title="Recycled Forward Alert"
                description={result.score.recycledWarning}
                collapsible={false}
              />
            )}

            <Text type="body" className="type-lead">
              {result.summary}
            </Text>

            {result.fetchedTitle && (
              <div
                className="rounded-xl p-3 border"
                style={{
                  background: "var(--bg-raised)",
                  borderColor: "var(--border-default)",
                }}
              >
                <span className="type-caption block" style={{ color: "var(--text-muted)" }}>
                  Fetched Source Title
                </span>
                <Text type="body" weight="medium">
                  {result.fetchedTitle}
                </Text>
              </div>
            )}

            <Collapsible trigger="4-Factor Truth Breakdown (0–100%)" defaultIsOpen={false}>
              <Stack direction="vertical" gap={2}>
                <div className="flex justify-between text-sm py-1">
                  <span>Official Govt Domain / Portal Match</span>
                  <span className="font-mono">{result.score.breakdown.officialGovt} / 50</span>
                </div>
                <Divider />
                <div className="flex justify-between text-sm py-1">
                  <span>Cross-Source &amp; Agromet Corroboration</span>
                  <span className="font-mono">{result.score.breakdown.crossSource} / 20</span>
                </div>
                <Divider />
                <div className="flex justify-between text-sm py-1">
                  <span>Recency &amp; Seasonal Freshness</span>
                  <span className="font-mono">{result.score.breakdown.recency} / 15</span>
                </div>
                <Divider />
                <div className="flex justify-between text-sm py-1">
                  <span>Ground Safety (No APK / OTP / Fee Trap)</span>
                  <span className="font-mono">{result.score.breakdown.groundSafety} / 15</span>
                </div>
              </Stack>
            </Collapsible>

            {result.citations.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-caption" style={{ color: "var(--text-muted)" }}>
                  Official Citations:
                </span>
                {result.citations.map((cite, idx) => (
                  <Citation
                    key={cite.url}
                    source={{ title: cite.title, url: cite.url }}
                    number={idx + 1}
                    variant="label"
                  />
                ))}
              </div>
            )}

            <div className="pt-1">
              <ButtonGroup label="Fact-check report actions" size="sm">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pngAction === "sharing"}
                  tooltip="Generate and share 1080x1080 fact-check card on WhatsApp"
                  icon={
                    pngAction === "shared" ? (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Share2 className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                  label={pngAction === "shared" ? "Shared Fact-Check PNG" : "Share Fact-Check PNG"}
                  onClick={() => void handleShareWhatsApp()}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={pngAction === "downloading"}
                  tooltip="Download 1080x1080 fact-check PNG image"
                  icon={
                    pngAction === "downloaded" ? (
                      <Check className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <Download className="w-4 h-4" aria-hidden="true" />
                    )
                  }
                  label={
                    pngAction === "downloaded"
                      ? "Downloaded 1080x1080"
                      : "Download 1080x1080 Report"
                  }
                  onClick={() => void handleDownloadReport()}
                />
              </ButtonGroup>
            </div>
          </Stack>
        </Card>
      )}

      {history.length > 0 && (
        <Card variant="default" padding={5}>
          <Heading level={3} weight="normal" className="type-card-title mb-2">
            Recent Verification History
          </Heading>
          <List hasDividers density="balanced" edge="flush">
            {history.slice(0, 5).map((entry) => {
              const tier = getTierPresentation(entry.tierLabel);
              return (
                <ListItem
                  key={entry.id}
                  startContent={
                    <StatusDot variant={tier.dotVariant} label={tier.label} icon={tier.icon} />
                  }
                  label={entry.title}
                  description={`${tier.label} (${entry.totalPercent}%) · ${entry.platform.toUpperCase()} · ${entry.checkedAtIso.slice(0, 10)}`}
                  endContent={
                    <span className="type-kpi-sm" style={{ color: "var(--text-primary)" }}>
                      {entry.totalPercent}%
                    </span>
                  }
                />
              );
            })}
          </List>
        </Card>
      )}
    </Stack>
  );
}
