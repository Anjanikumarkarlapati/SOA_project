"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Heading } from "@astryxdesign/core/Heading";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, WifiOff, ArrowRight } from "lucide-react";
import { authApi, isBackendUnreachableError } from "@/lib/api";
import { useAuthStore, buildUser, createOfflineUser } from "@/lib/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { TactileButton } from "@/components/ui/TactileButton";
import { Divider } from "@astryxdesign/core/Divider";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });
type FormData = z.infer<typeof schema>;

function computePasswordStrength(pw: string): {
  score: number;
  label: string;
} {
  if (!pw) return { score: 0, label: "Enter at least 8 characters" };
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score += 1;
  const labels = ["Weak", "Fair", "Good", "Field-Grade Strong"];
  return { score, label: labels[Math.max(0, score - 1)] ?? "Weak" };
}

export default function SignupPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { supabaseEnabled, googleError, clearGoogleError } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const watchedPw = watch("password") || "";
  const strength = computePasswordStrength(watchedPw);

  const handleOfflineContinue = () => {
    setApiErr(null);
    setUser(
      createOfflineUser({
        email: getValues("email"),
        name: getValues("name"),
      })
    );
    router.push("/properties/new");
  };

  const onSubmit = async (data: FormData) => {
    setApiErr(null);
    clearGoogleError();
    setLoading(true);
    try {
      const resp = await authApi.register({
        name: data.name,
        email: data.email,
        password: data.password,
        role: "FARMER",
      });
      setUser(buildUser(resp));
      router.push("/properties/new");
    } catch (e: unknown) {
      if (isBackendUnreachableError(e)) {
        setUser(createOfflineUser({ email: data.email, name: data.name }));
        router.push("/properties/new");
        return;
      }
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Registration failed. Please try again.";
      setApiErr(msg);
    } finally {
      setLoading(false);
    }
  };

  const field = (
    id: string,
    label: string,
    type: string,
    placeholder: string,
    reg: ReturnType<typeof register>,
    error?: { message?: string },
    toggle?: {
      show: boolean;
      set: (v: boolean) => void;
      showLabel: string;
      hideLabel: string;
    }
  ) => {
    const errorId = `${id}-error`;
    return (
      <div>
        <label
          htmlFor={id}
          className="mb-1 block text-sm font-medium text-[var(--text-primary)]"
        >
          {label}
        </label>
        <div className="relative">
          <input
            id={id}
            type={toggle ? (toggle.show ? "text" : "password") : type}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            {...reg}
            className={cn(
              "min-h-[44px] w-full rounded-[12px] border bg-[var(--bg-raised)] px-3.5 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 focus:ring-2",
              error
                ? "border-[var(--status-critical)] focus:ring-[var(--status-critical)]/30"
                : "border-[var(--border-default)] focus:ring-[var(--accent)]/30",
              toggle && "pr-11"
            )}
            placeholder={placeholder}
          />
          {toggle && (
            <button
              type="button"
              onClick={() => toggle.set(!toggle.show)}
              className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label={toggle.show ? toggle.hideLabel : toggle.showLabel}
            >
              {toggle.show ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
        {error && (
          <p
            id={errorId}
            className="mt-1 text-xs text-[var(--status-critical)]"
            role="alert"
          >
            {error.message}
          </p>
        )}
      </div>
    );
  };

  return (
    <AuthSplitShell
      mediaId="irrigation-drip"
      mode="signup"
      editorialBadge="SPECIMEN 02 · ROOT-ZONE IRRIGATION"
      editorialTitle="Register your parcel boundary, soil horizon, and telemetry nodes."
      editorialCopy="Configure your farm boundary, soil profile, and drip irrigation zones in minutes — even without mobile connectivity."
    >
      <div className="mb-5">
        <span className="type-eyebrow text-[var(--text-secondary)]">
          NEW PARCEL ENROLLMENT
        </span>
        <Heading level={1} weight="normal" textWrap="balance" className="type-page-title mt-1 !text-2xl sm:!text-3xl">
          Create your account
        </Heading>
        <p className="mt-1 type-lead !text-sm">
          Start managing your farm in minutes with Google or email.
        </p>
      </div>

      {(apiErr || googleError) && (
        <div
          className="mb-4 rounded-xl border border-[var(--status-critical)]/35 bg-[var(--status-critical)]/10 px-4 py-3 text-sm text-[var(--status-critical)]"
          role="alert"
        >
          {apiErr || googleError}
        </div>
      )}

      {supabaseEnabled && (
        <div className="mb-5 space-y-3" data-testid="preferred-google-auth">
          <div className="rounded-2xl border border-[var(--accent)]/25 bg-[var(--accent-wash)]/45 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="type-eyebrow !font-semibold !text-[var(--accent)]">
                Recommended · Instant Google Enrollment
              </span>
            </div>
            <GoogleSignInButton redirectPath="/login" preferred fullWidth />
          </div>
          <Divider variant="subtle" label="or register with email" />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {field(
          "name",
          "Full name",
          "text",
          "Ravi Kumar",
          register("name"),
          errors.name
        )}
        {field(
          "email",
          "Email address",
          "email",
          "you@example.com",
          register("email"),
          errors.email
        )}
        {field(
          "password",
          "Password",
          "password",
          "Min 8 chars",
          register("password"),
          errors.password,
          {
            show: showPw,
            set: setShowPw,
            showLabel: "Show password",
            hideLabel: "Hide password",
          }
        )}

        {watchedPw.length > 0 && (
          <div
            data-testid="password-strength-meter"
            className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-raised)]/60 px-3 py-2"
          >
            <div className="flex items-center justify-between font-mono text-[11px] text-[var(--text-secondary)]">
              <span>CREDENTIAL STRENGTH</span>
              <span className="font-medium text-[var(--text-primary)]">
                {strength.label}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className="h-1.5 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      strength.score >= bar
                        ? "var(--accent)"
                        : "var(--border-default)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {field(
          "confirm",
          "Confirm password",
          "password",
          "Repeat password",
          register("confirm"),
          errors.confirm,
          {
            show: showConf,
            set: setShowConf,
            showLabel: "Show confirm password",
            hideLabel: "Hide confirm password",
          }
        )}

        <div className="pt-1">
          <TactileButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            {loading ? "Creating account…" : "Create account"}
          </TactileButton>
        </div>
      </form>

      <div className="mt-4">
        <TactileButton
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={handleOfflineContinue}
        >
          <span className="inline-flex items-center gap-2">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
            <span>Continue in Offline Field Mode</span>
          </span>
        </TactileButton>
        <p className="mt-2 text-center font-mono text-xs text-[var(--text-secondary)]">
          Works offline in the field — your farm parcel syncs automatically when connected.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--accent)] underline underline-offset-4 hover:text-[var(--accent-hover)]"
        >
          Sign in
        </Link>
      </p>
    </AuthSplitShell>
  );
}
