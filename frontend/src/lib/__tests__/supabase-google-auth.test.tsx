import fs from "node:fs";
import path from "node:path";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { authApi } from "@/lib/api";
import { buildUser, isOfflineToken, useAuthStore } from "@/lib/auth";
import { AuthProvider, useAuth } from "@/components/providers/AuthProvider";

const FRONTEND_ROOT = path.resolve(__dirname, "../../..");

const mockPush = vi.fn();
const mockPathname = vi.fn(() => "/login");
const mockSignInWithOAuth = vi.fn();
const mockOnSupabaseSignIn = vi.fn();
const mockSupabaseSignOut = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  usePathname: () => mockPathname(),
}));

vi.mock("@/lib/supabase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/supabase")>("@/lib/supabase").catch(
    () => ({})
  );
  return {
    ...actual,
    supabaseEnabled: true,
    startGoogleSignIn: (...args: unknown[]) => mockSignInWithOAuth(...args),
    onSupabaseSignIn: (...args: unknown[]) => mockOnSupabaseSignIn(...args),
    supabaseSignOut: (...args: unknown[]) => mockSupabaseSignOut(...args),
  };
});

describe("Supabase Google Auth Port & Page Boundary Consolidation", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockPathname.mockReturnValue("/login");
    mockSignInWithOAuth.mockReset();
    mockOnSupabaseSignIn.mockReset();
    mockOnSupabaseSignIn.mockReturnValue(() => {});
    mockSupabaseSignOut.mockReset().mockResolvedValue(undefined);
    localStorage.clear();
    useAuthStore.setState({ user: null, _hasHydrated: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("posts Supabase access token to /api/auth/google and maps displayName in buildUser", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "agritech-jwt-from-google",
          refreshToken: "refresh-1",
          expiresIn: 900,
          email: "ananya@gmail.com",
          role: "FARMER",
          farmId: "FARM-001",
          displayName: "Ananya Deshmukh",
        }),
        { status: 200 }
      )
    );

    const resp = await authApi.google("sb-google-token");

    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/api/auth/google");
    expect(fetchSpy.mock.calls[0]?.[1]?.body).toBe(
      JSON.stringify({ accessToken: "sb-google-token" })
    );

    const mapped = buildUser(resp);
    expect(mapped.name).toBe("Ananya Deshmukh");
    expect(mapped.role).toBe("FARMER");
  });

  it("uses dynamic window.location.origin (never hardcoded 5173 or 3000) in supabase.ts", () => {
    const sbPath = path.join(FRONTEND_ROOT, "src/lib/supabase.ts");
    expect(fs.existsSync(sbPath)).toBe(true);
    const src = fs.readFileSync(sbPath, "utf-8");

    expect(src).toContain("window.location.origin");
    expect(src).toContain("SIGNED_IN");
    expect(src).not.toContain("5173");
    expect(src).not.toContain("localhost:3000");
  });

  it("renders GoogleSignInButton with crisp Google SVG mark (no emojis) and starts OAuth flow", async () => {
    const { GoogleSignInButton } = await import("@/components/auth/GoogleSignInButton");

    function Harness() {
      const { signInWithGoogle } = useAuth() as ReturnType<typeof useAuth> & {
        signInWithGoogle?: (p?: string) => Promise<void>;
      };
      expect(typeof signInWithGoogle).toBe("function");
      return <GoogleSignInButton redirectPath="/" />;
    }

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    const btn = screen.getByTestId("google-signin-button");
    expect(btn.textContent).toContain("Continue with Google");
    expect(btn.querySelector("svg")).not.toBeNull();

    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith("/");
    });
  });

  it("AuthProvider exchanges incoming Supabase SIGNED_IN token via /api/auth/google and navigates to /dashboard", async () => {
    let capturedCb: ((token: string) => Promise<void> | void) | null = null;
    mockOnSupabaseSignIn.mockImplementation((cb: (token: string) => Promise<void> | void) => {
      capturedCb = cb;
      return () => {};
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          token: "jwt-after-google",
          refreshToken: "ref-2",
          expiresIn: 900,
          email: "google.farmer@gmail.com",
          role: "FARMER",
          farmId: "FARM-001",
          displayName: "Google Farmer",
        }),
        { status: 200 }
      )
    );

    render(
      <AuthProvider>
        <div>home</div>
      </AuthProvider>
    );

    await waitFor(() => expect(capturedCb).not.toBeNull());
    await capturedCb!("sb-oauth-token");

    await waitFor(() => {
      expect(useAuthStore.getState().user?.token).toBe("jwt-after-google");
      expect(useAuthStore.getState().user?.name).toBe("Google Farmer");
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("AuthProvider falls back to an offline Google farmer session when backend is unreachable", async () => {
    let capturedCb:
      | ((token: string, profile?: { email?: string; name?: string }) => Promise<void> | void)
      | null = null;
    mockOnSupabaseSignIn.mockImplementation(
      (
        cb: (token: string, profile?: { email?: string; name?: string }) => Promise<void> | void
      ) => {
        capturedCb = cb;
        return () => {};
      }
    );

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(
      <AuthProvider>
        <div>home</div>
      </AuthProvider>
    );

    await waitFor(() => expect(capturedCb).not.toBeNull());
    await capturedCb!("sb-oauth-token", {
      email: "offline.google@gmail.com",
      name: "Offline Google Farmer",
    });

    await waitFor(() => {
      const stateUser = useAuthStore.getState().user;
      expect(stateUser?.email).toBe("offline.google@gmail.com");
      expect(stateUser?.name).toBe("Offline Google Farmer");
      expect(stateUser?.token.startsWith("offline-")).toBe(true);
      expect(isOfflineToken(stateUser?.token)).toBe(true);
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("enforces clean page boundaries and places Google Sign-In above forms on /login and /signup", () => {
    const homeSrc = fs.readFileSync(path.join(FRONTEND_ROOT, "src/app/page.tsx"), "utf-8");
    const loginSrc = fs.readFileSync(path.join(FRONTEND_ROOT, "src/app/login/page.tsx"), "utf-8");
    const signupSrc = fs.readFileSync(path.join(FRONTEND_ROOT, "src/app/signup/page.tsx"), "utf-8");
    const climateSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/app/climate/page.tsx"),
      "utf-8"
    );
    const dashboardSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/app/dashboard/page.tsx"),
      "utf-8"
    );
    const profileSrc = fs.readFileSync(
      path.join(FRONTEND_ROOT, "src/app/profile/page.tsx"),
      "utf-8"
    );

    expect(homeSrc).toContain("GoogleSignInButton");
    expect(loginSrc).toContain("GoogleSignInButton");
    expect(signupSrc).toContain("GoogleSignInButton");

    // Preferred Google Auth must render ahead of the email/password <form>
    expect(loginSrc.indexOf("<GoogleSignInButton")).toBeGreaterThan(-1);
    expect(loginSrc.indexOf("<GoogleSignInButton")).toBeLessThan(loginSrc.indexOf("<form"));
    expect(signupSrc.indexOf("<GoogleSignInButton")).toBeGreaterThan(-1);
    expect(signupSrc.indexOf("<GoogleSignInButton")).toBeLessThan(signupSrc.indexOf("<form"));

    // Clean separation: /climate stays focused on 14-day weather/ET0; /dashboard & /profile exclude developer pipeline
    expect(climateSrc).not.toContain("RootZoneSoilCard");
    expect(climateSrc).not.toContain("FarmerRecommendationCard");
    expect(dashboardSrc).not.toContain("MicroservicesPipelineCard");
    expect(profileSrc).not.toContain("MicroservicesPipelineCard");
  });
});
