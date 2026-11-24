"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import { cn } from "@/lib/utils";

export interface GoogleSignInButtonProps {
  redirectPath?: string;
  fullWidth?: boolean;
  preferred?: boolean;
  testId?: string;
  className?: string;
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  redirectPath = "/login",
  fullWidth = false,
  preferred = false,
  testId = "google-signin-button",
  className,
}: GoogleSignInButtonProps) {
  const { supabaseEnabled, googleBusy, signInWithGoogle } = useAuth();

  if (!supabaseEnabled) return null;

  return (
    <button
      type="button"
      data-testid={testId}
      data-preferred={preferred ? "true" : "false"}
      disabled={googleBusy}
      onClick={() => void signInWithGoogle(redirectPath)}
      className={cn(
        "group relative inline-flex select-none items-center justify-center rounded-full p-0 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)] disabled:opacity-60 disabled:cursor-not-allowed",
        preferred ? "min-h-[48px]" : "min-h-[44px]",
        fullWidth && "w-full",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          backgroundColor: "color-mix(in oklab, var(--accent) 26%, var(--border-strong))",
          border: "1px solid var(--border-strong)",
          boxShadow: preferred
            ? "0 4px 14px -3px rgba(16, 24, 6, 0.16)"
            : "0 2px 8px -2px rgba(16, 24, 6, 0.12)",
        }}
      />
      <span
        className={cn(
          "relative z-10 inline-flex w-full items-center justify-center gap-2.5 rounded-full border bg-[var(--bg-surface)] px-5 py-2.5 font-semibold text-[var(--text-primary)] transition-transform duration-150 [transition-timing-function:var(--ease-out)] -translate-y-[2px] group-hover:not-disabled:-translate-y-[3px] group-hover:not-disabled:bg-[var(--bg-raised)] group-active:not-disabled:translate-y-0 group-active:not-disabled:scale-[0.985]",
          preferred
            ? "min-h-[48px] border-[var(--accent)]/55"
            : "min-h-[44px] border-[var(--border-strong)]"
        )}
      >
        {googleBusy ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--accent)]" aria-hidden="true" />
        ) : (
          <GoogleMark />
        )}
        <span>{googleBusy ? "Connecting to Google..." : "Continue with Google"}</span>
      </span>
    </button>
  );
}
