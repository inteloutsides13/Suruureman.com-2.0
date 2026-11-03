import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RadioPage from "./radio";

const mocks = vi.hoisted(() => ({
  useRadioStatus: vi.fn(),
}));

vi.mock("@/hooks/use-radio-status", () => ({
  useRadioStatus: mocks.useRadioStatus,
}));

vi.mock("@/hooks/use-seo", () => ({
  useSeo: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

function radioState(overrides: Record<string, unknown> = {}) {
  return {
    status: "offline",
    streamUrl: null,
    nowPlaying: null,
    message: "Radio stream is not configured.",
    schedules: [],
    station: null,
    retry: vi.fn(),
    playback: "idle",
    volume: 0.5,
    setVolume: vi.fn(),
    togglePlayback: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.useRadioStatus.mockReturnValue(radioState());
});

describe("public Radio listener-facing wording", () => {
  it("keeps the Radio page concise and points listeners to the persistent player", () => {
    render(<RadioPage />);

    expect(screen.getByRole("heading", { level: 1, name: "لفظ، آواز، سُرور" })).toBeInTheDocument();
    expect(screen.getByText("Radio Suruur FM")).toBeInTheDocument();
    expect(screen.getByText("شاعری، آواز اور احساس — ایک ہی جگہ۔")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "سُرور ایف ایم" })).toBeInTheDocument();
    expect(screen.getByText("سننے کے لیے نیچے موجود سُرور ایف ایم پلیئر استعمال کریں۔")).toBeInTheDocument();
    expect(screen.queryByTitle("Suruur FM on GoCast")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /شاعری پڑھیے/ })).toHaveAttribute("href", "/poems");
    expect(screen.queryByText("Honest status")).not.toBeInTheDocument();
    expect(screen.queryByText("Listening guide")).not.toBeInTheDocument();
    expect(screen.queryByText(/^live$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^on air$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^broadcasting$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Caster\.fm/i)).not.toBeInTheDocument();
  });

  it("omits the schedule section when there are no scheduled programs", () => {
    render(<RadioPage />);

    expect(screen.queryByRole("heading", { name: "نشریاتی پروگرام" })).not.toBeInTheDocument();
    expect(screen.queryByText("ابھی کوئی شیڈول ترتیب نہیں دیا گیا۔")).not.toBeInTheDocument();
  });

  it("still renders configured program details when schedules exist", () => {
    mocks.useRadioStatus.mockReturnValue(radioState({
      schedules: [{
        id: 1,
        name: "Evening",
        timezone: "Asia/Dubai",
        daysOfWeek: "[1,3]",
        startLocalTime: "20:00",
        endLocalTime: "21:00",
        effectiveFrom: null,
        effectiveUntil: null,
        programName: "شام کی شاعری",
        attribution: null,
      }],
    }));

    render(<RadioPage />);

    expect(screen.getByRole("heading", { name: "نشریاتی پروگرام" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "شام کی شاعری" })).toBeInTheDocument();
    expect(screen.getByText(/20:00–21:00 · Monday · Wednesday · Asia\/Dubai/)).toBeInTheDocument();
  });
});