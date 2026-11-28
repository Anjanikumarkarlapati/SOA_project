import React from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { MEDIA_MANIFEST } from "@/lib/media-manifest";
import { Button } from "@/components/ui/Button";

const WORKFLOW_STEPS = [
  {
    num: "01",
    title: "Enroll With Google",
    copy: "Sign in with one tap using your Google account and map farm parcels, water sources, and soil types across your region.",
  },
  {
    num: "02",
    title: "Sense Soil & Weather",
    copy: "Track 15, 30, and 60 cm root-zone moisture probes alongside 14-day local rainfall and evaporation forecasts.",
  },
  {
    num: "03",
    title: "Plan Crops & Irrigate",
    copy: "Pick high-yield seasonal crops, check foliar spray safety windows, and automate drip valves while saving water.",
  },
];

export function LandingScrollStory() {
  const closingMedia = MEDIA_MANIFEST["irrigation-drip"];

  return (
    <section
      id="how-to"
      data-testid="landing-scroll-story"
      aria-labelledby="scroll-story-heading"
      className="mx-auto w-full max-w-[1200px] border-t border-[var(--border-default)] py-16 sm:py-24"
    >
      <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <h2
          id="scroll-story-heading"
          className="type-section-title text-3xl sm:text-5xl leading-[1.08]"
        >
          Map Your Harvest
        </h2>
        <Button
          href="/login"
          label="Discover More"
          variant="secondary"
          endContent={<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-10">
        {WORKFLOW_STEPS.map((step) => (
          <div
            key={step.num}
            className="border-t border-[var(--border-default)] pt-8"
          >
            <div className="font-sans text-5xl sm:text-6xl font-normal leading-none tracking-[-0.045em] text-[var(--text-muted)] tabular-nums">
              {step.num}
            </div>
            <h3 className="mt-7 type-card-title text-2xl !font-normal">
              {step.title}
            </h3>
            <p className="mt-2.5 type-lead leading-relaxed">
              {step.copy}
            </p>
          </div>
        ))}
      </div>

      {/* Wide Closing Field Landscape */}
      <div className="photo-frame relative mt-14 aspect-[16/9] sm:aspect-[21/10] w-full">
        <Image
          src={closingMedia.src}
          alt={closingMedia.alt}
          fill
          sizes="(min-width: 1200px) 1200px, 100vw"
          className="object-cover photo-duotone"
        />
      </div>
    </section>
  );
}
