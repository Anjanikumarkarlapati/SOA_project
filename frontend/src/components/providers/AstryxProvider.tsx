"use client";
import React from "react";
import NextLink from "next/link";
import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme, defineTheme } from "@astryxdesign/core/theme";
import { useTheme } from "./ThemeProvider";

const agritechFieldTheme = defineTheme({
  name: "agritech-field",
  typography: {
    scale: { base: 15.5, ratio: 1.225 },
    heading: {
      weight: "normal",
      weights: { 3: "semibold", 4: "semibold", 5: "semibold", 6: "semibold" },
    },
  },
  tokens: {
    "--color-background-body": ["#FFFFFF", "#0E110B"],
    "--color-background-surface": ["#FFFFFF", "#151911"],
    "--color-background-card": ["#FFFFFF", "#151911"],
    "--color-background-popover": ["#FFFFFF", "#151911"],
    "--color-background-muted": ["#F7F8F5", "#1D2318"],
    "--color-accent": ["#485C11", "#9AB556"],
    "--color-accent-muted": ["#DFECC6", "#242F18"],
    "--color-on-accent": ["#FFFFFF", "#0E110B"],
    "--color-text-primary": ["#000000", "#F5F7F2"],
    "--color-text-secondary": ["#6F6F6F", "#A6B09D"],
    "--color-text-accent": ["#485C11", "#9AB556"],
    "--color-icon-primary": ["#000000", "#F5F7F2"],
    "--color-icon-secondary": ["#6F6F6F", "#A6B09D"],
    "--color-icon-accent": ["#485C11", "#9AB556"],
    "--color-border": ["#E9E9E9", "#262E20"],
    "--color-border-emphasized": ["#C7C9C2", "#47543B"],
    "--color-success": ["#485C11", "#9AB556"],
    "--color-on-success": ["#FFFFFF", "#0E110B"],
    "--color-warning": ["#9A6300", "#E0B243"],
    "--color-error": ["#B3261E", "#F07A72"],
    "--color-info": ["#2C5E8A", "#78B1DB"],
    "--size-element-sm": "36px",
    "--size-element-md": "44px",
    "--size-element-lg": "48px",
    "--radius-inner": "10px",
    "--radius-element": "14px",
    "--radius-container": "24px",
    "--shadow-low": "0 2px 8px -2px rgba(16, 24, 6, 0.16)",
    "--shadow-med": "0 6px 18px -4px rgba(16, 24, 6, 0.22)",
    "--shadow-high": "0 14px 32px -8px rgba(16, 24, 6, 0.26)",
    "--font-family-body": "var(--font-sans)",
    "--font-family-heading": "var(--font-serif)",
    "--font-family-code": "var(--font-mono)",
  },
  components: {
    button: {
      base: {
        borderRadius: "9999px",
        fontWeight: "600",
      },
    },
    "icon-button": {
      base: {
        borderRadius: "9999px",
      },
    },
    card: {
      base: {
        borderRadius: "20px",
        borderColor: "var(--border-default)",
      },
    },
    badge: {
      base: {
        borderRadius: "9999px",
      },
    },
    "banner-frame": {
      base: {
        borderRadius: "16px",
      },
    },
    "button-group": {
      base: {
        borderRadius: "9999px",
      },
    },
    thumbnail: {
      base: {
        borderRadius: "14px",
      },
    },
    heading: {
      base: {
        fontKerning: "normal",
        letterSpacing: "var(--indic-tracking, -0.025em)",
        color: "var(--text-primary)",
      },
    },
    text: {
      base: {
        fontKerning: "normal",
      },
    },
  },
  onDark: {
    components: {
      button: {
        base: {
          borderColor: "rgba(255,255,255,0.24)",
        },
      },
      "icon-button": {
        base: {
          borderColor: "rgba(255,255,255,0.24)",
        },
      },
    },
  },
});

export function AstryxProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <Theme theme={agritechFieldTheme} mode={theme}>
      <LinkProvider component={NextLink}>{children}</LinkProvider>
    </Theme>
  );
}
