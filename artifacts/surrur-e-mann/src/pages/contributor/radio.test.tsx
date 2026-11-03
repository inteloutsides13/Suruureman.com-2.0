import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContributorRadio from "./radio";

const mocks = vi.hoisted(() => ({
  contributorFetch: vi.fn(),
}));

vi.mock("@/hooks/use-admin-auth", () => ({
  contributorFetch: mocks.contributorFetch,
}));

vi.mock("@/components/contributor-layout", () => ({
  ContributorLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("Contributor Radio page", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    mocks.contributorFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ submissions: [] }),
    });
  });

  it("shows only GoCast broadcasting instructions by default", () => {
    render(<ContributorRadio />);

    expect(screen.getByRole("heading", { name: "Broadcasting instructions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Radio", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open public Radio page/ })).toHaveAttribute("href", "/radio");
    expect(screen.getByText(/Use the broadcaster setup link and connection details shared privately by the Radio administrator/)).toBeInTheDocument();
    expect(screen.getByText("Stop broadcasting when finished.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Submit a recording" })).not.toBeInTheDocument();
    expect(screen.queryByText("My Radio submissions")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit for review/i })).not.toBeInTheDocument();
    expect(mocks.contributorFetch).not.toHaveBeenCalled();
  });

  it("retains the existing submission interface behind the development-only feature flag", async () => {
    vi.stubEnv("VITE_SHOW_CONTRIBUTOR_RADIO_SUBMISSIONS", "true");
    render(<ContributorRadio />);

    expect(screen.getByRole("heading", { name: "Submit a recording" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.contributorFetch).toHaveBeenCalledWith("/api/contributor/radio/submissions"));
    expect(mocks.contributorFetch.mock.calls.some(([path]) => String(path).includes("/api/admin/radio/"))).toBe(false);
  });
});
