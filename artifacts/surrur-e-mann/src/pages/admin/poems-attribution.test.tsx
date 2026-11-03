import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Router } from "wouter";
import AdminPoems, { AdminPoemsEdit } from "./poems";

const mocks = vi.hoisted(() => ({
  adminFetch: vi.fn(),
  useAdminAuth: vi.fn(),
}));

vi.mock("@/hooks/use-admin-auth", () => ({
  adminFetch: mocks.adminFetch,
  useAdminAuth: mocks.useAdminAuth,
}));

vi.mock("@/components/admin-layout", () => ({
  AdminLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const poemFixture = {
  id: 7,
  title: "Sample poem",
  titleUrdu: "نمونہ",
  content: "Poem text",
  poetName: "Poet",
  poetNameUrdu: "شاعر",
  category: "Classic",
  categoryUrdu: "کلاسیکی",
  featured: false,
  imageUrl: null,
  language: "urdu",
  createdAt: "2026-10-01T00:00:00.000Z",
  contributorName: "Amina Noor",
};

function response(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPoems() {
  return render(
    <Router>
      <AdminPoems />
    </Router>,
  );
}

function renderPoemEdit() {
  window.history.replaceState({}, "", "/admin/poems/7/edit");
  return render(
    <Router>
      <Route path="/admin/poems/:id/edit" component={AdminPoemsEdit} />
    </Router>,
  );
}

beforeEach(() => {
  mocks.adminFetch.mockReset();
  mocks.useAdminAuth.mockReset();
});

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("admin poem contributor attribution", () => {
  it.each(["admin", "developer"])("shows contributor display names to %s users only", async (role) => {
    mocks.useAdminAuth.mockReturnValue({ role });
    mocks.adminFetch.mockResolvedValue(response({
      poems: [poemFixture],
      total: 1,
    }));

    renderPoems();

    expect(await screen.findByText(/Contributor: Amina Noor/)).toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/admin/poems?limit=2000&offset=0");
  });

  it("does not fetch or display attribution for a Contributor role", () => {
    mocks.useAdminAuth.mockReturnValue({ role: "contributor" });

    renderPoems();

    expect(mocks.adminFetch).not.toHaveBeenCalled();
    expect(screen.queryByText(/Contributor:/)).not.toBeInTheDocument();
  });

  it("searches on the protected management endpoint with the selected language and keeps edit available", async () => {
    mocks.useAdminAuth.mockReturnValue({ role: "admin" });
    mocks.adminFetch.mockImplementation(() => Promise.resolve(response({ poems: [poemFixture], total: 1 })));

    renderPoems();
    expect(await screen.findByText(/Contributor: Amina Noor/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Punjabi" }));
    await waitFor(() => {
      expect(mocks.adminFetch).toHaveBeenLastCalledWith(
        "/api/admin/poems?limit=2000&offset=0&language=punjabi",
      );
    });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search poems, poets, contributors" }), {
      target: { value: "Bashar" },
    });
    await waitFor(() => {
      expect(mocks.adminFetch).toHaveBeenLastCalledWith(
        "/api/admin/poems?limit=2000&offset=0&language=punjabi&search=Bashar",
      );
    });
    expect(await screen.findByRole("link", { name: "Edit Sample poem" })).toHaveAttribute(
      "href",
      "/admin/poems/7/edit",
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear poem search" }));
    await waitFor(() => {
      expect(mocks.adminFetch).toHaveBeenLastCalledWith(
        "/api/admin/poems?limit=2000&offset=0&language=punjabi",
      );
    });
  });

  it("shows the simple empty state when the server returns no matches", async () => {
    mocks.useAdminAuth.mockReturnValue({ role: "developer" });
    mocks.adminFetch.mockResolvedValue(response({ poems: [], total: 0 }));

    renderPoems();

    expect(await screen.findByText("No poems found.")).toBeInTheDocument();
  });

  it("loads poem details with the authenticated helper so unpublished poems remain editable", async () => {
    mocks.adminFetch.mockResolvedValue(response(poemFixture));

    renderPoemEdit();

    expect(await screen.findByRole("heading", { name: "Edit Poem" })).toBeInTheDocument();
    expect(mocks.adminFetch).toHaveBeenCalledWith("/api/poems/7");
    expect(screen.getByDisplayValue("Sample poem")).toBeInTheDocument();
  });
});
