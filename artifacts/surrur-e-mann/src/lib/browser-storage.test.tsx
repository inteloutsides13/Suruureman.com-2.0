import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RadioPlayerProvider } from "@/hooks/use-radio-player";
import { getAdminToken, useAdminAuth } from "@/hooks/use-admin-auth";

const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

function denyLocalStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new DOMException("Storage access is blocked", "SecurityError");
    },
  });
}

function restoreLocalStorage() {
  if (localStorageDescriptor) {
    Object.defineProperty(window, "localStorage", localStorageDescriptor);
  } else {
    Reflect.deleteProperty(window, "localStorage");
  }
}

function AuthStatus() {
  const { isAuthenticated } = useAdminAuth();
  return <span>{isAuthenticated ? "Signed in" : "Public site ready"}</span>;
}

describe("restricted browser storage", () => {
  afterEach(() => {
    restoreLocalStorage();
    vi.unstubAllGlobals();
  });

  it("keeps the public shell rendering when localStorage access throws", () => {
    denyLocalStorage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "offline" }),
    }));

    render(
      <RadioPlayerProvider>
        <AuthStatus />
      </RadioPlayerProvider>,
    );

    expect(screen.getByText("Public site ready")).toBeInTheDocument();
  });

  it("keeps the existing auth token flow in memory for the current tab", () => {
    denyLocalStorage();
    const { result } = renderHook(() => useAdminAuth());

    act(() => result.current.login("compat-token", "reader@example.com", "admin"));
    expect(result.current.isAuthenticated).toBe(true);
    expect(getAdminToken()).toBe("compat-token");

    act(() => result.current.logout());
    expect(result.current.isAuthenticated).toBe(false);
    expect(getAdminToken()).toBeNull();
  });
});
