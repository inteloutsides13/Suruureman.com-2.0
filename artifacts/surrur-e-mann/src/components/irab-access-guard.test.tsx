import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { IrabAccessGuard } from "./irab-access-guard";

const TOKEN_KEY = "sem_admin_token";
const ROLE_KEY = "sem_admin_role";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

function renderGuard() {
  return render(
    <Router>
      <IrabAccessGuard>
        <div data-testid="irab-tool-content">e'raab Tool</div>
      </IrabAccessGuard>
    </Router>,
  );
}

describe("IrabAccessGuard", () => {
  it("shows login-required state without exposing the tool to unauthenticated visitors", () => {
    renderGuard();

    expect(screen.getByTestId("irab-login-required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
    expect(screen.queryByTestId("irab-tool-content")).not.toBeInTheDocument();
    expect(document.title).toContain("اِعْراب — e'raab");
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute("content")).toContain("اِعْراب — e'raab");
  });

  it.each(["developer", "admin", "contributor"])("allows the %s role to use the tool", (role) => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    localStorage.setItem(ROLE_KEY, role);

    renderGuard();

    expect(screen.getByTestId("irab-tool-content")).toBeInTheDocument();
    expect(screen.queryByTestId("irab-login-required")).not.toBeInTheDocument();
  });

  it("does not expose the tool for an unsupported role", () => {
    localStorage.setItem(TOKEN_KEY, "test-token");
    localStorage.setItem(ROLE_KEY, "moderator");

    renderGuard();

    expect(screen.getByTestId("irab-login-required")).toBeInTheDocument();
    expect(screen.queryByTestId("irab-tool-content")).not.toBeInTheDocument();
  });
});