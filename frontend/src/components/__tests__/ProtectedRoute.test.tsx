import React from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuthStore, type AuthUser } from "@/lib/auth";

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}));

const sampleUser: AuthUser = {
  token: "jwt-sample-token",
  email: "farmer@example.com",
  role: "FARMER",
  farmId: "farm-1",
  name: "Ravi Kumar",
  expiresAt: Date.now() + 60 * 60 * 1000,
};

function renderProtected() {
  return render(
    <AuthProvider>
      <ProtectedRoute>
        <div data-testid="protected-child">Field Hub</div>
      </ProtectedRoute>
    </AuthProvider>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    localStorage.clear();
    useAuthStore.setState({ user: null, _hasHydrated: false });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading status without redirecting before store hydration completes", () => {
    renderProtected();

    expect(screen.getByRole("status", { name: /loading session/i })).toBeTruthy();
    expect(screen.queryByTestId("protected-child")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("renders protected children without redirecting when localStorage restores a valid session", async () => {
    localStorage.setItem(
      "agritech-auth",
      JSON.stringify({ state: { user: sampleUser }, version: 0 })
    );

    renderProtected();
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => {
      await useAuthStore.persist.rehydrate();
    });

    expect(screen.getByTestId("protected-child")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects to /login after hydration when unauthenticated", () => {
    useAuthStore.setState({ user: null, _hasHydrated: true });

    renderProtected();

    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(screen.queryByTestId("protected-child")).toBeNull();
  });

  it("redirects to /login when user logs out", () => {
    useAuthStore.setState({ user: sampleUser, _hasHydrated: true });

    renderProtected();
    expect(screen.getByTestId("protected-child")).toBeTruthy();

    act(() => {
      useAuthStore.getState().clearUser();
    });

    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("hydrates SSR loading markup to authenticated child with zero React hydration warnings", async () => {
    // 1. Server render: store has not hydrated from localStorage
    useAuthStore.setState({ user: null, _hasHydrated: false });
    const ssrHtml = renderToString(
      <AuthProvider>
        <ProtectedRoute>
          <div data-testid="protected-child">Field Hub</div>
        </ProtectedRoute>
      </AuthProvider>
    );
    expect(ssrHtml).toContain("Loading session");
    expect(ssrHtml).not.toContain("protected-child");

    // 2. Client reload: localStorage already holds a valid session before modules load
    localStorage.setItem(
      "agritech-auth",
      JSON.stringify({ state: { user: sampleUser }, version: 0 })
    );
    vi.resetModules();
    const { useAuthStore: FreshAuthStore } = await import("@/lib/auth");
    const { AuthProvider: FreshAuthProvider } = await import(
      "@/components/providers/AuthProvider"
    );
    const { ProtectedRoute: FreshProtectedRoute } = await import(
      "@/components/ProtectedRoute"
    );
    expect(FreshAuthStore.getState()._hasHydrated).toBe(true);
    expect(FreshAuthStore.getState().isAuthenticated()).toBe(true);

    const container = document.createElement("div");
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onRecoverableError = vi.fn();

    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => {
        root = hydrateRoot(
          container,
          <FreshAuthProvider>
            <FreshProtectedRoute>
              <div data-testid="protected-child">Field Hub</div>
            </FreshProtectedRoute>
          </FreshAuthProvider>,
          { onRecoverableError }
        );
      });

      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="protected-child"]')).not.toBeNull();
      expect(mockReplace).not.toHaveBeenCalled();
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
      errorSpy.mockRestore();
      vi.resetModules();
    }
  });
});
