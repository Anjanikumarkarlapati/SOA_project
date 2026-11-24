"use client";

import React from "react";
import { KeyRound } from "lucide-react";

export interface DemoAccountPickerProps {
  onSelect: (credentials: { email: string; password: string }) => void;
}

export function DemoAccountPicker({ onSelect }: DemoAccountPickerProps) {
  return (
    <div
      data-testid="demo-account-picker"
      className="mt-4 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-raised)] p-3.5"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
          <KeyRound className="h-3 w-3 text-[var(--accent)]" aria-hidden="true" />
          Quick Demo Accounts
        </span>
        <span className="font-mono text-[10px] text-[var(--text-secondary)]">
          1-Click Fill
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          data-testid="demo-fill-farmer"
          onClick={() =>
            onSelect({ email: "farmer@agritech.io", password: "farmer1234" })
          }
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
          className="inline-flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Farmer Account
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            farmer@agritech.io
          </span>
        </button>

        <button
          type="button"
          data-testid="demo-fill-admin"
          onClick={() =>
            onSelect({ email: "admin@agritech.io", password: "admin1234" })
          }
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-default)",
            color: "var(--text-primary)",
          }}
          className="inline-flex min-h-[44px] flex-col items-start justify-center rounded-xl border px-3 py-2 text-left transition-colors hover:border-[var(--accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        >
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Field Organizer
          </span>
          <span className="font-mono text-[10px] text-[var(--text-secondary)]">
            admin@agritech.io
          </span>
        </button>
      </div>
    </div>
  );
}
