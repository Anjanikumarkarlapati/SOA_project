"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@astryxdesign/core/Banner";
import { Drawer, DrawerHeader } from "@astryxdesign/core/Drawer";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Camera, Droplets, Mic, Square, Store, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n";
import { getActiveProperty, useFarmStore } from "@/lib/property-store";

export interface VoiceCompanionDrawerProps {
  open: boolean;
  onClose: () => void;
  onOpenCropDoctor?: () => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0?: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

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

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function buildVoiceAdvisory(transcript: string, farmName: string, locationText: string): string {
  const q = transcript.toLowerCase();
  if (q.includes("mandi") || q.includes("price") || q.includes("rate") || q.includes("msp") || q.includes("मंडी")) {
    return `${farmName} (${locationText}): Check today's Mandi & MSP Board to compare nearby APMC rates net of transport and personal break-even cost.`;
  }
  if (q.includes("spray") || q.includes("wind") || q.includes("water") || q.includes("valve") || q.includes("सिंचाई")) {
    return `${farmName} (${locationText}): Check your 6 AM FieldShield Spray-Safe Clock and valve interlock before starting irrigation or spraying.`;
  }
  if (q.includes("leaf") || q.includes("disease") || q.includes("pest") || q.includes("photo") || q.includes("पत्ता")) {
    return `${farmName}: Open Crop Photo Doctor to scan the leaf for pests, organic remedies, and per-acre dosage.`;
  }
  if (q.includes("scheme") || q.includes("pmfby") || q.includes("subsidy") || q.includes("योजना")) {
    return `${farmName}: Open Government Schemes & 72-Hr PMFBY Locker to check PM-KISAN, PMKSY drip subsidy, and loss claim timers.`;
  }
  return `${farmName} (${locationText}): Review your transcript above and tap Check Mandi, Check Spray, or Crop Photo Doctor to act.`;
}

export function VoiceCompanionDrawer({
  open,
  onClose,
  onOpenCropDoctor,
}: VoiceCompanionDrawerProps) {
  const router = useRouter();
  const { language, t } = useI18n();
  const properties = useFarmStore((s) => s.properties);
  const activePropertyId = useFarmStore((s) => s.activePropertyId);
  const farmLocation = useFarmStore((s) => s.farmLocation);

  const activeProperty = useMemo(
    () => getActiveProperty({ properties, activePropertyId }),
    [activePropertyId, properties]
  );

  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [advisoryText, setAdvisoryText] = useState<string>("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const speechRecRef = useRef<SpeechRecognitionLike | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const stopMediaHardware = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore stop errors on unmount
      }
    }
    recorderRef.current = null;

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }

    if (speechRecRef.current) {
      try {
        speechRecRef.current.stop();
      } catch {
        // ignore
      }
      speechRecRef.current = null;
    }

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
  }, []);

  const handleClose = useCallback(() => {
    stopMediaHardware();
    setIsRecording(false);
    setIsSpeaking(false);
    onClose();
  }, [onClose, stopMediaHardware]);

  useEffect(() => {
    if (!open) {
      stopMediaHardware();
    }
    return () => {
      stopMediaHardware();
    };
  }, [open, stopMediaHardware]);

  const startBrowserSpeechFallback = useCallback(
    (reasonNotice?: string): boolean => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        if (reasonNotice) {
          setStatusNotice(reasonNotice);
        }
        return false;
      }

      try {
        const rec = new Ctor();
        rec.lang = SPEECH_LOCALE_MAP[language] ?? "en-IN";
        rec.interimResults = true;
        rec.continuous = false;

        rec.onresult = (event) => {
          let collected = "";
          for (let i = 0; i < event.results.length; i++) {
            const text = event.results[i]?.[0]?.transcript ?? "";
            collected += `${text} `;
          }
          if (collected.trim()) {
            setTranscript(collected.trim());
          }
        };
        rec.onerror = () => {
          setIsRecording(false);
          setStatusNotice("Browser microphone speech recognition could not capture audio. Edit the text box directly.");
        };
        rec.onend = () => {
          setIsRecording(false);
          speechRecRef.current = null;
        };

        speechRecRef.current = rec;
        rec.start();
        setIsRecording(true);
        setStatusNotice(
          reasonNotice ?? "Listening using device SpeechRecognition — review and edit transcript before acting."
        );
        return true;
      } catch {
        setIsRecording(false);
        setStatusNotice("Unable to start SpeechRecognition. You can type or paste your question below.");
        return false;
      }
    },
    [language]
  );

  const transcribeAudioBlob = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setStatusNotice("Offline mode: type below or tap Speak (Browser Fallback) if supported.");
          return;
        }
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");
        formData.append("language", language);

        const res = await fetch("/api/ai/transcribe", {
          method: "POST",
          body: formData,
        });

        if (res.status === 503 || !res.ok) {
          setStatusNotice(
            "Cloud voice transcription is unavailable (503). You can type below or use browser speech recognition."
          );
          return;
        }

        const data = (await res.json()) as { transcript?: string };
        if (data.transcript?.trim()) {
          setTranscript(data.transcript.trim());
          setStatusNotice("Review or edit what was heard before tapping an action.");
        } else {
          setStatusNotice("No speech detected. Please speak closer to the mic or type below.");
        }
      } catch {
        setStatusNotice("Transcription service unreachable. Edit the transcript box manually.");
      } finally {
        setIsTranscribing(false);
      }
    },
    [language]
  );

  const handleToggleRecord = async () => {
    if (isRecording) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (speechRecRef.current) {
        speechRecRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    setStatusNotice(null);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      startBrowserSpeechFallback("Offline: using on-device browser speech recognition.");
      return;
    }

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      startBrowserSpeechFallback("MediaRecorder unavailable; using browser speech recognition.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          chunksRef.current.push(evt.data);
        }
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const recordedBlob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop();
          }
          streamRef.current = null;
        }
        if (recordedBlob.size > 0) {
          void transcribeAudioBlob(recordedBlob);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      startBrowserSpeechFallback("Microphone recorder blocked; trying browser speech recognition.");
    }
  };

  const handleListen = async () => {
    const farmName = activeProperty?.name ?? "Your Field";
    const locationText = `${farmLocation.mandalOrBlock}, ${farmLocation.districtName}`;
    const textToRead =
      advisoryText.trim() ||
      buildVoiceAdvisory(transcript, farmName, locationText);

    setAdvisoryText(textToRead);

    if (isSpeaking) {
      if (audioRef.current) audioRef.current.pause();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    try {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const res = await fetch("/api/ai/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToRead, language }),
        });

        if (res.ok) {
          const wavBlob = await res.blob();
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          const url = URL.createObjectURL(wavBlob);
          audioUrlRef.current = url;
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => setIsSpeaking(false);
          audio.onerror = () => setIsSpeaking(false);
          await audio.play();
          return;
        }
      }
    } catch {
      // fall through to Web Speech API fallback
    }

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(textToRead);
      utter.lang = SPEECH_LOCALE_MAP[language] ?? "en-IN";
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    } else {
      setIsSpeaking(false);
      setStatusNotice("Audio playback is unavailable in this browser.");
    }
  };

  const handleNavigate = (path: string) => {
    handleClose();
    router.push(path);
  };

  const handleDoctorAction = () => {
    handleClose();
    if (onOpenCropDoctor) {
      onOpenCropDoctor();
    } else {
      router.push("/dashboard?doctor=1");
    }
  };

  const previewAdvice = useMemo(
    () =>
      advisoryText ||
      buildVoiceAdvisory(
        transcript,
        activeProperty?.name ?? "Your Field",
        `${farmLocation.mandalOrBlock}, ${farmLocation.districtName}`
      ),
    [activeProperty?.name, advisoryText, farmLocation.districtName, farmLocation.mandalOrBlock, transcript]
  );

  if (!open) {
    return null;
  }

  return (
    <Drawer
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      label={t("voice.title", "Kisan Voice Companion")}
      side="end"
      width={440}
      purpose="form"
    >
      <Layout
        header={
          <DrawerHeader
            title={t("voice.title", "Kisan Voice Companion")}
            subtitle={t("voice.subtitle", "Speak in your language, verify transcript, then act")}
            onOpenChange={(next) => {
              if (!next) handleClose();
            }}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              <HStack gap={2} vAlign="center" hAlign="between" wrap="wrap">
                <HStack gap={2} vAlign="center">
                  <StatusDot
                    variant={isRecording ? "error" : isTranscribing ? "warning" : "success"}
                    label={isRecording ? "Recording" : isTranscribing ? "Transcribing" : "Ready"}
                    isPulsing={isRecording}
                  />
                  <Text type="label" weight="semibold">
                    {isRecording
                      ? "Listening..."
                      : isTranscribing
                        ? "Transcribing speech..."
                        : "Ready for voice or text"}
                  </Text>
                </HStack>

                <HStack gap={2}>
                  <Button
                    label={isRecording ? "Stop" : "Speak"}
                    variant={isRecording ? "destructive" : "primary"}
                    size="sm"
                    icon={isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    onClick={() => void handleToggleRecord()}
                    disabled={isTranscribing}
                  />
                  <Button
                    label={isSpeaking ? "Stop Audio" : "Listen"}
                    variant="secondary"
                    size="sm"
                    icon={<Volume2 className="w-4 h-4" />}
                    onClick={() => void handleListen()}
                  />
                </HStack>
              </HStack>

              {statusNotice && (
                <Banner
                  status="info"
                  title="Voice Companion Status"
                  description={statusNotice}
                  isDismissable
                  onDismiss={() => setStatusNotice(null)}
                />
              )}

              <TextArea
                label={t("voice.transcriptLabel", "Review or edit what was heard")}
                description="Always verify your crop or question text before opening a tool."
                placeholder="Example: Check mandi price for paddy in Cuttack, or should I spray today?"
                value={transcript}
                onChange={(val) => {
                  setTranscript(val);
                  setAdvisoryText("");
                }}
                rows={4}
                width="100%"
                hasAutoFocus
              />

              <VStack gap={2}>
                <Text type="label" weight="semibold">
                  {t("voice.quickActions", "Quick Action Routing")}
                </Text>
                <HStack gap={2} wrap="wrap">
                  <Button
                    label="Check Mandi"
                    variant="secondary"
                    size="sm"
                    icon={<Store className="w-4 h-4" />}
                    onClick={() => handleNavigate("/mandi")}
                  />
                  <Button
                    label="Check Spray"
                    variant="secondary"
                    size="sm"
                    icon={<Droplets className="w-4 h-4" />}
                    onClick={() => handleNavigate("/irrigation")}
                  />
                  <Button
                    label="Open Crop Doctor"
                    variant="outline"
                    size="sm"
                    icon={<Camera className="w-4 h-4" />}
                    onClick={handleDoctorAction}
                  />
                </HStack>
              </VStack>

              <Banner
                status="success"
                title="Voice Advisory Preview"
                description={previewAdvice}
                endContent={
                  <Button
                    label={isSpeaking ? "Stop" : "Listen"}
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleListen()}
                  />
                }
              />
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} hAlign="end">
              <Button label={t("common.close", "Close")} variant="secondary" onClick={handleClose} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Drawer>
  );
}
