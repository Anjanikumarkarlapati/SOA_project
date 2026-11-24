"use client";

import React from "react";
import { Globe, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface LanguageSelectorPillProps {
  onOpenModal: () => void;
  className?: string;
}

export function LanguageSelectorPill({
  onOpenModal,
  className = "",
}: LanguageSelectorPillProps) {
  const { activeMeta, language } = useLanguage();

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className={`pill-btn pill-btn-secondary min-h-[38px] py-1.5 px-3.5 text-xs inline-flex items-center gap-2 group transition-[background-color,border-color,color,transform] duration-150 hover:border-[var(--accent)] hover:bg-[var(--bg-raised)] ${className}`}
      title="Change Language & Typography"
      aria-label={`Current language: ${activeMeta.name} (${activeMeta.englishName}). Click to change.`}
    >
      <Globe className="w-3.5 h-3.5 text-[var(--accent)] group-hover:rotate-12 transition-transform duration-200" />
      <span className="font-semibold text-[var(--text-primary)]">
        {activeMeta.name}
      </span>
      {language !== "en" && (
        <span className="text-[11px] text-[var(--text-secondary)] hidden sm:inline opacity-80">
          ({activeMeta.englishName})
        </span>
      )}
      <span className="hidden md:inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent-wash)] text-[var(--text-secondary)] border border-[var(--border-default)]">
        {activeMeta.script.toUpperCase()}
      </span>
      <ChevronDown className="w-3 h-3 text-[var(--text-secondary)] opacity-70 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
