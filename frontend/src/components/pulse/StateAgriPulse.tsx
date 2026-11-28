"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@astryxdesign/core/Card";
import { Citation } from "@astryxdesign/core/Citation";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Stack } from "@astryxdesign/core/Stack";
import { StatusDot, type StatusDotVariant } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { AlertTriangle, CheckCircle2, Share2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { computeTruthScore, type TruthTierLabel } from "@/lib/truth-score";
import {
  buildTruthReportPayload,
  renderTruthReportPng,
  shareTruthReportToWhatsApp,
} from "@/lib/truth-report-image";
import type { PulseFilter, StatePulseItem } from "@/app/api/state-pulse/feed/route";

export interface StateAgriPulseProps {
  stateCode: string;
  stateName: string;
  districtName: string;
  filter: PulseFilter;
}

function getTierMeta(tier: TruthTierLabel): {
  label: string;
  variant: StatusDotVariant;
  icon: React.ReactNode;
} {
  switch (tier) {
    case "VERIFIED_OFFICIAL":
      return {
        label: "Verified True",
        variant: "success",
        icon: <CheckCircle2 className="w-3 h-3" aria-hidden="true" />,
      };
    case "PARTIALLY_VERIFIED":
      return {
        label: "Partially Verified",
        variant: "warning",
        icon: <AlertTriangle className="w-3 h-3" aria-hidden="true" />,
      };
    case "UNVERIFIED_RUMOUR":
      return {
        label: "Unverified Rumour",
        variant: "error",
        icon: <ShieldAlert className="w-3 h-3" aria-hidden="true" />,
      };
  }
}

function buildOfflineFallbackFeed(
  stateCode: string,
  stateName: string,
  districtName: string,
  filter: PulseFilter
): StatePulseItem[] {
  const locationLabel = `${districtName || "Statewide"}, ${stateName}`;
  const items: StatePulseItem[] = [
    {
      id: `offline-${stateCode}-official`,
      category: "official_scheme",
      title: `${stateName} Official Scheme & PM-KISAN DBT Verification`,
      summary:
        "Verify PM-KISAN installment and state input subsidy status only on official .gov.in portals. Never share Aadhaar or bank OTPs on WhatsApp.",
      sourceName: `${stateName} Agriculture Portal`,
      platform: "gov",
      publishedLabel: "Cached offline",
      locationLabel,
      score: computeTruthScore({
        officialGovt: 50,
        crossSource: 20,
        recency: 15,
        groundSafety: 15,
      }),
      citations: [{ title: "PM-KISAN Official", url: "https://pmkisan.gov.in/" }],
    },
    {
      id: `offline-${stateCode}-rumour`,
      category: "social_rumour",
      title: "Fact-Check: Fake Subsidy APK & Fee Forwards",
      summary:
        "Any message asking farmers to install a .apk file or pay a registration fee for free tractors or bonus transfers is fraudulent.",
      sourceName: "FieldShield Rumour Guard",
      platform: "whatsapp",
      publishedLabel: "Cached offline",
      locationLabel,
      score: computeTruthScore({
        officialGovt: 0,
        crossSource: 10,
        recency: 15,
        groundSafety: 0,
        scamSignal: true,
      }),
      citations: [{ title: "PIB Fact Check", url: "https://pib.gov.in/" }],
    },
  ];

  if (filter === "official") return items.filter((i) => i.score.totalPercent >= 85);
  if (filter === "social") return items.filter((i) => i.category === "social_rumour");
  return items;
}

export function StateAgriPulse({
  stateCode,
  stateName,
  districtName,
  filter,
}: StateAgriPulseProps) {
  const [items, setItems] = useState<StatePulseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeed() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          stateCode,
          districtName,
          filter,
        });
        const res = await fetch(`/api/state-pulse/feed?${params.toString()}`);
        if (!res.ok) throw new Error(`Feed HTTP ${res.status}`);
        const data = (await res.json()) as { items?: StatePulseItem[] };
        if (!cancelled) {
          setItems(data.items ?? []);
        }
      } catch {
        if (!cancelled) {
          setItems(buildOfflineFallbackFeed(stateCode, stateName, districtName, filter));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeed();
    return () => {
      cancelled = true;
    };
  }, [stateCode, stateName, districtName, filter]);

  const handleShareBulletin = async (item: StatePulseItem) => {
    setSharingId(item.id);
    try {
      const payload = buildTruthReportPayload({
        title: item.title,
        checkedInput: item.citations[0]?.url ?? item.sourceName,
        platform: item.platform,
        locationLabel: item.locationLabel,
        score: item.score,
        summary: item.summary,
        citations: item.citations,
      });
      const blob = await renderTruthReportPng(payload);
      const mode = await shareTruthReportToWhatsApp(payload, blob);
      toast(
        mode === "shared"
          ? "Bulletin 1080x1080 PNG shared"
          : "PNG downloaded — opening WhatsApp summary",
        "success"
      );
    } catch {
      toast("Unable to export bulletin PNG", "error");
    } finally {
      setSharingId(null);
    }
  };

  return (
    <Card variant="default" padding={5}>
      <Stack direction="vertical" gap={3}>
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <span className="type-eyebrow" style={{ color: "var(--text-muted)" }}>
              Regional Intelligence · {districtName}, {stateName}
            </span>
            <Heading level={2} weight="normal" className="type-section-title mt-1">
              State Agri-Pulse Feed
            </Heading>
          </div>
          <Text type="supporting" className="type-caption">
            Official .gov.in advisories, IMD agromet alerts &amp; local rumour debunks
          </Text>
        </div>

        {loading ? (
          <Stack direction="vertical" gap={3}>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </Stack>
        ) : items.length === 0 ? (
          <Text type="supporting">
            No bulletins match this filter for {districtName}. Switch to All to see full state updates.
          </Text>
        ) : (
          <List hasDividers density="spacious" edge="flush">
            {items.map((item) => {
              const meta = getTierMeta(item.score.tierLabel);
              return (
                <ListItem
                  key={item.id}
                  align="first-line"
                  startContent={
                    <StatusDot variant={meta.variant} label={meta.label} icon={meta.icon} />
                  }
                  label={item.title}
                  description={
                    <Stack direction="vertical" gap={2} className="mt-1">
                      <Text type="body" color="secondary">
                        {item.summary}
                      </Text>
                      <span className="type-caption" style={{ color: "var(--text-muted)" }}>
                        {meta.label} ({item.score.totalPercent}%) · {item.sourceName} ·{" "}
                        {item.publishedLabel} · {item.locationLabel}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        {item.citations.map((cite, idx) => (
                          <Citation
                            key={`${item.id}-${cite.url}`}
                            source={{ title: cite.title, url: cite.url }}
                            number={idx + 1}
                            variant="label"
                          />
                        ))}
                      </div>
                    </Stack>
                  }
                  endContent={
                    <Button
                      size="sm"
                      variant="outline"
                      loading={sharingId === item.id}
                      icon={<Share2 className="w-3.5 h-3.5" aria-hidden="true" />}
                      label="Share PNG"
                      onClick={() => void handleShareBulletin(item)}
                    />
                  }
                />
              );
            })}
          </List>
        )}
      </Stack>
    </Card>
  );
}
