"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Heading } from "@astryxdesign/core/Heading";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, WifiOff, ArrowRight, ShieldAlert } from "lucide-react";
import { authApi, isBackendUnreachableError } from "@/lib/api";
import { useAuthStore, buildUser, createOfflineUser } from "@/lib/auth";
import { useAuth } from "@/components/providers/AuthProvider";
import { AuthSplitShell } from "@/components/auth/AuthSplitShell";
import { DemoAccountPicker } from "@/components/auth/DemoAccountPicker";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { TactileButton } from "@/components/ui/TactileButton";
import { Divider } from "@astryxdesign/core/Divider";
import { cn } from "@/lib/utils";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const { supabaseEnabled, googleError, clearGoogleError } = useAuth();
  const [showPw, setShowPw] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleOfflineContinue = () => {
    setApiErr(null);
    const email = getValues("email");
    setUser(createOfflineUser({ email }));
    router.push("/dashboard");
  };

  const onSubmit = async (data: FormData) => {
    setApiErr(null);
    clearGoogleError();
    setLoading(true);
    try {
      const resp = await authApi.login(data);
      setUser(buildUser(resp));
      router.push("/dashboard");
    } catch (e: unknown) {
      if (isBackendUnreachableError(e)) {
        setUser(createOfflineUser({ email: data.email }));
        router.push("/dashboard");
        return;
      }
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Login failed. Please try again.";
      setApiErr(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitShell
      mediaId="hero-field"
      editorialBadge="SPECIMEN 01 · CULTIVATED FURROWS"
      editorialTitle="Precision field telemetry from root zone to canopy."
      editorialCopy="AgriTech Field Hub — live climate intelligence, multi-depth soil moisture telemetry, and offline-ready irrigation control across 11 Indian script locales."
    >
      <div className="mb-5">
        <span className="type-eyebrow text-[var(--text-secondary)]">
          FARMER &amp; ORGANIZER SIGN-IN
        </span>
        <Heading level={1} weight="normal" textWrap="balance" className="type-page-title mt-1 !text-2xl sm:!text-3xl">
          Sign in to your farm
        </Heading>
        <p className="mt-1 type-lead !text-sm">
          Continue with your Google account or sign in with email and password.
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
                Recommended · One-Tap Farmer &amp; Organizer Sign-In
              </span>
            </div>
            <GoogleSignInButton redirectPath="/login" preferred fullWidth />
          </div>
          <Divider variant="subtle" label="or sign in with email" />
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-[var(--text-primary)]"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
            className={cn(
              "min-h-[44px] w-full rounded-[12px] border bg-[var(--bg-raised)] px-3.5 py-2 text-base sm:text-sm text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 focus:ring-2",
              errors.email
                ? "border-[var(--status-critical)] focus:ring-[var(--status-critical)]/30"
                : "border-[var(--border-default)] focus:ring-[var(--accent)]/30"
            )}
            placeholder="you@example.com"
          />
          {errors.email && (
            <p
              id="email-error"
              className="mt-1 text-xs text-[var(--status-critical)]"
              role="alert"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-[var(--text-primary)]"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              onKeyUp={(e) =>
                setCapsLock(
                  typeof e.getModifierState === "function"
                    ? e.getModifierState("CapsLock")
                    : false
                )
              }
              {...register("password")}
              className={cn(
                "min-h-[44px] w-full rounded-[12px] border bg-[var(--bg-raised)] px-3.5 py-2 pr-12 text-base sm:text-sm text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-150 focus:ring-2",
                errors.password
                  ? "border-[var(--status-critical)] focus:ring-[var(--status-critical)]/30"
                  : "border-[var(--border-default)] focus:ring-[var(--accent)]/30"
              )}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {capsLock && (
            <p className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-[var(--status-warning)]">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Caps Lock is active
            </p>
          )}
          {errors.password && (
            <p
              id="password-error"
              className="mt-1 text-xs text-[var(--status-critical)]"
              role="alert"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="pt-1">
          <TactileButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
          >
            {loading ? "Signing in…" : "Sign in"}
          </TactileButton>
        </div>
      </form>

      <DemoAccountPicker
        onSelect={({ email, password }) => {
          setValue("email", email, { shouldValidate: true, shouldDirty: true });
          setValue("password", password, { shouldValidate: true, shouldDirty: true });
        }}
      />

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
          No internet in the field? Offline mode saves all farm updates on your device.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-[var(--accent)] underline underline-offset-4 hover:text-[var(--accent-hover)]"
        >
          Create one
        </Link>
      </p>
    </AuthSplitShell>
  );
}
