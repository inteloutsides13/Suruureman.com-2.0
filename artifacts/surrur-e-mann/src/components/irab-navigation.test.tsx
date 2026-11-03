import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "wouter";
import { AdminLayout } from "./admin-layout";
import { ContributorLayout } from "./contributor-layout";
import { Layout } from "./layout";

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  useAdminAuth: vi.fn(),
}));

vi.mock("@/hooks/use-admin-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-admin-auth")>();
  return {
    ...actual,
    adminFetch: mocks.adminFetch,
    useAdminAuth: mocks.useAdminAuth,
  };
});

vi.mock("@/components/radio-player", () => ({
  RadioMiniPlayer: () => null,
}));

vi.mock("@/hooks/use-radio-player", () => ({
  RadioPlayerProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const irabLabel = "اِعْراب — e'raab";

function renderWithRouter(children: ReactNode) {
  return render(<Router>{children}</Router>);
}

function authState(role: string | null, isAuthenticated = true) {
  return {
    email: `${role ?? "visitor"}@example.test`,
    name: role ?? null,
    role,
    isAuthenticated,
    logout: vi.fn(),
  };
}

beforeEach(() => {
  mocks.adminFetch.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ total: 0 }),
  });
  mocks.useAdminAuth.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ settings: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("e'raab navigation visibility", () => {
  it.each(["admin", "developer"])("shows the e'raab link in the %s sidebar", (role) => {
    mocks.useAdminAuth.mockReturnValue(authState(role));

    renderWithRouter(<AdminLayout><div>Admin page</div></AdminLayout>);

    expect(screen.getByRole("link", { name: irabLabel })).toHaveAttribute("href", "/irab");
  });

  it("shows the e'raab link in the Contributor sidebar", () => {
    mocks.useAdminAuth.mockReturnValue(authState("contributor"));

    renderWithRouter(<ContributorLayout><div>Contributor page</div></ContributorLayout>);

    expect(screen.getByRole("link", { name: irabLabel })).toHaveAttribute("href", "/irab");
  });

  it("keeps the public navigation link hidden from visitors", () => {
    mocks.useAdminAuth.mockReturnValue(authState(null, false));

    renderWithRouter(<Layout><div>Public page</div></Layout>);

    expect(screen.queryByRole("link", { name: /e'raab/ })).not.toBeInTheDocument();
  });

  it.each(["admin", "developer", "contributor"])(
    "shows the public e'raab link for the authenticated %s role",
    (role) => {
      mocks.useAdminAuth.mockReturnValue(authState(role));

      renderWithRouter(<Layout><div>Public page</div></Layout>);

      const links = screen.getAllByRole("link", { name: /e'raab/ });
      expect(links).toHaveLength(2);
      links.forEach((link) => expect(link).toHaveAttribute("href", "/irab"));
    },
  );
});
