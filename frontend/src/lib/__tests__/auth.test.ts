import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildUser,
  createOfflineUser,
  isOfflineToken,
  useAuthStore,
  type AuthUser,
} from "@/lib/auth";

const sampleUser: AuthUser = {
  token: "jwt-sample-token",
  refreshToken: "refresh-sample",
  email: "farmer@example.com",
  role: "FARMER",
  farmId: "farm-1",
  name: "Ravi Kumar",
  expiresAt: Date.now() + 60 * 60 * 1000,
};

describe("useAuthStore hydration and offline helpers", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, _hasHydrated: false });
  });

  it("excludes _hasHydrated and actions when persisting state to localStorage", () => {
    useAuthStore.getState().setUser(sampleUser);
    useAuthStore.getState().setHasHydrated(true);

    const raw = localStorage.getItem("agritech-auth");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? "{}") as {
      state?: { user?: AuthUser; _hasHydrated?: boolean; setUser?: unknown };
    };

    expect(parsed.state?.user).toEqual(sampleUser);
    expect(parsed.state?._hasHydrated).toBeUndefined();
    expect(parsed.state?.setUser).toBeUndefined();
  });

  it("restores persisted AuthUser on rehydrate and marks _hasHydrated and persist.hasHydrated()", async () => {
    localStorage.setItem(
      "agritech-auth",
      JSON.stringify({ state: { user: sampleUser }, version: 0 })
    );

    await useAuthStore.persist.rehydrate();

    const state = useAuthStore.getState();
    expect(state._hasHydrated).toBe(true);
    expect(useAuthStore.persist.hasHydrated()).toBe(true);
    expect(state.user?.email).toBe(sampleUser.email);
    expect(state.isAuthenticated()).toBe(true);
  });

  it("sets _hasHydrated to true even when localStorage is empty or contains corrupt JSON", async () => {
    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);

    useAuthStore.setState({ user: null, _hasHydrated: false });
    localStorage.setItem("agritech-auth", "{bad-json");

    await useAuthStore.persist.rehydrate();
    expect(useAuthStore.getState()._hasHydrated).toBe(true);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("checks token expiry and offline session helpers", () => {
    const built = buildUser({
      token: "jwt-123",
      email: "a@b.com",
      role: "FARMER",
      farmId: "f-1",
      expiresIn: 3600,
    });
    expect(built.expiresAt).toBeGreaterThan(Date.now());

    useAuthStore.getState().setUser({
      ...sampleUser,
      expiresAt: Date.now() - 1000,
    });
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);

    const offline = createOfflineUser({ email: "ravi@farm.in", name: "Ravi" });
    expect(offline.token).toMatch(/^offline-/);
    expect(offline.role).toBe("FARMER");
    expect(offline.email).toBe("ravi@farm.in");
    expect(offline.name).toBe("Ravi");
    expect(isOfflineToken(offline.token)).toBe(true);
    expect(isOfflineToken("jwt-abc")).toBe(false);
    expect(isOfflineToken(null)).toBe(false);
  });
});

describe("useAuthStore fresh-load storage resilience and token guard", () => {
  const originalLocalStorageDesc = Object.getOwnPropertyDescriptor(
    window,
    "localStorage"
  );

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLocalStorageDesc) {
      Object.defineProperty(window, "localStorage", originalLocalStorageDesc);
    }
    window.localStorage.clear();
    vi.resetModules();
  });

  it("hydrates cleanly with null user when localStorage contains malformed JSON on fresh store load", async () => {
    window.localStorage.setItem("agritech-auth", "{broken-json");
    vi.resetModules();

    const { useAuthStore: freshStore } = await import("@/lib/auth");
    const state = freshStore.getState();

    expect(state._hasHydrated).toBe(true);
    expect(state.user).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it("hydrates and mutates without throwing when localStorage is undefined", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: undefined,
    });
    vi.resetModules();

    const { useAuthStore: freshStore } = await import("@/lib/auth");
    expect(freshStore.getState()._hasHydrated).toBe(true);
    expect(() => freshStore.getState().setUser(sampleUser)).not.toThrow();
    expect(freshStore.getState().isAuthenticated()).toBe(true);
    expect(() => freshStore.getState().clearUser()).not.toThrow();
    expect(freshStore.getState().isAuthenticated()).toBe(false);
  });

  it("hydrates and mutates without throwing when window.localStorage getter throws SecurityError", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });
    vi.resetModules();

    const { useAuthStore: freshStore } = await import("@/lib/auth");
    expect(freshStore.getState()._hasHydrated).toBe(true);
    expect(() => freshStore.getState().setUser(sampleUser)).not.toThrow();
    expect(() => freshStore.getState().clearUser()).not.toThrow();
  });

  it("hydrates and mutates without throwing when localStorage.getItem throws SecurityError", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.resetModules();

    const { useAuthStore: freshStore } = await import("@/lib/auth");
    expect(freshStore.getState()._hasHydrated).toBe(true);
    expect(() => freshStore.getState().setUser(sampleUser)).not.toThrow();
    expect(() => freshStore.getState().clearUser()).not.toThrow();
  });

  it("rejects a tampered user missing a valid token in isAuthenticated()", () => {
    useAuthStore.setState({
      user: { expiresAt: Date.now() + 60_000 } as AuthUser,
      _hasHydrated: true,
    });

    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });
});
