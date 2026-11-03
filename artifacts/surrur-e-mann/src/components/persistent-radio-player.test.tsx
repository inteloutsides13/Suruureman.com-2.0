import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PersistentRadioPlayer } from "./persistent-radio-player";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const PLAYER_PREFERENCE_KEY = "suruur-radio-player-display";
const PLAYER_POSITION_KEY = "suruur-radio-player-position";

function mockPlayerBounds(left: number, top: number, width: number, height: number) {
  vi.spyOn(screen.getByTestId("persistent-radio-player"), "getBoundingClientRect").mockReturnValue({
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  window.localStorage.removeItem(PLAYER_PREFERENCE_KEY);
  window.localStorage.removeItem(PLAYER_POSITION_KEY);
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 768 });
});

describe("PersistentRadioPlayer", () => {
  it("keeps the single genuine GoCast iframe mounted while minimizing and restoring", () => {
    render(<PersistentRadioPlayer />);

    const iframe = screen.getByTitle("Suruur FM on GoCast");
    expect(iframe).toHaveAttribute("src", "https://gocast.fm/embed/suruur-fm-2?volume=1&mute=1");
    expect(iframe).toHaveAttribute("height", "88");
    expect(iframe).toHaveAttribute("loading", "lazy");
    expect(screen.getAllByTitle("Suruur FM on GoCast")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Minimize radio player" }));
    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "minimized");
    expect(screen.getByTitle("Suruur FM on GoCast")).toBe(iframe);

    fireEvent.click(screen.getByRole("button", { name: "Restore radio player" }));
    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "expanded");
    expect(screen.getByTitle("Suruur FM on GoCast")).toBe(iframe);
    expect(screen.getAllByTitle("Suruur FM on GoCast")).toHaveLength(1);
  });

  it("remembers minimized and expanded preferences across remounts", () => {
    const initial = render(<PersistentRadioPlayer />);
    fireEvent.click(screen.getByRole("button", { name: "Minimize radio player" }));
    expect(window.localStorage.getItem(PLAYER_PREFERENCE_KEY)).toBe("minimized");
    initial.unmount();

    const minimized = render(<PersistentRadioPlayer />);
    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "minimized");
    fireEvent.click(screen.getByRole("button", { name: "Restore radio player" }));
    expect(window.localStorage.getItem(PLAYER_PREFERENCE_KEY)).toBe("expanded");
    minimized.unmount();

    render(<PersistentRadioPlayer />);
    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "expanded");
    expect(screen.getAllByTitle("Suruur FM on GoCast")).toHaveLength(1);
  });

  it("links to the full Radio page while keeping the provider iframe visible", () => {
    render(<PersistentRadioPlayer />);
    expect(screen.getByRole("img", { name: "Surrur E Man official logo" })).toHaveAttribute("src", "/logo.jpg");
    expect(screen.getByRole("link", { name: "Open the full Radio page" })).toHaveAttribute("href", "/radio");
    expect(screen.getByTitle("Suruur FM on GoCast")).toBeVisible();
  });

  it("drags the expanded player within viewport bounds and suppresses the resulting click", () => {
    render(<PersistentRadioPlayer />);
    const iframe = screen.getByTitle("Suruur FM on GoCast");
    const handle = screen.getByTestId("radio-player-drag-handle");
    mockPlayerBounds(628, 620, 376, 136);

    fireEvent.pointerDown(handle, { pointerId: 1, button: 0, clientX: 650, clientY: 630 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientX: 670, clientY: 650 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientX: 670, clientY: 650 });
    fireEvent.click(screen.getByRole("button", { name: "Minimize radio player" }));

    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "expanded");
    expect(JSON.parse(window.localStorage.getItem(PLAYER_POSITION_KEY)!)).toEqual({ right: 8, bottom: 8 });
    expect(screen.getByTitle("Suruur FM on GoCast")).toBe(iframe);
  });

  it("drags the minimized button and restores its saved position after remount", () => {
    window.localStorage.setItem(PLAYER_PREFERENCE_KEY, "minimized");
    const initial = render(<PersistentRadioPlayer />);
    const iframe = screen.getByTitle("Suruur FM on GoCast");
    const handle = screen.getByTestId("radio-player-drag-handle");
    mockPlayerBounds(956, 688, 376, 40);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Restore radio player" }), {
      pointerId: 2,
      button: 0,
      clientX: 970,
      clientY: 700,
    });
    fireEvent.pointerMove(handle, { pointerId: 2, clientX: 900, clientY: 500 });
    fireEvent.pointerUp(handle, { pointerId: 2, clientX: 900, clientY: 500 });

    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "minimized");
    expect(JSON.parse(window.localStorage.getItem(PLAYER_POSITION_KEY)!)).toEqual({ right: 90, bottom: 240 });
    expect(screen.getByTitle("Suruur FM on GoCast")).toBe(iframe);
    initial.unmount();

    render(<PersistentRadioPlayer />);
    expect(screen.getByTestId("persistent-radio-player")).toHaveStyle({ right: "90px" });
    expect(screen.getByTestId("persistent-radio-player")).toHaveAttribute("data-display-state", "minimized");
  });
});
