import { render, screen, within } from "@testing-library/react";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Layout } from "./layout";

type MockLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: MockLinkProps) => <a href={href} {...props}>{children}</a>,
  useLocation: () => ["/radio", vi.fn()],
}));

vi.mock("@/hooks/use-admin-auth", () => ({
  hasIrabAccessRole: () => false,
  useAdminAuth: () => ({ isAuthenticated: false, role: null }),
}));

vi.mock("@/components/social-links", () => ({
  SocialLinks: () => null,
}));

vi.mock("@/components/footer-developer-credit", () => ({
  FooterDeveloperCredit: () => null,
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Radio navigation in the shared header", () => {
  it("exposes a direct mobile shortcut and retains the desktop Radio link", () => {
    render(
      <Layout>
        <main>Page content</main>
      </Layout>,
    );

    const mobileShortcut = screen.getByTestId("link-header-radio-mobile");
    expect(mobileShortcut).toHaveAttribute("href", "/radio");
    expect(mobileShortcut).toHaveAttribute("dir", "ltr");
    expect(mobileShortcut).toHaveAttribute("aria-label", "Radio");
    expect(mobileShortcut).toHaveAttribute("title", "Radio");
    expect(mobileShortcut.querySelector("svg.lucide-radio")).toBeInTheDocument();
    expect(within(mobileShortcut).getByText("Radio")).toBeVisible();
    expect(mobileShortcut).toHaveClass("h-11", "min-w-11");
    expect(mobileShortcut.closest("header")).not.toBeNull();
    expect(mobileShortcut.closest("#mobile-navigation-menu")).toBeNull();
    expect(mobileShortcut.className).toContain("lg:hidden");

    const desktopNavigation = screen.getByRole("navigation");
    expect(within(desktopNavigation).getByTestId("link-header-radio-desktop")).toHaveAttribute("href", "/radio");
    expect(within(desktopNavigation).getByText("Poetry")).toBeInTheDocument();
  });
});
