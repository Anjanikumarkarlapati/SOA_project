import { cn } from "@/lib/utils";
import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = error && inputId ? `${inputId}-error` : undefined;
  const hintId = hint && !error && inputId ? `${inputId}-hint` : undefined;
  const describedBy = errorId ?? hintId ?? props["aria-describedby"];

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <input
        id={inputId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
        {...props}
        className={cn(
          "w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder:text-[var(--status-muted)] transition-[border-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] focus:outline-none focus:ring-2",
          error
            ? "border-[var(--status-critical)] focus:ring-[var(--status-critical)]/30"
            : "border-[var(--border-default)] focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]",
          className
        )}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-[var(--text-secondary)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-[var(--status-critical)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Label({
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={cn("text-sm font-medium text-[var(--text-secondary)]", className)}
    >
      {children}
    </label>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({
  label,
  error,
  children,
  className,
  id,
  ...props
}: SelectProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
  const errorId = error && inputId ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <select
        id={inputId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={errorId ?? props["aria-describedby"]}
        {...props}
        className={cn(
          "w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border text-sm bg-[var(--bg-surface)] text-[var(--text-primary)] transition-[border-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] focus:outline-none focus:ring-2",
          error
            ? "border-[var(--status-critical)] focus:ring-[var(--status-critical)]/30"
            : "border-[var(--border-default)] focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]",
          className
        )}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} className="text-xs text-[var(--status-critical)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-2xl border border-[var(--border-default)] shadow-none",
        className
      )}
    >
      {children}
    </div>
  );
}
