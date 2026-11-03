import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ToolsPage from "./tools";

const state = vi.hoisted(() => ({ role: "admin", isAuthenticated: false }));
vi.mock("@/hooks/use-admin-auth", () => ({
  hasIrabAccessRole: (role: string) => ["developer", "admin", "contributor"].includes(role),
  useAdminAuth: () => state,
}));
vi.mock("framer-motion", () => ({
  motion: new Proxy({}, { get: (_target, tag) => tag }),
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  state.role = "admin";
  state.isAuthenticated = false;
});

describe("protected tool listing", () => {
  it.each(["IRAB", "I'rab", "I‘rab", "Iraab", "Aeraab", "E'raab", "Private Text Tool"])(
    "hides legacy %s cards from visitors even when a stale role remains", async (title) => {
      state.isAuthenticated = false;
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
        tools: [{ id: 1, title, titleUrdu: "", url: "/irab", description: "", descriptionUrdu: "" }],
      }) }));
      render(<ToolsPage />);
      await waitFor(() => expect(screen.getByText("Tools Coming Soon")).toBeInTheDocument());
      expect(screen.queryByText(title, { selector: "h3" })).not.toBeInTheDocument();
    },
  );
  it("shows the local e'raab fallback only to an allowed authenticated role", async () => {
    state.role = "admin";
    state.isAuthenticated = false;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tools: [] }) }));
    render(<ToolsPage />);
    await waitFor(() => expect(screen.getByText("Tools Coming Soon")).toBeInTheDocument());
    expect(screen.queryByText("e'raab", { selector: "h3" })).not.toBeInTheDocument();
  });
  it.each(["developer", "admin", "contributor"])(
    "shows the in-app e'raab route for the %s role when no active tool row is returned",
    async (role) => {
      state.role = role;
      state.isAuthenticated = true;
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ tools: [] }) }));
      render(<ToolsPage />);
      const link = await screen.findByRole("link", { name: /e'raab/i });
      expect(link).toHaveAttribute("href", "/irab");
      expect(link).not.toHaveAttribute("target");
    },
  );
  it("renders canonical names for allowed sessions without modifying stored records", async () => {
    state.isAuthenticated = true;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({
      tools: [{ id: 1, title: "IRAB", titleUrdu: "اعراب", url: "https://legacy.example/irab", description: "I‘rab Tool", descriptionUrdu: "" }],
    }) }));
    render(<ToolsPage />);
    await waitFor(() => expect(screen.getByText("e'raab", { selector: "h3" })).toBeInTheDocument());
    expect(screen.getByText("اِعْراب")).toBeInTheDocument();
    expect(screen.queryByText("IRAB")).not.toBeInTheDocument();
    const link = screen.getByRole("link", { name: /e'raab/i });
    expect(link).toHaveAttribute("href", "/irab");
    expect(link).not.toHaveAttribute("target");
  });
});
