"use client";

import React, { useState } from "react";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Lightbox } from "@astryxdesign/core/Lightbox";
import { MediaTheme } from "@astryxdesign/core/theme";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EditorialPhotoFrameProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  /** Adds subtle bottom gradient scrim for overlay readability */
  scrim?: boolean;
  /** Top-left floating pill or status slot */
  topLeft?: React.ReactNode;
  /** Top-right floating action or badge slot */
  topRight?: React.ReactNode;
  /** Bottom caption/telemetry bar */
  caption?: React.ReactNode;
  /** Optional full-resolution lightbox payload */
  lightbox?: { src: string; alt: string; caption?: string };
  "data-testid"?: string;
}

/**
 * Authored botanical double-bezel photo frame matching the home showcase craft.
 * Uses CSS variables only and smooth transform-only image hover scaling.
 */
export function EditorialPhotoFrame({
  children,
  className,
  innerClassName,
  scrim = true,
  topLeft,
  topRight,
  caption,
  lightbox,
  "data-testid": testId,
}: EditorialPhotoFrameProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div
        data-testid={testId}
        className={cn("photo-frame-bezel group relative", className)}
      >
        <div
          className={cn(
            "relative overflow-hidden rounded-[20px] border border-[var(--border-default)] bg-[var(--bg-raised)]",
            innerClassName
          )}
        >
          {children}

          {scrim && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
            />
          )}

          {(topLeft || topRight || lightbox) && (
            <MediaTheme mode="dark">
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                <div className="pointer-events-auto flex items-center gap-2">{topLeft}</div>
                <div className="pointer-events-auto flex items-center gap-2">
                  {topRight}
                  {lightbox && (
                    <IconButton
                      label="Inspect full photo"
                      tooltip="Zoom photo"
                      variant="ghost"
                      size="sm"
                      icon={<Maximize2 className="w-4 h-4" />}
                      onClick={() => setLightboxOpen(true)}
                    />
                  )}
                </div>
              </div>
            </MediaTheme>
          )}

          {caption && (
            <MediaTheme mode="dark">
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2 text-white">
                {caption}
              </div>
            </MediaTheme>
          )}
        </div>
      </div>

      {lightbox && lightboxOpen && (
        <Lightbox
          isOpen={lightboxOpen}
          onOpenChange={setLightboxOpen}
          media={lightbox}
          hasZoom
        />
      )}
    </>
  );
}
