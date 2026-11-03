import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsMobile } from "./use-mobile";

const matchMediaDescriptor = Object.getOwnPropertyDescriptor(window, "matchMedia");
const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");

function restoreWindowProperties() {
  if (matchMediaDescriptor) {
    Object.defineProperty(window, "matchMedia", matchMediaDescriptor);
  } else {
    Reflect.deleteProperty(window, "matchMedia");
  }
  if (innerWidthDescriptor) {
    Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
  }
}

describe("useIsMobile compatibility fallbacks", () => {
  afterEach(restoreWindowProperties);

  it("uses window resize events when matchMedia is unavailable", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390, writable: true });
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      window.innerWidth = 900;
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });

  it("supports legacy MediaQueryList addListener browsers", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390, writable: true });
    let listener: ((event: MediaQueryListEvent) => void) | null = null;
    const mediaQuery = {
      addListener: (callback: (event: MediaQueryListEvent) => void) => { listener = callback; },
      removeListener: (callback: (event: MediaQueryListEvent) => void) => {
        if (listener === callback) listener = null;
      },
    } as unknown as MediaQueryList;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => mediaQuery,
    });

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => {
      window.innerWidth = 900;
      listener?.({} as MediaQueryListEvent);
    });
    expect(result.current).toBe(false);

    unmount();
    expect(listener).toBeNull();
  });
});
