"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { Card } from "@astryxdesign/core/Card";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import {
  Check,
  Droplets,
  HelpCircle,
  MessageCircle,
  Sprout,
  Store,
  Volume2,
  VolumeX,
  Wind,
} from "lucide-react";
import { BezelCard } from "@/components/ui/BezelCard";
import { Button } from "@/components/ui/Button";
import {
  buildDailyBriefing,
  type DailyActionBriefing,
  type DailyBriefingMandiInput,
  type DailyBriefingWeatherInput,
} from "@/lib/daily-briefing";
import { useLanguage } from "@/lib/i18n";
import type { FarmProperty } from "@/lib/property-store";
import { cn } from "@/lib/utils";

const SPEECH_LOCALE_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  pa: "pa-IN",
  mr: "mr-IN",
  te: "te-IN",
  ta: "ta-IN",
  kn: "kn-IN",
  bn: "bn-IN",
  gu: "gu-IN",
  or: "or-IN",
  ml: "ml-IN",
};

export interface DailyActionCardProps {
  property:
    | Pick<
        FarmProperty,
        "id" | "name" | "areaHa" | "irrigationType" | "selectedCropId" | "address"
      >
    | null
    | undefined;
  weather: DailyBriefingWeatherInput | null | undefined;
  topMandi?: DailyBriefingMandiInput | null;
  highlighted?: boolean;
  onLogToRoznamcha?: (briefing: DailyActionBriefing) => void;
  id?: string;
}

export function DailyActionCard({
  property,
  weather,
  topMandi,
  highlighted = false,
  onLogToRoznamcha,
  id = "daily-action-card",
}: DailyActionCardProps) {
  const { language, t } = useLanguage();
  const [speaking, setSpeaking] = useState(false);
  const [sharedCopied, setSharedCopied] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const briefing = useMemo(
    () => buildDailyBriefing(property, weather, topMandi, language),
    [property, weather, topMandi, language]
  );

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speakWithWebSpeech = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeaking(false);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LOCALE_MAP[language] ?? "en-IN";
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const handleListen = async () => {
    if (speaking) {
      stopPlayback();
      return;
    }
    setSpeaking(true);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      speakWithWebSpeech(briefing.spokenScript);
      return;
    }

    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: briefing.spokenScript,
          language,
        }),
      });
      if (!res.ok) {
        speakWithWebSpeech(briefing.spokenScript);
        return;
      }
      const wavBlob = await res.blob();
      if (wavBlob.size === 0) {
        speakWithWebSpeech(briefing.spokenScript);
        return;
      }
      const url = URL.createObjectURL(wavBlob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => stopPlayback();
      audio.onerror = () => {
        stopPlayback();
        speakWithWebSpeech(briefing.spokenScript);
      };
      await audio.play();
    } catch {
      speakWithWebSpeech(briefing.spokenScript);
    }
  };

  const handleShareWhatsApp = async () => {
    try {
      await navigator.clipboard?.writeText(briefing.whatsappText);
    } catch {
      // Ignore clipboard failures in headless/restricted browsers
    }
    setSharedCopied(true);
    setTimeout(() => setSharedCopied(false), 2000);
    if (typeof window !== "undefined") {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(briefing.whatsappText)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
  };

  const waterDotVariant =
    briefing.irrigationVerdict.action === "IRRIGATE"
      ? "success"
      : briefing.irrigationVerdict.action === "CAUTION"
        ? "warning"
        : "error";

  const sprayDotVariant =
    briefing.sprayWindow.status === "SAFE"
      ? "success"
      : briefing.sprayWindow.status === "CAUTION"
        ? "warning"
        : "error";

  return (
    <BezelCard
      id={id}
      data-testid="daily-action-card"
      elevated
      className={cn(
        "transition-all duration-300",
        highlighted && "ring-2 ring-[var(--accent)] ring-offset-2"
      )}
      innerClassName="p-5 sm:p-6 space-y-4"
    >
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <VStack gap={0.5}>
          <Text type="label" color="secondary" className="type-eyebrow">
            {t("daily.cardTag", "6 AM Daily Action Card")} · {language.toUpperCase()}
          </Text>
          <Heading level={2} weight="semibold" className="type-card-title">
            {property?.name ?? "FieldShield Farm"}
          </Heading>
        </VStack>

        <ButtonGroup label="Daily action tools" size="sm">
          <Button
            label={speaking ? t("daily.stopAudio", "Stop Audio") : t("daily.listen", "Listen")}
            variant="secondary"
            size="sm"
            tooltip={
              speaking
                ? "Stop reading the 6 AM advisory aloud"
                : "Listen to the 6 AM advisory in your language"
            }
            icon={speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            onClick={() => void handleListen()}
          />
          <Button
            label={sharedCopied ? "Copied for WhatsApp" : t("daily.shareWhatsApp", "Share on WhatsApp")}
            variant="secondary"
            size="sm"
            tooltip={
              sharedCopied
                ? "6 AM advisory copied to clipboard"
                : "Copy and share 6 AM advisory on WhatsApp"
            }
            icon={
              sharedCopied ? (
                <Check className="w-4 h-4" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )
            }
            onClick={() => void handleShareWhatsApp()}
          />
        </ButtonGroup>
      </HStack>

      <Grid columns={{ minWidth: 210, max: 3 }} gap={3}>
        <Card variant="muted" padding={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center">
              <StatusDot
                variant={waterDotVariant}
                label={`Irrigation status: ${briefing.irrigationVerdict.action}`}
              />
              <Droplets className="w-4 h-4 text-[var(--status-info)]" />
              <Text type="label" weight="semibold">
                WATER · {briefing.irrigationVerdict.action}
              </Text>
            </HStack>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {briefing.irrigationVerdict.headline}
            </Text>
            <Text type="supporting" size="sm" color="secondary">
              {briefing.irrigationVerdict.netLitres > 0
                ? briefing.irrigationVerdict.recommendedMinutes > 240
                  ? `240 min/cycle (${Math.ceil(briefing.irrigationVerdict.recommendedMinutes / 240)} cycles · ${briefing.irrigationVerdict.recommendedMinutes} min total)`
                  : `${briefing.irrigationVerdict.recommendedMinutes} min runtime`
                : "Valve interlock active"}
            </Text>
          </VStack>
        </Card>

        <Card variant="muted" padding={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center">
              <StatusDot
                variant={sprayDotVariant}
                label={`Spray window status: ${briefing.sprayWindow.status}`}
                isPulsing={briefing.sprayWindow.status === "HOLD"}
              />
              <Wind className="w-4 h-4 text-[var(--accent)]" />
              <Text type="label" weight="semibold">
                SPRAY · {briefing.sprayWindow.status}
              </Text>
            </HStack>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {briefing.sprayWindow.startHour}–{briefing.sprayWindow.endHour}
            </Text>
            <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
              Wind {briefing.sprayWindow.windKmh} km/h
            </Text>
          </VStack>
        </Card>

        <Card variant="muted" padding={4}>
          <VStack gap={1.5}>
            <HStack gap={2} vAlign="center">
              <StatusDot variant="accent" label="Mandi market update" />
              <Store className="w-4 h-4 text-[var(--accent)]" />
              <Text type="label" weight="semibold">
                MANDI SNAPSHOT
              </Text>
            </HStack>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {briefing.marketHeadline}
            </Text>
            <Text type="supporting" size="sm" color="secondary">
              {property?.address || "Local APMC benchmark"}
            </Text>
          </VStack>
        </Card>
      </Grid>

      <Collapsible
        defaultIsOpen={false}
        chevronPosition="end"
        data-testid="kyun-collapsible"
        trigger={
          <HStack gap={2} vAlign="center">
            <HelpCircle className="w-4 h-4 text-[var(--accent)]" />
            <Text type="label" weight="semibold">
              Kyun? · Why this advice
            </Text>
          </HStack>
        }
      >
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            background: "var(--bg-raised)",
            borderColor: "var(--border-default)",
          }}
        >
          <Text type="body" className="type-lead !text-[var(--text-primary)]">
            {briefing.kyunReason}
          </Text>
          {onLogToRoznamcha && (
            <HStack hAlign="end">
              <Button
                label="Log Brief to Roznamcha"
                variant="outline"
                size="sm"
                icon={<Sprout className="w-3.5 h-3.5" />}
                onClick={() => onLogToRoznamcha(briefing)}
              />
            </HStack>
          )}
        </div>
      </Collapsible>
    </BezelCard>
  );
}
