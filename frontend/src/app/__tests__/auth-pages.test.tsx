import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import LoginPage from "@/app/login/page";
import SignupPage from "@/app/signup/page";
import { useAuthStore } from "@/lib/auth";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
    className?: string;
  }) => <span role="img" aria-label={alt} data-src={src} />,
}));

describe("LoginPage and SignupPage auth flows", () => {
  beforeEach(() => {
    mockPush.mockReset();
    localStorage.clear();
    useAuthStore.setState({ user: null, _hasHydrated: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
  });

  it("renders a non-empty role=alert and does not redirect on bare HTTP 401 in LoginPage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 401 })
    );

    render(<LoginPage />);

    fireEvent.input(screen.getByLabelText(/email address/i), {
      target: { value: "farmer@example.com" },
    });
    fireEvent.input(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent?.trim().length).toBeGreaterThan(0);
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("renders a non-empty role=alert and does not redirect on bare HTTP 401 in SignupPage", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 401 })
    );

    render(<SignupPage />);

    fireEvent.input(screen.getByLabelText(/full name/i), {
      target: { value: "Ravi Kumar" },
    });
    fireEvent.input(screen.getByLabelText(/email address/i), {
      target: { value: "ravi@farm.in" },
    });
    fireEvent.input(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.input(screen.getByLabelText("Confirm password"), {
      target: { value: "secret123" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /create account/i }).closest("form")!
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent?.trim().length).toBeGreaterThan(0);
    expect(useAuthStore.getState().user).toBeNull();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("provides explicit aria-labels for password and confirm password toggles in SignupPage", () => {
    render(<SignupPage />);

    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show confirm password" })).toBeTruthy();
  });

  it("falls back to an offline- session on network TypeError in LoginPage and navigates to /dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new TypeError("Failed to fetch"));

    render(<LoginPage />);

    fireEvent.input(screen.getByLabelText(/email address/i), {
      target: { value: "ravi@farm.in" },
    });
    fireEvent.input(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
    const user = useAuthStore.getState().user;
    expect(user?.token).toMatch(/^offline-/);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it("creates an offline- session and navigates on clicking Continue in Offline Field Mode in SignupPage", () => {
    render(<SignupPage />);

    fireEvent.input(screen.getByLabelText(/full name/i), {
      target: { value: "Ravi Kumar" },
    });
    fireEvent.input(screen.getByLabelText(/email address/i), {
      target: { value: "ravi@farm.in" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue in offline field mode/i }));

    const user = useAuthStore.getState().user;
    expect(user?.token).toMatch(/^offline-/);
    expect(user?.email).toBe("ravi@farm.in");
    expect(user?.name).toBe("Ravi Kumar");
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
    expect(mockPush).toHaveBeenCalledWith("/properties/new");
  });
});
