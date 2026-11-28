import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AgriTech FieldShield & Kisan Companion",
    short_name: "FieldShield",
    description:
      "Offline-first 6 AM irrigation safety, Mandi MSP board, crop doctor, and daily Kisan companion.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#485C11",
    icons: [
      {
        src: "/logo-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
