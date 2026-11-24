"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Globe,
  Search,
  CheckCircle2,
  X,
  MapPin,
  ArrowRight,
  Check,
  Type,
} from "lucide-react";
import {
  useLanguage,
  SUPPORTED_LANGUAGES,
  type LanguageMeta,
} from "@/lib/i18n";

interface LanguageSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFarmPreset?: (presetName: string) => void;
}

type CategoryFilter = "all" | "north_west" | "south" | "east" | "english";

export function LanguageSelectorModal({
  isOpen,
  onClose,
  onSelectFarmPreset,
}: LanguageSelectorModalProps) {
  const { language, setLanguage, activeMeta, t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const filteredLanguages = useMemo(() => {
    return SUPPORTED_LANGUAGES.filter((item) => {
      if (category === "english" && item.code !== "en") return false;
      if (
        category === "north_west" &&
        !["hi", "pa", "mr", "gu"].includes(item.code)
      )
        return false;
      if (
        category === "south" &&
        !["te", "ta", "kn", "ml"].includes(item.code)
      )
        return false;
      if (category === "east" && !["bn", "or"].includes(item.code))
        return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.englishName.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        item.script.toLowerCase().includes(q) ||
        item.scriptLabel.toLowerCase().includes(q) ||
        (item.presetFarmName && item.presetFarmName.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, category]);

  if (!isOpen) return null;

  const handleSelect = (lang: LanguageMeta) => {
    setLanguage(lang.code);
  };

  const handleSelectWithFarm = (lang: LanguageMeta) => {
    setLanguage(lang.code);
    if (lang.presetFarmName && onSelectFarmPreset) {
      onSelectFarmPreset(lang.presetFarmName);
    }
    setTimeout(() => {
      onClose();
    }, 350);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lang-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[24px] max-w-4xl w-full max-h-[92vh] flex flex-col shadow-none overflow-hidden my-auto">
        {/* Header Strip */}
        <div className="p-5 sm:p-7 border-b border-[var(--border-default)] bg-[var(--bg-base)] flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--on-accent)] flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </span>
              <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-secondary)]">
                MULTILINGUAL TYPOGRAPHY ENGINE
              </span>
            </div>
            <h2
              id="lang-modal-title"
              className="text-2xl sm:text-3xl font-serif-display text-[var(--text-primary)]"
            >
              {t("langModal.title", "Select Regional Language & Typography")}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t(
                "langModal.desc",
                "Switching language instantly transforms both interface copy and font families to world-class, premium Indic typography with authentic script proportions and editorial serifs."
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-wash)] transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-4 sm:px-7 border-b border-[var(--border-default)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(
                "langModal.searchPlaceholder",
                "Search by language, script, or state (e.g. Hindi, ਪੰਜਾਬੀ, Telugu, Punjab)..."
              )}
              className="w-full min-h-[44px] pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/60 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={`pill-btn text-xs py-1 px-3 ${
                category === "all" ? "pill-btn-primary" : "pill-btn-secondary"
              }`}
            >
              All ({SUPPORTED_LANGUAGES.length})
            </button>
            <button
              type="button"
              onClick={() => setCategory("north_west")}
              className={`pill-btn text-xs py-1 px-3 ${
                category === "north_west" ? "pill-btn-primary" : "pill-btn-secondary"
              }`}
            >
              North &amp; West
            </button>
            <button
              type="button"
              onClick={() => setCategory("south")}
              className={`pill-btn text-xs py-1 px-3 ${
                category === "south" ? "pill-btn-primary" : "pill-btn-secondary"
              }`}
            >
              South
            </button>
            <button
              type="button"
              onClick={() => setCategory("east")}
              className={`pill-btn text-xs py-1 px-3 ${
                category === "east" ? "pill-btn-primary" : "pill-btn-secondary"
              }`}
            >
              East
            </button>
            <button
              type="button"
              onClick={() => setCategory("english")}
              className={`pill-btn text-xs py-1 px-3 ${
                category === "english" ? "pill-btn-primary" : "pill-btn-secondary"
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* Scrollable Language Grid */}
        <section className="p-4 sm:p-7 overflow-y-auto flex-1 max-h-[52vh] flex flex-col gap-4">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLanguages.map((item) => {
              const isActive = language === item.code;

              return (
                <div
                  key={item.code}
                  className={`p-4 sm:p-5 rounded-2xl border transition-[background-color,border-color] duration-150 flex flex-col justify-between gap-3 ${
                    isActive
                      ? "bg-[var(--accent-wash)] border-[var(--accent)] ring-1 ring-[var(--accent)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-default)] hover:bg-[var(--bg-raised)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span
                          className={`text-2xl sm:text-3xl font-normal text-[var(--text-primary)] leading-tight ${item.fontSpecimenClass}`}
                        >
                          {item.name}
                        </span>
                        <span className="text-xs font-semibold text-[var(--text-secondary)]">
                          {item.englishName}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)] block truncate">
                        {item.region}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {isActive ? (
                        <span className="pill-btn py-1 px-3 text-[11px] bg-[var(--accent)] text-[var(--on-accent)] border border-[var(--accent)]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t("langModal.activeBadge", "Active Language")}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-raised)] text-[var(--text-secondary)] border border-[var(--border-default)]">
                          {item.script.toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Typography Specimen Box */}
                  <div className="bg-[var(--bg-base)]/80 p-3 rounded-xl border border-[var(--border-default)] flex flex-col gap-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-[var(--text-secondary)] gap-1">
                      <span className="font-semibold uppercase tracking-wider flex items-center gap-1">
                        <Type className="w-3 h-3 text-[var(--accent)]" />
                        Typography Specimen
                      </span>
                      <span className="font-mono text-[9px] text-[var(--text-secondary)] bg-[var(--bg-raised)] px-2 py-0.5 rounded-full border border-[var(--border-default)] self-start sm:self-auto">
                        {item.scriptLabel}
                      </span>
                    </div>
                    <p
                      className={`text-sm text-[var(--text-primary)] leading-relaxed font-normal ${item.fontSpecimenClass}`}
                    >
                      {item.sampleHeadline}
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                      {item.sampleBody}
                    </p>
                  </div>

                  {/* Regional Farm Match & Action Button */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[var(--border-default)]">
                    {item.presetFarmName ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                        <MapPin className="w-3 h-3 text-[var(--accent)] shrink-0" />
                        <span className="truncate max-w-[190px]" title={item.presetFarmName}>
                          {item.presetFarmName}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        Global Farm Coordinates
                      </div>
                    )}

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {!isActive ? (
                        <>
                          {item.presetFarmName && onSelectFarmPreset && (
                            <button
                              type="button"
                              onClick={() => handleSelectWithFarm(item)}
                              className="pill-btn pill-btn-secondary text-[11px] py-1 px-2.5"
                              title={`Switch language and jump directly to ${item.presetFarmName}`}
                            >
                              <span>+ Switch Farm</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="pill-btn pill-btn-primary text-[11px] py-1 px-3"
                          >
                            <span>Select</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] text-[var(--text-primary)] font-medium flex items-center gap-1 px-2 py-1 bg-[var(--bg-raised)] rounded-full border border-[var(--accent)]">
                          <Check className="w-3.5 h-3.5" />
                          <span>Applied</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {filteredLanguages.length === 0 && (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
              <Globe className="w-8 h-8 opacity-40" />
              <p className="text-sm font-medium text-[var(--text-primary)]">No languages found</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Try searching for &quot;Hindi&quot;, &quot;Tamil&quot;, &quot;Gurmukhi&quot;, or &quot;Devanagari&quot;.
              </p>
            </div>
          )}
        </section>

        {/* Live Font Specimen Strip & Footer */}
        <div className="p-4 sm:px-7 border-t border-[var(--border-default)] bg-[var(--bg-raised)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-[var(--text-primary)]">Active Typography:</span>
            <span className="font-mono text-[11px] bg-[var(--bg-surface)] px-2.5 py-0.5 rounded-full border border-[var(--border-default)] text-[var(--text-primary)]">
              {activeMeta.script === "latin"
                ? "Crimson Text 400 • DM Sans"
                : `Noto Serif ${activeMeta.script.charAt(0).toUpperCase() + activeMeta.script.slice(1)} 400 • Noto Sans`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pill-btn pill-btn-primary py-1.5 px-6 text-xs"
            >
              <span>{t("langModal.close", "Close")}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
