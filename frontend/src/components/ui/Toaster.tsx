"use client";
import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";
interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastCtx {
  toast: (message: string, variant?: ToastVariant) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

let globalToast: (m: string, v?: ToastVariant) => void = () => {};
export const toast = (m: string, v?: ToastVariant) => globalToast(m, v);

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const add = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  useEffect(() => {
    globalToast = add;
  }, [add]);

  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info };

  return (
    <Ctx.Provider value={{ toast: add }}>
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        role="region"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const I = Icon[t.variant];
          return (
            <div
              key={t.id}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl shadow-none text-sm font-medium max-w-xs border",
                t.variant === "success" &&
                  "bg-[var(--accent-wash)] border-[var(--status-good)] text-[var(--text-primary)]",
                t.variant === "error" &&
                  "bg-[var(--bg-surface)] border-[var(--status-critical)] text-[var(--status-critical)]",
                t.variant === "info" &&
                  "bg-[var(--bg-surface)] border-[var(--status-info)] text-[var(--text-primary)]"
              )}
            >
              <I className="w-4 h-4 shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}
                aria-label="Dismiss"
                className="min-w-[28px] min-h-[28px] inline-flex items-center justify-center rounded-lg hover:bg-[var(--accent-wash)]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
